import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { sendVoiceCommand } from '../services/voice.service';

type AssistantStatus = 'idle' | 'listening' | 'processing' | 'success' | 'error';

// Lazy-load Capacitor plugins only on native platforms
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
  const [status, setStatus] = useState<AssistantStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState('');
  const [recognition, setRecognition] = useState<any>(null);
  const statusRef = useRef<AssistantStatus>('idle');
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (!isNative) {
      // Navigateur web : utiliser Web Speech API
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
    }
    // Pour Android natif, la reconnaissance se fait dans startListening()
  }, [isNative]);

  const speakFeedback = useCallback(async (text: string) => {
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
  }, [isNative]);

  const processCommand = useCallback(async (command: string) => {
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
  }, [speakFeedback]);

  const startListening = useCallback(async () => {
    if (isNative) {
      // Android : Capacitor Speech Recognition
      try {
        const SR = await getSpeechRecognition();
        if (!SR) return;

        const { available } = await SR.available();
        if (!available) {
          setFeedback("Reconnaissance vocale indisponible sur cet appareil.");
          return;
        }

        const permission = await SR.requestPermissions();
        if ((permission as any).speechRecognition !== 'granted' && (permission as any).microphone !== 'granted') {
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
    } else if (recognition) {
      // Navigateur web
      try {
        recognition.start();
      } catch (e) {
        console.error('Recognition already started');
      }
    } else {
      // Fallback simulation
      setStatus('listening');
      setFeedback('Je vous écoute... (Simulation)');
      setTimeout(() => {
        const commands = ["Quel est mon solde ?", "Envoie 2000 à Maman", "Recharge 5000"];
        const randomCommand = commands[Math.floor(Math.random() * commands.length)];
        setTranscript(randomCommand);
        setStatus('processing');
        processCommand(randomCommand);
      }, 2000);
    }
  }, [isNative, recognition, processCommand]);

  const stopListening = useCallback(async () => {
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
  }, [isNative, recognition]);

  return {
    status,
    transcript,
    feedback,
    startListening,
    stopListening,
  };
}
