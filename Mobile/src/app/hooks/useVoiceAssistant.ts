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
import { startProgressiveFeedback, NLP_PROCESSING_STEPS } from '../utils/progressiveFeedback';
import { playListeningStartCue } from '../utils/audioCues';

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

export function useVoiceAssistant() {
  const { user } = useAuth();
  const [status, setStatus] = useState<AssistantStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState('');
  const [recognition, setRecognition] = useState<any>(null);
  const statusRef = useRef<AssistantStatus>('idle');
  const voiceSessionRef = useRef('');
  // UX Fix #9: Reprise automatique après échec de reconnaissance (1 tentative max)
  const retryCountRef = useRef(0);
  const retryPendingRef = useRef(false);
  const startListeningRef = useRef<((isAutoRetry?: unknown) => void) | null>(null);
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
        retryPendingRef.current = false;
        setStatus('listening');
        setTranscript('');
        // UX Fix #14: Bip + vibration pour confirmer que le micro est actif
        playListeningStartCue();
        setFeedback('Je vous écoute...');
      };

      rec.onresult = (event: any) => {
        retryCountRef.current = 0;
        const text = event.results[0][0].transcript;
        setTranscript(text);
        setStatus('processing');
        processCommand(text);
      };

      rec.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        if (event.error === 'not-allowed') {
          // UX: Message clair pour les permissions
          setStatus('error');
          setFeedback('Voice MoMo a besoin du microphone pour vous écouter. Veuillez l\'autoriser dans les paramètres.');
          return;
        }
        // UX Fix #9: Relancer automatiquement l'écoute au lieu de retourner à idle
        if (retryCountRef.current < 1) {
          retryCountRef.current += 1;
          retryPendingRef.current = true;
          setFeedback("Je n'ai pas bien compris. J'écoute à nouveau...");
          speakFeedback("Je n'ai pas bien compris. J'écoute à nouveau.");
          setTimeout(() => {
            try { rec.start(); } catch { /* reconnaissance déjà active */ }
          }, 2500);
          return;
        }
        setStatus('error');
        setFeedback("Je n'ai pas bien compris. Parlez plus près du micro et réessayez.");
        speakFeedback("Je n'ai pas bien compris. Parlez plus près du micro.");
      };

      rec.onend = () => {
        // UX Fix #9: Ne pas retomber à idle si une relance automatique est imminente
        if (retryPendingRef.current) return;
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
      // UX Fix #13: Délai plus long pour lire le message (8 secondes)
      setTimeout(() => setStatus('idle'), 8000);
    },
    [speakFeedback]
  );

  // UX Fix #9: Échec de reconnaissance native → relance automatique (1 tentative)
  const handleNativeSrFailure = useCallback((e: any) => {
    console.error('Capacitor SR error', e);
    const errMsg = (e?.message || String(e)).toLowerCase();
    if (errMsg.includes('denied') || errMsg.includes('permission')) {
      setFeedback('Veuillez autoriser le microphone dans les paramètres.');
      setStatus('error');
      return;
    }
    if (retryCountRef.current < 1) {
      retryCountRef.current += 1;
      setFeedback("Je n'ai pas bien compris. J'écoute à nouveau...");
      speakFeedback("Je n'ai pas bien compris. J'écoute à nouveau.");
      setTimeout(() => startListeningRef.current?.(true), 2500);
      return;
    }
    setStatus('error');
    setFeedback("Je n'ai pas bien compris. Parlez clairement près du microphone.");
    setTimeout(() => setStatus('idle'), 8000);
  }, [speakFeedback]);

  // UX Fix #9: `isAutoRetry === true` uniquement lors d'une relance automatique
  // (un clic utilisateur passe un event en premier argument → compteur remis à zéro)
  const startListening = useCallback(async (isAutoRetry?: unknown) => {
    if (isAutoRetry !== true) retryCountRef.current = 0;
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
        // UX Fix #14: Bip + vibration pour confirmer que le micro est actif
        playListeningStartCue();
        // UX: Instructions claires
        setFeedback('Je vous écoute... Touchez le micro quand vous avez fini de parler.');
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
        // UX Fix #14: Bip + vibration pour confirmer que le micro est actif
        playListeningStartCue();
        // UX Fix #12: Feedback avec exemple de commande
        setFeedback('Je vous écoute... Dites par exemple: "Envoie 5000 à Maman"');

        const startPromise: any = SR.start({
          language: 'fr-FR',
          maxResults: 1,
          prompt: 'Parlez maintenant...',
          partialResults: false,
          popup: false,
        });
        // UX Fix #9: Un "no match" Android rejette la promesse de start() sans
        // passer par le catch ci-dessous → relance automatique de l'écoute
        if (startPromise?.catch) {
          startPromise.catch((err: any) => handleNativeSrFailure(err));
        }

        SR.addListener('partialResults', (data: any) => {
          if (data.matches && data.matches.length > 0) {
            retryCountRef.current = 0;
            const text = data.matches[0];
            setTranscript(text);
            setStatus('processing');
            SR.stop();
            processCommand(text);
          }
        });
      } catch (e: any) {
        handleNativeSrFailure(e);
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
  }, [voiceAi, user?.id, isNative, recognition, processCommand, handleNativeSrFailure]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  const stopListening = useCallback(async () => {
    if (voiceAi) {
      if (status !== 'listening') {
        setStatus('idle');
        return;
      }
      setStatus('processing');
      // UX Fix #3: Messages d'attente échelonnés au lieu d'un "Traitement en cours..." figé
      const stopProgressive = startProgressiveFeedback(setFeedback, NLP_PROCESSING_STEPS);
      try {
        const blob = await stopVoiceRecording();
        const token = getToken();
        const res = await sendVoiceToOrchestrator(
          blob,
          user!.id,
          voiceSessionRef.current,
          token
        );
        stopProgressive();

        // NLP Module response handling (intent-based)
        if (res.transaction_id) {
          voiceSessionRef.current = res.transaction_id;
        }

        // Display understood text
        if (res.understood_text) {
          setTranscript(res.understood_text);
        }

        // Handle confirmation requirement
        const needsConfirm = res.requires_confirmation ?? res.needs_confirmation ?? false;
        const message = res.message || res.confirmation_message || 'Action traitée';

        if (needsConfirm && res.transaction_id) {
          setFeedback(`${message}. Dites \"oui\" et touchez le micro pour confirmer, ou \"non\" pour annuler.`);
        } else {
          setFeedback(message);
        }

        // Play audio response if available
        if (res.audio_base64) {
          await playAudioResponse(res.audio_base64);
        }

        setStatus(res.error ? 'error' : 'success');
      } catch (e) {
        stopProgressive();
        console.error(e);
        // UX Fix #8: Message humain sans termes techniques
        setFeedback("Le service vocal est temporairement indisponible. Veuillez réessayer dans quelques instants.");
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
