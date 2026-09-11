/**
 * Empreinte vocale 100 % on-device.
 * Aucun audio / vecteur n'est envoyé au cloud (ni Gemini, ni backend).
 *
 * Signature : énergies Goertzel (fréquences cibles) + ZCR + énergie RMS,
 * comparée par similarité cosinus.
 */

import { StorageService } from './storage.service';

const STORAGE_KEY = 'momo.voice.biometric';
export const VOICE_BIOMETRIC_MAX_ATTEMPTS = 2;
export const VOICE_BIOMETRIC_THRESHOLD = 0.82;
export const ENROLLMENT_PHRASES = [
  'Je suis le propriétaire de ce compte Voice MoMo',
  'Mon argent est protégé par ma voix',
  'Seul moi peux valider mes transferts',
] as const;

export type VoiceBiometricProfile = {
  embedding: number[];
  enrolledAt: string;
  sampleCount: number;
  version: 1;
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

function averageEmbeddings(vectors: number[][]): number[] {
  if (!vectors.length) return [];
  const len = vectors[0].length;
  const out = new Array(len).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < len; i++) out[i] += v[i] / vectors.length;
  }
  return out;
}

function goertzelPower(samples: Float32Array | number[], sampleRate: number, freq: number): number {
  const k = Math.round((freq * samples.length) / sampleRate);
  const w = (2 * Math.PI * k) / samples.length;
  const cosine = Math.cos(w);
  const coeff = 2 * cosine;
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < samples.length; i++) {
    s0 = samples[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  const power = s1 * s1 + s2 * s2 - coeff * s1 * s2;
  return Math.max(0, power) / samples.length;
}

function downsample(channel: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate <= toRate) return channel;
  const ratio = fromRate / toRate;
  const outLen = Math.floor(channel.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    out[i] = channel[Math.floor(i * ratio)];
  }
  return out;
}

/** Extraire un embedding fixe depuis un Blob audio (Web Audio API). */
export async function extractVoiceEmbedding(audioBlob: Blob): Promise<number[]> {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioCtx = new AudioContext();
  try {
    const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    const channel = downsample(decoded.getChannelData(0), decoded.sampleRate, 16000);
    const sampleRate = 16000;

    if (channel.length < 4000) {
      throw new Error('Enregistrement trop court. Parlez plus longtemps.');
    }

    // Couper silence approximatif aux extrémités
    let start = 0;
    let end = channel.length - 1;
    const silence = 0.01;
    while (start < end && Math.abs(channel[start]) < silence) start++;
    while (end > start && Math.abs(channel[end]) < silence) end--;
    const trimmed = channel.subarray(start, end + 1);
    if (trimmed.length < 4000) {
      throw new Error('Parole insuffisante détectée. Réessayez à voix haute.');
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
      // Limiter le coût CPU
      if (frameCount >= 40) break;
    }

    if (frameCount === 0) {
      throw new Error('Impossible d\'analyser la voix. Réessayez.');
    }

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

export async function enrollVoiceBiometric(audioBlobs: Blob[]): Promise<VoiceBiometricProfile> {
  if (audioBlobs.length < 2) {
    throw new Error('Enregistrez au moins 2 phrases pour sécuriser votre voix.');
  }
  const vectors: number[][] = [];
  for (const blob of audioBlobs) {
    vectors.push(await extractVoiceEmbedding(blob));
  }
  for (let i = 1; i < vectors.length; i++) {
    const sim = cosineSimilarity(vectors[0], vectors[i]);
    if (sim < 0.65) {
      throw new Error('Les enregistrements ne semblent pas provenir de la même voix. Réessayez au calme.');
    }
  }
  const profile: VoiceBiometricProfile = {
    embedding: averageEmbeddings(vectors),
    enrolledAt: new Date().toISOString(),
    sampleCount: vectors.length,
    version: 1,
  };
  await StorageService.set(STORAGE_KEY, profile);
  return profile;
}

export async function verifyVoiceBiometric(audioBlob: Blob): Promise<{
  matched: boolean;
  score: number;
  enrolled: boolean;
}> {
  const profile = await getVoiceBiometricProfile();
  if (!profile?.embedding?.length) {
    return { matched: false, score: 0, enrolled: false };
  }
  const probe = await extractVoiceEmbedding(audioBlob);
  const score = cosineSimilarity(profile.embedding, probe);
  return {
    matched: score >= VOICE_BIOMETRIC_THRESHOLD,
    score,
    enrolled: true,
  };
}

export async function clearVoiceBiometric(): Promise<void> {
  await StorageService.remove(STORAGE_KEY);
}

/** Écrase une chaîne PIN en mémoire (meilleur effort JS). */
export function wipeSecret(secret: { value: string } | null): void {
  if (!secret) return;
  secret.value = '\0'.repeat(secret.value.length || 4);
  secret.value = '';
}
