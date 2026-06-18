/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_VOICE_AI_URL?: string;
  readonly VITE_SILENCE_THRESHOLD?: string;
  readonly VITE_SILENCE_DURATION_MS?: string;
  readonly VITE_MAX_RECORDING_TIME_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
