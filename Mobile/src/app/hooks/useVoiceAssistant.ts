import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../contexts/AuthContext';
import { getToken } from '../utils/api';
import { sendVoiceCommand } from '../services/voice.service';
import {
  isVoiceAiEnabled,
  startVoiceRecording,
  stopVoiceRecording,
  sendVoiceToOrchestrator,
  playAudioResponse,
} from '../services/voiceAI';

type AssistantStatus = 'idle' | 'listening' | 'processing' | 'success' | 'error';

async function getSpeechRecognition() {
  if (!Capacitor.isNativePlatform()) return null;
  const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
  return SpeechRecognition;
}

async function getTextToSpeech() {
  if (!Capacitor.isNativePlatform()) return null;
  const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
  return TextToSpeech;
}

function feedbackForOrchestratorStatus(status: string): string {
  switch (status) {
    case 'awaiting_confirmation':
      return 'Répondez oui ou non, puis touchez le micro pour enregistrer.';
    case 'awaiting_pin':
      return 'Dites votre PIN (4 à 6 chiffres), puis touchez à nouveau le micro.';
    case 'awaiting_phone':
      return 'Dictez le numéro, puis touchez à nouveau le micro.';
    case 'done':
      return '';
    case 'error':
      return 'Service vocal indisponible.';
    default:
      return '';
  }
}

export function useVoiceAssistant() {
  const { user } = useAuth();
  const [status, setStatus] = useState<AssistantStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState('');
  const [recognition, setRecognition] = useState<any>(null);
  const statusRef = useRef<AssistantStatus>('idle');
  const voiceSessionRef = useRef('');
  const isNative = Capacitor.isNativePlatform();
  const voiceAi = isVoiceAiEnabled();

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (isNative || voiceAi) return;
    // Web: Web Speech API when local AI orchestrator is disabled
    // @ts-ignore
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      const rec = new SpeechRecognitionAPI();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'fr-FR';

      rec.onstart = () => {
        setStatus('listening');
        setTranscript('');
        setFeedback('Je vous écoute...');
      };

      rec.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
        setStatus('processing');
        processCommand(text);
      };

      rec.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setStatus('error');
        if (event.error === 'not-allowed') {
          setFeedback('Veuillez autoriser le microphone.');
        } else {
          setFeedback("Je n'ai pas bien entendu. Veuillez réessayer.");
        }
        speakFeedback("Je n'ai pas bien entendu. Veuillez réessayer.");
      };

      rec.onend = () => {
        if (statusRef.current === 'listening' || statusRef.current === 'processing') {
          setStatus('idle');
        }
      };

      setRecognition(rec);
    }
  }, [isNative, voiceAi]);

  const speakFeedback = useCallback(async (text: string) => {
    if (voiceAi) return;
    if (isNative) {
      try {
        const TTS = await getTextToSpeech();
        if (TTS) {
          await TTS.speak({ text, lang: 'fr-FR', rate: 1.0, pitch: 1.0, volume: 1.0 });
        }
      } catch (e) {
        console.error('TTS error', e);
      }
    } else if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fr-FR';
      window.speechSynthesis.speak(utterance);
    }
  }, [isNative, voiceAi]);

  const processCommand = useCallback(
    async (command: string) => {
      try {
        const result = await sendVoiceCommand(command);
        setFeedback(result.message);
        speakFeedback(result.message);
        setStatus(result.intent === 'unknown' ? 'error' : 'success');
      } catch {
        const msg = "Je n'ai pas pu traiter votre commande. Veuillez réessayer.";
        setFeedback(msg);
        speakFeedback(msg);
        setStatus('error');
      }
      setTimeout(() => setStatus('idle'), 5000);
    },
    [speakFeedback]
  );

  const startListening = useCallback(async () => {
    if (voiceAi) {
      if (!user?.id) {
        setFeedback('Connectez-vous pour utiliser la voix.');
        setStatus('error');
        setTimeout(() => setStatus('idle'), 3500);
        return;
      }
      try {
        await startVoiceRecording();
        setStatus('listening');
        setTranscript('');
        setFeedback('Parlez. Touchez à nouveau le micro pour envoyer.');
      } catch (e) {
        console.error(e);
        setFeedback("Microphone indisponible ou refusé.");
        setStatus('error');
        setTimeout(() => setStatus('idle'), 3500);
      }
      return;
    }

    if (isNative) {
      try {
        const SR = await getSpeechRecognition();
        if (!SR) return;

        const { available } = await SR.available();
        if (!available) {
          setFeedback("Reconnaissance vocale indisponible sur cet appareil.");
          return;
        }

        const permission = await SR.requestPermissions();
        if (
          (permission as any).speechRecognition !== 'granted' &&
          (permission as any).microphone !== 'granted'
        ) {
          setFeedback('Veuillez autoriser le microphone pour utiliser cette fonctionnalité.');
          setStatus('error');
          setTimeout(() => setStatus('idle'), 4000);
          return;
        }

        setStatus('listening');
        setTranscript('');
        setFeedback('Je vous écoute...');

        SR.start({
          language: 'fr-FR',
          maxResults: 1,
          prompt: 'Parlez maintenant...',
          partialResults: false,
          popup: false,
        });

        SR.addListener('partialResults', (data: any) => {
          if (data.matches && data.matches.length > 0) {
            const text = data.matches[0];
            setTranscript(text);
            setStatus('processing');
            SR.stop();
            processCommand(text);
          }
        });
      } catch (e: any) {
        console.error('Capacitor SR error', e);
        if (e.message?.includes('denied')) {
          setFeedback('Veuillez autoriser le microphone dans les paramètres.');
        } else {
          setFeedback("Je n'ai pas bien entendu. Veuillez réessayer.");
        }
        setStatus('error');
      }
      return;
    }

    if (recognition) {
      try {
        recognition.start();
      } catch (e) {
        console.error('Recognition already started');
      }
    } else {
      setStatus('listening');
      setFeedback('Je vous écoute... (Simulation)');
      setTimeout(() => {
        const commands = ['Quel est mon solde ?', 'Envoie 2000 à Maman', 'Recharge 5000'];
        const randomCommand = commands[Math.floor(Math.random() * commands.length)];
        setTranscript(randomCommand);
        setStatus('processing');
        processCommand(randomCommand);
      }, 2000);
    }
  }, [voiceAi, user?.id, isNative, recognition, processCommand]);

  const stopListening = useCallback(async () => {
    if (voiceAi) {
      if (status !== 'listening') {
        setStatus('idle');
        return;
      }
      setStatus('processing');
      setFeedback('Traitement en cours...');
      try {
        const blob = await stopVoiceRecording();
        const token = getToken();
        const res = await sendVoiceToOrchestrator(
          blob,
          user!.id,
          voiceSessionRef.current,
          token
        );
        if (res.status === 'done' || res.status === 'error') {
          voiceSessionRef.current = '';
        } else {
          voiceSessionRef.current = res.sessionId || voiceSessionRef.current;
        }
        if (res.transcript && res.transcript !== '[redacted]') {
          setTranscript(res.transcript);
        }
        const extra = feedbackForOrchestratorStatus(res.status);
        setFeedback(extra || (res.status === 'done' ? 'OK.' : res.error || ''));
        if (res.audioBase64) {
          await playAudioResponse(res.audioBase64);
        }
        setStatus(res.status === 'error' ? 'error' : 'success');
      } catch (e) {
        console.error(e);
        setFeedback("Serveur vocal injoignable. Vérifiez VITE_VOICE_AI_URL et l'orchestrateur.");
        setStatus('error');
        voiceSessionRef.current = '';
      }
      setTimeout(() => setStatus('idle'), 5000);
      return;
    }

    if (isNative) {
      try {
        const SR = await getSpeechRecognition();
        if (SR) await SR.stop();
      } catch (e) {
        console.error('Stop SR error', e);
      }
    } else if (recognition) {
      recognition.stop();
    }
    setStatus('idle');
  }, [voiceAi, status, user, recognition, isNative]);

  return {
    status,
    transcript,
    feedback,
    startListening,
    stopListening,
    voiceAiMode: voiceAi,
  };
}
