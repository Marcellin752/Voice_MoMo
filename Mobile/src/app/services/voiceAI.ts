/**
 * Local voice AI client — POST audio to NLP Module (STT → NLU → TTS).
 * Set VITE_VOICE_AI_URL (e.g. http://192.168.1.10:8000) to enable on the mic button.
 * The NLP Module uses Gemini 2.0 Flash for voice processing.
 */

const raw = (import.meta.env.VITE_VOICE_AI_URL as string | undefined)?.trim();

export function getVoiceAiBaseUrl(): string | undefined {
  if (!raw) return undefined;
  return raw.replace(/\/$/, "");
}

export function isVoiceAiEnabled(): boolean {
  const u = getVoiceAiBaseUrl();
  return Boolean(u && u.startsWith("http"));
}

export type VoiceAiResponse = {
  intent: string;
  message?: string;
  confirmation_message?: string;
  requires_confirmation?: boolean;
  needs_confirmation?: boolean;
  transaction_id?: string;
  understood_text?: string;
  audio_base64?: string;
  success?: boolean;
  error?: string;
  data?: any;
  metadata?: {
    confidence?: number;
    provider?: string;
    model?: string;
  };
};

let mediaRecorder: MediaRecorder | null = null;
let mediaChunks: BlobPart[] = [];
let mediaStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let silenceTimeoutId: ReturnType<typeof setTimeout> | null = null;
let maxRecordingTimeoutId: ReturnType<typeof setTimeout> | null = null;
let onSilenceDetectedCallback: (() => void) | null = null;

// Configuration pour la détection du silence (configurable)
const SILENCE_THRESHOLD = Number(import.meta.env.VITE_SILENCE_THRESHOLD || 0.02); // RMS threshold
const SILENCE_DURATION_MS = Number(import.meta.env.VITE_SILENCE_DURATION_MS || 2000); // 2 secondes de silence
const MAX_RECORDING_TIME_MS = Number(import.meta.env.VITE_MAX_RECORDING_TIME_MS || 30000); // 30 secondes max

function pickMimeType(): string {
  const c = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const t of c) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) return t;
  }
  return "audio/webm";
}

function calculateRMS(data: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const normalized = (data[i] - 128) / 128;
    sum += normalized * normalized;
  }
  return Math.sqrt(sum / data.length);
}

function detectSilence() {
  if (!analyser) return;
  
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);
  
  const rms = calculateRMS(dataArray);
  
  if (rms < SILENCE_THRESHOLD) {
    if (silenceTimeoutId === null) {
      silenceTimeoutId = setTimeout(() => {
        console.log(`🔇 [AUDIO] Silence détecté après ${SILENCE_DURATION_MS}ms`);
        onSilenceDetectedCallback?.();
        silenceTimeoutId = null;
      }, SILENCE_DURATION_MS);
    }
  } else {
    // Son détecté, réinitialiser le timeout du silence
    if (silenceTimeoutId !== null) {
      clearTimeout(silenceTimeoutId);
      silenceTimeoutId = null;
    }
  }
  
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    requestAnimationFrame(detectSilence);
  }
}

export async function startVoiceRecording(): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone not available in this environment.");
  }
  
  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaChunks = [];
  const mime = pickMimeType();
  mediaRecorder = new MediaRecorder(mediaStream, { mimeType: mime });
  
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) mediaChunks.push(e.data);
  };
  
  // Configuration audio context pour la détection du silence
  if (!audioContext && typeof window !== "undefined" && 'AudioContext' in window) {
    audioContext = new (window.AudioContext as any)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    const source = audioContext.createMediaStreamAudioProcessor?.
      ? audioContext.createMediaStreamSource(mediaStream) 
      : audioContext.createMediaStreamAudioSource(mediaStream);
    source.connect(analyser);
  }
  
  mediaRecorder.start(100); // Réduit de 120ms à 100ms pour une meilleure détection
  
  // Démarrer la détection du silence
  if (analyser) {
    requestAnimationFrame(detectSilence);
  }
  
  // Timeout maximal pour éviter les enregistrements infinis
  maxRecordingTimeoutId = setTimeout(() => {
    console.log(`⏱️ [AUDIO] Durée maximale d'enregistrement atteinte (${MAX_RECORDING_TIME_MS}ms)`);
    stopVoiceRecordingInternal();
  }, MAX_RECORDING_TIME_MS);
  
  // Exposer le callback pour auto-stop
  onSilenceDetectedCallback = stopVoiceRecordingInternal;
}

async function stopVoiceRecordingInternal(): Promise<void> {
  if (silenceTimeoutId) clearTimeout(silenceTimeoutId);
  if (maxRecordingTimeoutId) clearTimeout(maxRecordingTimeoutId);
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
}

export async function stopVoiceRecording(): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Arrêter les timeouts
    if (silenceTimeoutId) clearTimeout(silenceTimeoutId);
    if (maxRecordingTimeoutId) clearTimeout(maxRecordingTimeoutId);
    
    if (!mediaRecorder) {
      reject(new Error("Recorder not started"));
      return;
    }
    
    const mr = mediaRecorder;
    mr.onstop = () => {
      const blob = new Blob(mediaChunks, { type: mr.mimeType || "audio/webm" });
      mediaStream?.getTracks().forEach((t) => t.stop());
      
      // Nettoyer les ressources audio
      if (audioContext) {
        audioContext.close();
        audioContext = null;
        analyser = null;
      }
      
      mediaRecorder = null;
      mediaStream = null;
      mediaChunks = [];
      onSilenceDetectedCallback = null;
      
      resolve(blob);
    };
    
    mr.onerror = () => reject(new Error("Recording failed"));
    
    try {
      if (mr.state === 'recording') {
        mr.stop();
      } else {
        resolve(new Blob(mediaChunks, { type: mr.mimeType || "audio/webm" }));
      }
    } catch (e) {
      reject(e);
    }
  });
}

export async function sendVoiceToOrchestrator(
  blob: Blob,
  userId: string,
  transactionId: string,
  token: string | null,
  path: "/api/voice-command" | "/api/confirm" | "/api/cancel" = "/api/voice-command"
): Promise<VoiceAiResponse> {
  const base = getVoiceAiBaseUrl();
  if (!base) throw new Error("VITE_VOICE_AI_URL is not set");

  const fd = new FormData();
  fd.append("audio_file", blob, "voice.webm");
  fd.append("userId", userId);
  if (transactionId) fd.append("transaction_id", transactionId);

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers,
    body: fd,
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `HTTP ${res.status}`);
  }

  const data = await res.json();

  // Normalize response from NLP Module
  const normalized: VoiceAiResponse = {
    ...data,
    // Support both requires_confirmation (new) and needs_confirmation (legacy)
    requires_confirmation: data.requires_confirmation ?? data.needs_confirmation ?? false,
    // Support both message (new) and confirmation_message (legacy)
    message: data.message ?? data.confirmation_message ?? "Action traitée",
  };

  return normalized;
}

export async function playAudioResponse(base64Audio: string): Promise<void> {
  if (!base64Audio) return;
  const bin = atob(base64Audio);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
  const audio = new Audio(url);
  try {
    await audio.play();
    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("Playback failed"));
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
