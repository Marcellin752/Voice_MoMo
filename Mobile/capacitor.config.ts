import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.voicemomo.app',
  appName: 'Voice MoMo',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    cleartext: true,
  },
  plugins: {
    SpeechRecognition: {
      language: 'fr-FR',
    },
    TextToSpeech: {
      speechRate: 1.0,
    },
  },
};

export default config;
