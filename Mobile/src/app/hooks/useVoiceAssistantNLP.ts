import { useState, useEffect, useCallback, useRef } from 'react';

type AssistantStatus = 'idle' | 'listening' | 'processing' | 'success' | 'error' | 'awaiting_confirmation';

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
  transaction_id?: string;
  message?: string;
  audio_base64?: string;
  requires_confirmation?: boolean;
  data?: any;
}

interface VoiceHookReturn {
  status: AssistantStatus;
  transcript: string;
  feedback: string;
  parsedIntent: ParsedResponse | null;
  startListening: () => void;
  stopListening: () => void;
  confirmAction: () => void;
  cancelAction: () => void;
  isListening: boolean;
}

export function useVoiceAssistantNLP(
  nlpApiUrl: string = 'http://localhost:8000',
  jwtToken?: string
): VoiceHookReturn {
  const [status, setStatus] = useState<AssistantStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState('');
  const [parsedIntent, setParsedIntent] = useState<ParsedResponse | null>(null);
  const [isListening, setIsListening] = useState(false);
  const statusRef = useRef<AssistantStatus>('idle');
  
  // MediaRecorder pour audio brut
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Web Speech Recognition fallback
  const recognitionRef = useRef<any>(null);
  
  // Token JWT
  const tokenRef = useRef<string | null>(null);
  
  // Transaction ID pour confirmation
  const transactionIdRef = useRef<string | null>(null);

  // Initialiser token JWT
  useEffect(() => {
    tokenRef.current = jwtToken || localStorage.getItem('auth_token');
  }, [jwtToken]);

  // Initialiser la reconnaissance vocale
  useEffect(() => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'fr-FR';

      rec.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
      };

      recognitionRef.current = rec;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  /**
   * 🎤 Démarrer l'enregistrement audio brut
   */
  const startListening = useCallback(async () => {
    try {
      // Demander l'accès au microphone
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      
      streamRef.current = stream;
      
      // Créer MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus' // fallback will handle if not supported
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      // Collecter les chunks audio
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      // Lorsque l'enregistrement est terminé
      mediaRecorder.onstop = async () => {
        // Construire le Blob audio
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        console.log(`🎵 Audio enregistré: ${audioBlob.size} bytes`);
        
        // Envoyer à l'API backend
        await sendAudioToBackend(audioBlob);
      };
      
      mediaRecorder.start();
      setStatus('listening');
      setIsListening(true);
      setFeedback('Je vous écoute...');
      setTranscript('');
      setParsedIntent(null);
      
      console.log('✅ Enregistrement démarré');
      
      // Auto-stop après 15 secondes max
      const timeout = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          console.log('⏱️ Arrêt auto (15s)');
          stopListening();
        }
      }, 15000);
      
      return () => clearTimeout(timeout);
      
    } catch (error: any) {
      console.error('❌ Erreur accès microphone:', error);
      setStatus('error');
      setFeedback('Accès au microphone refusé. Vérifiez les permissions.');
      speakFeedback('Accès au microphone refusé.');
    }
  }, []);

  /**
   * ⏹️ Arrêter l'enregistrement audio
   */
  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      
      // Arrêter le stream microphone
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      setIsListening(false);
      setStatus('processing');
      console.log('⏹️ Enregistrement arrêté');
    }
  }, []);

  /**
   * 📤 Envoyer l'audio au backend
   */
  const sendAudioToBackend = async (audioBlob: Blob) => {
    try {
      console.log('📤 Envoi audio au backend...');
      
      // FormData pour uploader le fichier
      const formData = new FormData();
      formData.append('audio_file', audioBlob, 'audio.webm');
      
      // Headers avec JWT
      const headers: any = {};
      if (tokenRef.current) {
        headers['Authorization'] = `Bearer ${tokenRef.current}`;
      }
      
      const response = await fetch(`${nlpApiUrl}/api/voice-command`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }

      const result: ParsedResponse = await response.json();
      console.log('✅ Backend response:', result);
      
      // Sauvegarder l'intent parsé
      setParsedIntent(result);
      setTranscript(result.understood_text || '');
      
      // Sauvegarder le transaction_id si présent (pour confirmation)
      if (result.transaction_id) {
        transactionIdRef.current = result.transaction_id;
        console.log(`💾 Transaction ID: ${result.transaction_id}`);
      }
      
      // Afficher le message de réponse
      const message = result.message || result.confirmation_message || 'Action exécutée';
      setFeedback(message);
      
      // Jouer l'audio de réponse s'il existe
      if (result.audio_base64) {
        await playAudioResponse(result.audio_base64);
      } else {
        // Sinon utiliser TTS pour le message
        speakFeedback(message);
      }
      
      // Gérer l'état selon si confirmation nécessaire
      if (result.requires_confirmation) {
        console.log('⏳ Attente de confirmation pour:', result.intent);
        setStatus('awaiting_confirmation');
      } else {
        setStatus('success');
        // Reset à idle après 3s
        setTimeout(() => {
          if (statusRef.current === 'success') {
            setStatus('idle');
          }
        }, 3000);
      }
      
    } catch (error) {
      console.error('❌ Erreur envoi audio:', error);
      setStatus('error');
      const errorMsg = 'Erreur lors du traitement audio. Veuillez réessayer.';
      setFeedback(errorMsg);
      speakFeedback(errorMsg);
      
      setTimeout(() => setStatus('idle'), 5000);
    }
  };

  /**
   * 🔊 Jouer l'audio de réponse (base64)
   */
  const playAudioResponse = async (base64Audio: string): Promise<void> => {
    return new Promise((resolve) => {
      try {
        console.log('🔊 Lecture audio de réponse...');
        
        // Décoder base64 vers ArrayBuffer
        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Créer Blob et jouer
        const audioBlob = new Blob([bytes.buffer], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          console.log('✅ Audio terminé');
          resolve();
        };
        
        audio.onerror = (error) => {
          console.error('❌ Erreur lecture audio:', error);
          URL.revokeObjectURL(audioUrl);
          resolve(); // Continuer même si erreur
        };
        
        audio.play().catch(err => {
          console.error('❌ Erreur play():', err);
          resolve(); // Continuer même si erreur
        });
        
        // Timeout si audio ne termine pas
        setTimeout(resolve, 30000);
        
      } catch (error) {
        console.error('❌ Erreur décodage audio:', error);
        resolve(); // Continuer même si erreur
      }
    });
  };

  /**
   * 🔊 TTS Fallback
   */
  const speakFeedback = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fr-FR';
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 0.8;
      
      window.speechSynthesis.speak(utterance);
      console.log('💬 TTS:', text);
    }
  };

  /**
   * ✅ Confirmer une action
   */
  const confirmAction = useCallback(async () => {
    if (!transactionIdRef.current) {
      console.warn('❌ Pas de transaction_id pour confirmer');
      return;
    }

    try {
      console.log(`✅ Confirmation de transaction: ${transactionIdRef.current}`);
      
      const headers: any = {
        'Content-Type': 'application/json',
      };
      if (tokenRef.current) {
        headers['Authorization'] = `Bearer ${tokenRef.current}`;
      }

      const response = await fetch(`${nlpApiUrl}/api/confirm`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          transaction_id: transactionIdRef.current,
        }),
      });

      if (!response.ok) {
        throw new Error(`Confirmation error: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Action confirmée:', result);
      
      setFeedback(result.message || 'Action confirmée');
      speakFeedback(result.message || 'Action confirmée');
      
      setStatus('success');
      transactionIdRef.current = null;
      
      setTimeout(() => setStatus('idle'), 3000);
      
    } catch (error) {
      console.error('❌ Erreur confirmation:', error);
      setFeedback('Erreur lors de la confirmation.');
      speakFeedback('Erreur lors de la confirmation.');
      setStatus('error');
    }
  }, [nlpApiUrl]);

  /**
   * ❌ Annuler une action
   */
  const cancelAction = useCallback(async () => {
    if (!transactionIdRef.current) {
      console.warn('❌ Pas de transaction_id pour annuler');
      return;
    }

    try {
      console.log(`❌ Annulation de transaction: ${transactionIdRef.current}`);
      
      const headers: any = {
        'Content-Type': 'application/json',
      };
      if (tokenRef.current) {
        headers['Authorization'] = `Bearer ${tokenRef.current}`;
      }

      const response = await fetch(`${nlpApiUrl}/api/cancel`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          transaction_id: transactionIdRef.current,
        }),
      });

      if (!response.ok) {
        throw new Error(`Cancel error: ${response.status}`);
      }

      const result = await response.json();
      console.log('❌ Action annulée:', result);
      
      setFeedback(result.message || 'Action annulée');
      speakFeedback(result.message || 'Action annulée');
      
      setStatus('idle');
      transactionIdRef.current = null;
      
    } catch (error) {
      console.error('❌ Erreur annulation:', error);
      setFeedback('Erreur lors de l\'annulation.');
      speakFeedback('Erreur lors de l\'annulation.');
      setStatus('error');
    }
  }, [nlpApiUrl]);

  return {
    status,
    transcript,
    feedback,
    parsedIntent,
    startListening,
    stopListening,
    confirmAction,
    cancelAction,
    isListening,
  };
}
