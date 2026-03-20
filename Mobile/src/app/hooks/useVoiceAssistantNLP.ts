import { useState, useEffect, useCallback, useRef } from 'react';

type AssistantStatus = 'idle' | 'listening' | 'processing' | 'success' | 'error';

interface ParsedResponse {
  intent: string;
  amount?: number;
  recipient?: string;
  currency?: string;
  bill_type?: string;
  needs_confirmation: boolean;
  confirmation_message: string;
  understood_text: string;
  metadata: any;
}

export function useVoiceAssistantNLP(nlpApiUrl: string = 'http://localhost:8001') {
  const [status, setStatus] = useState<AssistantStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState('');
  const [recognition, setRecognition] = useState<any>(null);
  const [parsedIntent, setParsedIntent] = useState<ParsedResponse | null>(null);
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
        setParsedIntent(null);
      };

      rec.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
        setStatus('processing');
        processCommandWithNLP(text);
      };

      rec.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setStatus('error');
        if (event.error === 'not-allowed') {
          setFeedback('Veuillez autoriser le microphone.');
        } else {
          setFeedback('Je n\'ai pas bien entendu. Veuillez réessayer.');
        }
        speakFeedback('Je n\'ai pas bien entendu. Veuillez réessayer.');
      };

      rec.onend = () => {
        // onend can fire asynchronously; rely on a ref to avoid stale closure state.
        if (statusRef.current === 'listening' || statusRef.current === 'processing') {
          setStatus('idle');
        }
      };

      setRecognition(rec);
    } else {
      setFeedback('La reconnaissance vocale n\'est pas supportée sur ce navigateur.');
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

  const parseCommandWithNLP = async (command: string): Promise<ParsedResponse | null> => {
    try {
      const response = await fetch(`${nlpApiUrl}/ai/parse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: command }),
      });

      if (!response.ok) {
        console.error('NLP API error:', response.status);
        return null;
      }

      const data: ParsedResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to parse command with NLP:', error);
      return null;
    }
  };

  const processCommandWithNLP = async (command: string) => {
    try {
      const parsed = await parseCommandWithNLP(command);

      if (!parsed) {
        setFeedback('Impossible de contacter le service NLP. Veuillez réessayer.');
        speakFeedback('Impossible de contacter le service NLP. Veuillez réessayer.');
        setStatus('error');
        setTimeout(() => setStatus('idle'), 5000);
        return;
      }

      setParsedIntent(parsed);

      // Use the confirmation message from NLP or generate one
      const message = parsed.confirmation_message || generateFallbackMessage(parsed);

      setFeedback(message);
      speakFeedback(message);

      // If confidence is high and no confirmation needed, auto-execute
      if (
        parsed.metadata?.confidence >= 0.85 &&
        !parsed.needs_confirmation
      ) {
        setStatus('success');
      } else {
        setStatus('success'); // Still mark as success, but waiting for confirmation
      }

      // Reset to idle after a while if no confirmation
      setTimeout(() => {
        if (statusRef.current === 'success') {
          setStatus('idle');
        }
      }, 8000);
    } catch (error) {
      console.error('Command processing failed:', error);
      setFeedback('Une erreur s\'est produite lors du traitement de votre commande.');
      speakFeedback('Une erreur s\'est produite lors du traitement de votre commande.');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 5000);
    }
  };

  const generateFallbackMessage = (parsed: ParsedResponse): string => {
    switch (parsed.intent) {
      case 'balance':
        return 'Je cherche le solde de votre compte...';
      case 'transfer':
        return `Voulez-vous envoyer ${parsed.amount} ${parsed.currency || 'francs'} à ${parsed.recipient} ?`;
      case 'recharge':
        return `Voulez-vous recharger votre compte de ${parsed.amount} ${parsed.currency || 'francs'} ?`;
      case 'bill_payment':
        return `Voulez-vous payer votre facture de ${parsed.bill_type} pour ${parsed.amount} ${parsed.currency || 'francs'} ?`;
      case 'help':
        return 'Vous pouvez me demander : votre solde, envoyer de l\'argent, recharger votre crédit, ou payer une facture.';
      case 'confirm':
        return 'Action confirmée.';
      case 'cancel':
        return 'Action annulée.';
      default:
        return parsed.confirmation_message || 'Je n\'ai pas bien compris. Pouvez-vous répéter ?';
    }
  };

  const startListening = useCallback(() => {
    if (recognition) {
      try {
        recognition.start();
      } catch (e) {
        console.error('Recognition already started');
      }
    } else {
      // Fallback for browsers without speech recognition (mocking for demo)
      setStatus('listening');
      setFeedback('Je vous écoute... (Simulation)');
      setTimeout(() => {
        const commands = ["Quel est mon solde ?", "Envoie 2000 à Maman", "Recharge 5000"];
        const randomCommand = commands[Math.floor(Math.random() * commands.length)];
        setTranscript(randomCommand);
        setStatus('processing');
        processCommandWithNLP(randomCommand);
      }, 2000);
    }
  }, [recognition]);

  const stopListening = useCallback(() => {
    if (recognition) {
      recognition.stop();
    }
  }, [recognition]);

  return {
    status,
    transcript,
    feedback,
    parsedIntent,
    startListening,
    stopListening,
  };
}
