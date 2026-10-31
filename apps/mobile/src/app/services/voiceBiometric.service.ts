/**
 * Empreinte vocale on-device, apprentissage passif (style Siri).
 * L'utilisateur n'a pas besoin d'enregistrer des phrases :
 * le système apprend en écoutant les commandes normales.
 */

import { StorageService } from './storage.service';

const STORAGE_KEY = 'momo.voice.biometric';
const JOURNAL_KEY = 'momo.voice.biometric.journal';
const REPLAY_KEY = 'momo.voice.biometric.recent';

/** Nombre minimum d'échantillons avant de bloquer une voix inconnue. */
export const LEARNING_MIN_SAMPLES = 3;
export const VOICE_BIOMETRIC_MAX_ATTEMPTS = 2;
export const VOICE_BIOMETRIC_THRESHOLD = 0.78;
export const REPLAY_SIMILARITY_THRESHOLD = 0.985;
export const REPLAY_WINDOW_MS = 90_000;
export const BIOMETRIC_JOURNAL_MAX = 40;

export type VoiceBiometricProfile = {
  embedding: number[];
  enrolledAt: string;
  sampleCount: number;
  version: 2;
  /** true tant que le profil apprend encore (pas assez d'échantillons). */
  learning: boolean;
};

export type BiometricJournalEntry = {
  at: string;
  event: 'learn' | 'verify_ok' | 'verify_fail' | 'replay_blocked' | 'lockout' | 'enroll';
  score?: number;
  detail?: string;
};

export type RecentProbe = {
  at: number;
  embedding: number[];
};

const TARGET_HZ = [80, 120, 180, 250, 350, 500, 750, 1000, 1500, 2000, 3000, 4000];

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function goertzelPower(samples: Float32Array | number[], sampleRate: number, freq: number): number {
  const k = Math.round((freq * samples.length) / sampleRate);
  const w = (2 * Math.PI * k) / samples.length;
  const coeff = 2 * Math.cos(w);
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < samples.length; i++) {
    s0 = samples[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return Math.max(0, s1 * s1 + s2 * s2 - coeff * s1 * s2) / samples.length;
}

function downsample(channel: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate <= toRate) return channel;
  const ratio = fromRate / toRate;
  const outLen = Math.floor(channel.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) out[i] = channel[Math.floor(i * ratio)];
  return out;
}

export async function appendBiometricJournal(
  event: BiometricJournalEntry['event'],
  extra?: { score?: number; detail?: string }
): Promise<void> {
  const prev = (await StorageService.get<BiometricJournalEntry[]>(JOURNAL_KEY)) || [];
  const next = [
    { at: new Date().toISOString(), event, score: extra?.score, detail: extra?.detail },
    ...prev,
  ].slice(0, BIOMETRIC_JOURNAL_MAX);
  await StorageService.set(JOURNAL_KEY, next);
}

export async function getBiometricJournal(): Promise<BiometricJournalEntry[]> {
  return (await StorageService.get<BiometricJournalEntry[]>(JOURNAL_KEY)) || [];
}

async function loadRecentProbes(): Promise<RecentProbe[]> {
  const raw = (await StorageService.get<RecentProbe[]>(REPLAY_KEY)) || [];
  const now = Date.now();
  return raw.filter((p) => now - p.at < REPLAY_WINDOW_MS);
}

async function saveRecentProbe(embedding: number[]): Promise<void> {
  const prev = await loadRecentProbes();
  prev.unshift({ at: Date.now(), embedding });
  await StorageService.set(REPLAY_KEY, prev.slice(0, 8));
}

export async function extractVoiceEmbedding(audioBlob: Blob): Promise<number[]> {
  if (!audioBlob || audioBlob.size < 500) {
    throw new Error('Audio trop court pour analyser la voix.');
  }
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioCtx = new AudioContext();
  try {
    const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    const channel = downsample(decoded.getChannelData(0), decoded.sampleRate, 16000);
    const sampleRate = 16000;
    if (channel.length < 2000) {
      throw new Error('Enregistrement trop court.');
    }

    let start = 0;
    let end = channel.length - 1;
    const silence = 0.008;
    while (start < end && Math.abs(channel[start]) < silence) start++;
    while (end > start && Math.abs(channel[end]) < silence) end--;
    const trimmed = channel.subarray(start, end + 1);
    if (trimmed.length < 2000) {
      throw new Error('Parole insuffisante.');
    }

    const frameSize = 2048;
    const hop = 1024;
    const bandAcc = new Array(TARGET_HZ.length).fill(0);
    let frameCount = 0;
    let zcrAcc = 0;
    let energyAcc = 0;

    for (let i = 0; i + frameSize < trimmed.length; i += hop) {
      const frame = trimmed.subarray(i, i + frameSize);
      let energy = 0;
      let zcr = 0;
      for (let j = 0; j < frame.length; j++) {
        energy += frame[j] * frame[j];
        if (j > 0 && (frame[j] >= 0) !== (frame[j - 1] >= 0)) zcr += 1;
      }
      energyAcc += energy / frame.length;
      zcrAcc += zcr / frame.length;
      for (let b = 0; b < TARGET_HZ.length; b++) {
        bandAcc[b] += goertzelPower(frame, sampleRate, TARGET_HZ[b]);
      }
      frameCount++;
      if (frameCount >= 40) break;
    }
    if (frameCount === 0) throw new Error('Impossible d\'analyser la voix.');

    const embedding = [
      ...bandAcc.map((v) => Math.log1p(v / frameCount)),
      Math.log1p(energyAcc / frameCount),
      zcrAcc / frameCount,
    ];
    const norm = Math.sqrt(embedding.reduce((s, x) => s + x * x, 0)) || 1;
    return embedding.map((x) => x / norm);
  } finally {
    await audioCtx.close().catch(() => {});
  }
}

export async function getVoiceBiometricProfile(): Promise<VoiceBiometricProfile | null> {
  return StorageService.get<VoiceBiometricProfile>(STORAGE_KEY);
}

export async function hasVoiceBiometric(): Promise<boolean> {
  const p = await getVoiceBiometricProfile();
  return !!(p?.embedding?.length);
}

export async function isVoiceProfileReady(): Promise<boolean> {
  const p = await getVoiceBiometricProfile();
  return !!(p && !p.learning && p.sampleCount >= LEARNING_MIN_SAMPLES);
}

/**
 * Apprend passivement depuis une commande vocale normale.
 * Moyenne glissante de l'embedding — pas besoin de session d'enrôlement.
 */
export async function learnFromUserSpeech(audioBlob: Blob): Promise<VoiceBiometricProfile | null> {
  try {
    if (!audioBlob || audioBlob.size < 800) return null;
    const probe = await extractVoiceEmbedding(audioBlob);
    const prev = await getVoiceBiometricProfile();
    let profile: VoiceBiometricProfile;

    if (!prev?.embedding?.length) {
      profile = {
        embedding: probe,
        enrolledAt: new Date().toISOString(),
        sampleCount: 1,
        version: 2,
        learning: true,
      };
    } else {
      const n = Math.min(prev.sampleCount, 12);
      const merged = prev.embedding.map((v, i) => (v * n + probe[i]) / (n + 1));
      const norm = Math.sqrt(merged.reduce((s, x) => s + x * x, 0)) || 1;
      const sampleCount = prev.sampleCount + 1;
      profile = {
        embedding: merged.map((x) => x / norm),
        enrolledAt: prev.enrolledAt,
        sampleCount,
        version: 2,
        learning: sampleCount < LEARNING_MIN_SAMPLES,
      };
    }

    await StorageService.set(STORAGE_KEY, profile);
    await appendBiometricJournal('learn', {
      detail: `samples=${profile.sampleCount}${profile.learning ? ' (apprentissage)' : ' (prêt)'}`,
    });
    return profile;
  } catch (e) {
    console.warn('⚠️ [BIOMETRIC] Apprentissage ignoré:', e);
    return null;
  }
}

export async function verifyVoiceBiometric(audioBlob: Blob): Promise<{
  matched: boolean;
  score: number;
  enrolled: boolean;
  learning?: boolean;
  replayBlocked?: boolean;
}> {
  const profile = await getVoiceBiometricProfile();
  if (!profile?.embedding?.length || profile.learning || profile.sampleCount < LEARNING_MIN_SAMPLES) {
    // Encore en apprentissage : on laisse passer et on apprend
    await learnFromUserSpeech(audioBlob);
    return { matched: true, score: 1, enrolled: false, learning: true };
  }

  const probe = await extractVoiceEmbedding(audioBlob);
  const recent = await loadRecentProbes();
  for (const prev of recent) {
    const replayScore = cosineSimilarity(prev.embedding, probe);
    if (replayScore >= REPLAY_SIMILARITY_THRESHOLD) {
      await appendBiometricJournal('replay_blocked', { score: replayScore });
      return { matched: false, score: replayScore, enrolled: true, replayBlocked: true };
    }
  }

  const score = cosineSimilarity(profile.embedding, probe);
  const matched = score >= VOICE_BIOMETRIC_THRESHOLD;
  await saveRecentProbe(probe);
  if (matched) {
    // Renforce le profil avec cette voix valide
    await learnFromUserSpeech(audioBlob);
  }
  await appendBiometricJournal(matched ? 'verify_ok' : 'verify_fail', { score });
  return { matched, score, enrolled: true };
}

/** Vérifie un blob déjà capturé (commande vocale) sans nouveau challenge. */
export async function verifyOrLearnFromCommandAudio(audioBlob: Blob | null): Promise<{
  ok: boolean;
  learning: boolean;
  replayBlocked?: boolean;
  score?: number;
  message?: string;
}> {
  if (!audioBlob || audioBlob.size < 800) {
    // Pas d'audio : en phase d'apprentissage on laisse passer
    const ready = await isVoiceProfileReady();
    if (!ready) return { ok: true, learning: true };
    return { ok: false, learning: false, message: 'Impossible de vérifier la voix. Réessayez.' };
  }

  const ready = await isVoiceProfileReady();
  if (!ready) {
    await learnFromUserSpeech(audioBlob);
    return { ok: true, learning: true };
  }

  const result = await verifyVoiceBiometric(audioBlob);
  if (result.replayBlocked) {
    return { ok: false, learning: false, replayBlocked: true, score: result.score };
  }
  if (!result.matched) {
    return { ok: false, learning: false, score: result.score, message: 'Voix non reconnue.' };
  }
  return { ok: true, learning: false, score: result.score };
}

export async function clearVoiceBiometric(): Promise<void> {
  await StorageService.remove(STORAGE_KEY);
  await StorageService.remove(REPLAY_KEY);
}

export function wipeSecret(secret: { value: string } | null): void {
  if (!secret) return;
  secret.value = '\0'.repeat(secret.value.length || 4);
  secret.value = '';
}

/** Conservé pour compat éventuelle — l'enrôlement forcé n'est plus requis. */
export const ENROLLMENT_PHRASES = [
  'Je suis le propriétaire de ce compte Voice MoMo',
  'Mon argent est protégé par ma voix',
  'Seul moi peux valider mes transferts',
] as const;

export function buildBiometricChallenge(): { phrase: string; codeWord: string } {
  return {
    phrase: 'Je confirme que c\'est bien moi',
    codeWord: 'moi',
  };
}

export async function enrollVoiceBiometric(audioBlobs: Blob[]): Promise<VoiceBiometricProfile> {
  for (const blob of audioBlobs) {
    await learnFromUserSpeech(blob);
  }
  const p = await getVoiceBiometricProfile();
  if (!p) throw new Error('Échec de l\'enregistrement vocal.');
  return p;
}
