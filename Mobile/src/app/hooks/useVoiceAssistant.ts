import { useState, useEffect, useCallback, useRef } from 'react';
import { sendVoiceCommand } from '../services/voice.service';

type AssistantStatus = 'idle' | 'listening' | 'processing' | 'success' | 'error';

export function useVoiceAssistant() {
  const [status, setStatus] = useState<AssistantStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState('');
  const [recognition, setRecognition] = useState<any>(null);
  const statusRef = useRef<AssistantStatus>('idle');

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let rec: any = null;
    if (SpeechRecognition) {
      rec = new SpeechRecognition();
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
    } else {
      setFeedback("La reconnaissance vocale n'est pas supportée sur ce navigateur.");
    }

    return () => {
      if (rec) {
        rec.onstart = null;
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.stop();
      }
    };
  }, []);

  const speakFeedback = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fr-FR';
      window.speechSynthesis.speak(utterance);
    }
  };

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
  }, []);

  const startListening = useCallback(() => {
    if (recognition) {
      try {
        recognition.start();
      } catch (e) {
        console.error('Recognition already started');
      }
    } else {
      // Fallback simulation pour navigateurs sans Speech API
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
  }, [recognition, processCommand]);

  const stopListening = useCallback(() => {
    if (recognition) {
      recognition.stop();
    }
    setStatus('idle');
  }, [recognition]);

  return {
    status,
    transcript,
    feedback,
    startListening,
    stopListening,
  };
}
