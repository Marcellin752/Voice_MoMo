/**
 * Local voice AI client — POST audio to orchestrator (STT → NLU → backend → TTS).
 * Set VITE_VOICE_AI_URL (e.g. http://192.168.1.10:5004) to enable on the mic button.
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
  status: string;
  audioBase64: string;
  sessionId: string;
  transcript?: string;
  intent?: unknown;
  error?: string;
};

let mediaRecorder: MediaRecorder | null = null;
let mediaChunks: BlobPart[] = [];
let mediaStream: MediaStream | null = null;

function pickMimeType(): string {
  const c = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const t of c) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) return t;
  }
  return "audio/webm";
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
  mediaRecorder.start(120);
}

export async function stopVoiceRecording(): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder) {
      reject(new Error("Recorder not started"));
      return;
    }
    const mr = mediaRecorder;
    mr.onstop = () => {
      const blob = new Blob(mediaChunks, { type: mr.mimeType || "audio/webm" });
      mediaStream?.getTracks().forEach((t) => t.stop());
      mediaRecorder = null;
      mediaStream = null;
      mediaChunks = [];
      resolve(blob);
    };
    mr.onerror = () => reject(new Error("Recording failed"));
    try {
      mr.stop();
    } catch (e) {
      reject(e);
    }
  });
}

export async function sendVoiceToOrchestrator(
  blob: Blob,
  userId: string,
  sessionId: string,
  token: string | null,
  path: "/voice/command" | "/voice/confirm" = "/voice/command"
): Promise<VoiceAiResponse> {
  const base = getVoiceAiBaseUrl();
  if (!base) throw new Error("VITE_VOICE_AI_URL is not set");

  const fd = new FormData();
  fd.append("audio", blob, "voice.webm");
  fd.append("userId", userId);
  if (sessionId) fd.append("sessionId", sessionId);

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
  return res.json() as Promise<VoiceAiResponse>;
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
