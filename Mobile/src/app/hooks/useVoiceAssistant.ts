import { useState, useEffect, useCallback } from 'react';

type AssistantStatus = 'idle' | 'listening' | 'processing' | 'success' | 'error';

export function useVoiceAssistant() {
  const [status, setStatus] = useState<AssistantStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState('');
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
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
          setFeedback('Je n\'ai pas bien entendu. Veuillez réessayer.');
        }
        speakFeedback('Je n\'ai pas bien entendu. Veuillez réessayer.');
      };

      rec.onend = () => {
        if (status === 'listening') {
           setStatus('idle');
        }
      };

      setRecognition(rec);
    } else {
      setFeedback('La reconnaissance vocale n\'est pas supportée sur ce navigateur.');
    }
  }, []);

  const speakFeedback = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fr-FR';
      window.speechSynthesis.speak(utterance);
    }
  };

  const processCommand = (command: string) => {
    const text = command.toLowerCase();
    
    setTimeout(() => {
      if (text.includes('solde')) {
        const msg = 'Votre solde actuel est de 15000 francs CFA.';
        setFeedback(msg);
        speakFeedback(msg);
        setStatus('success');
      } else if (text.includes('envoi') || text.includes('envoyer') || text.includes('transfert')) {
        const amountMatch = text.match(/\d+/);
        const amount = amountMatch ? amountMatch[0] : null;
        if (amount) {
          const msg = `Voulez-vous vraiment envoyer ${amount} francs ? Dites oui pour confirmer.`;
          setFeedback(msg);
          speakFeedback(msg);
          setStatus('success');
        } else {
          const msg = 'Je n\'ai pas compris le montant. Veuillez répéter "Envoie [montant]".';
          setFeedback(msg);
          speakFeedback(msg);
          setStatus('error');
        }
      } else if (text.includes('recharge') || text.includes('recharger') || text.includes('crédit')) {
        const amountMatch = text.match(/\d+/);
        const amount = amountMatch ? amountMatch[0] : null;
        if (amount) {
          const msg = `Voulez-vous recharger votre compte de ${amount} francs ? Dites oui pour confirmer.`;
          setFeedback(msg);
          speakFeedback(msg);
          setStatus('success');
        } else {
          const msg = 'Je n\'ai pas compris le montant. Veuillez répéter "Recharge [montant]".';
          setFeedback(msg);
          speakFeedback(msg);
          setStatus('error');
        }
      } else {
        const msg = 'Commande non reconnue. Essayez de dire "Solde", ou "Envoie 5000 francs".';
        setFeedback(msg);
        speakFeedback(msg);
        setStatus('error');
      }

      // Reset to idle after a while
      setTimeout(() => setStatus('idle'), 5000);
    }, 1000); // Simulate processing delay
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
        processCommand(randomCommand);
      }, 2000);
    }
  }, [recognition]);

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
