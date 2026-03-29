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

  // Initializar token JWT
  useEffect(() => {
    const token = jwtToken || localStorage.getItem('momo.auth.token');
    tokenRef.current = token;
    console.log(`🔐 [AUTH] Token inicializado${token ? ': presente' : ': NO ENCONTRADO'}`);
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
      console.log('🎤 [START] Demande d\'accès microphone...');
      // Demander l'accès au microphone
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      
      console.log('✅ [AUDIO] Microphone accès autorisé');
      streamRef.current = stream;
      
      // Détecter les MIME types supportés
      const supportedMimeTypes = [
        'audio/webm',
        'audio/wav',
        'audio/ogg',
        'audio/mp4',
        'audio/webm;codecs=opus',
      ];
      
      let selectedMimeType = '';
      for (const mimeType of supportedMimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          console.log(`✅ [AUDIO] MIME type supporté: ${mimeType}`);
          break;
        }
      }
      
      if (!selectedMimeType) {
        // Fallback: créer sans spécifier le MIME type
        console.warn('⚠️ [AUDIO] Aucun MIME type spécifique supporté, utilisation du défaut du navigateur');
        selectedMimeType = '';
      }
      
      // Créer MediaRecorder
      const mediaRecorderOptions = selectedMimeType ? { mimeType: selectedMimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, mediaRecorderOptions);
      
      console.log(`📝 [AUDIO] MediaRecorder initié (format: ${selectedMimeType || 'default'})`);
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
        console.log('⏹️ [AUDIO] Enregistrement terminé, construction du Blob...');
        // Construire le Blob audio
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        console.log(`🎵 [SUCCESS] Audio enregistré: ${audioBlob.size} bytes (WAV format)`);
        if (audioBlob.size === 0) {
          console.error('❌ [ERROR] Audio blob est vide!');
          setStatus('error');
          setFeedback('Erreur: aucun audio enregistré. Réessayez.');
          return;
        }
        
        // Envoyer à l'API backend
        await sendAudioToBackend(audioBlob);
      };
      
      mediaRecorder.start();
      setStatus('listening');
      setIsListening(true);
      setFeedback('Je vous écoute...');
      setTranscript('');
      setParsedIntent(null);
      
      console.log('✅ [SUCCESS] Enregistrement démarré');
      setStatus('listening');
      setIsListening(true);
      setFeedback('Je vous écoute...');
      setTranscript('');
      setParsedIntent(null);
      
      // Auto-stop après 15 secondes max
      const timeout = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          console.log('⏱️ [TIMEOUT] Arrêt auto après 15s');
          stopListening();
        }
      }, 15000);
      
      return () => clearTimeout(timeout);
      
    } catch (error: any) {
      console.error('❌ [ERROR] Erreur accès microphone:', error);
      console.error('   Type:', error.name);
      console.error('   Message:', error.message);
      setStatus('error');
      const errorMsg = error.name === 'NotAllowedError' 
        ? 'Accès microphone refusé. Vérifiez les permissions du navigateur.'
        : error.name === 'NotFoundError'
        ? 'Aucun microphone trouvé.'
        : 'Erreur accès microphone: ' + error.message;
      setFeedback(errorMsg);
      console.error('📢 [FEEDBACK]', errorMsg);
      speakFeedback(errorMsg);
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
      console.log('📤 [START] Envoi audio au backend...');
      console.log(`   URL: ${nlpApiUrl}/api/voice-command`);
      console.log(`   Size: ${audioBlob.size} bytes`);
      console.log(`   Type: ${audioBlob.type}`);
      
      // FormData pour uploader le fichier
      const formData = new FormData();
      formData.append('audio_file', audioBlob, 'audio.wav');
      
      // Headers avec JWT
      const headers: any = {};
      if (tokenRef.current) {
        headers['Authorization'] = `Bearer ${tokenRef.current}`;
        console.log('🔐 [AUTH] Token JWT présent');
      } else {
        console.warn('⚠️ [AUTH] Pas de token JWT trouvé');
      }
      
      console.log('📡 [NETWORK] Envoi de la requête...');
      const response = await fetch(`${nlpApiUrl}/api/voice-command`, {
        method: 'POST',
        headers,
        body: formData,
      });

      console.log(`📥 [RESPONSE] Status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [ERROR] Backend error: ${response.status}`);
        console.error(`   Response body: ${errorText}`);
        throw new Error(`Backend error: ${response.status} - ${errorText}`);
      }

      const result: ParsedResponse = await response.json();
      console.log('✅ [SUCCESS] Réponse backend reçue');
      console.log(`   Intent: ${result.intent}`);
      console.log(`   Confidence: ${result.metadata?.confidence}`);
      console.log(`   Understood: "${result.understood_text}"`);
      console.log(`   Needs confirmation: ${result.requires_confirmation}`);
      
      // Sauvegarder l'intent parsé
      setParsedIntent(result);
      setTranscript(result.understood_text || '');
      
      // Sauvegarder le transaction_id si présent (pour confirmation)
      if (result.transaction_id) {
        transactionIdRef.current = result.transaction_id;
        console.log(`💾 [CACHE] Transaction ID: ${result.transaction_id}`);
      }
      
      // Afficher le message de réponse
      const message = result.message || result.confirmation_message || 'Action exécutée';
      console.log(`📢 [FEEDBACK] Message: "${message}"`);
      setFeedback(message);
      
      // Jouer l'audio de réponse s'il existe
      if (result.audio_base64) {
        console.log('🔊 [AUDIO] Audio de réponse trouvé, lecture...');
        await playAudioResponse(result.audio_base64);
      } else {
        console.log('💬 [TTS] Pas d\'audio de réponse, utilisation TTS');
        speakFeedback(message);
      }
      
      // Gérer l'état selon si confirmation nécessaire
      if (result.requires_confirmation) {
        console.log(`⏳ [STATE] Attente de confirmation pour: ${result.intent}`);
        setStatus('awaiting_confirmation');
      } else {
        console.log(`✅ [STATE] Action réussie: ${result.intent}`);
        setStatus('success');
        // Reset à idle après 3s
        setTimeout(() => {
          if (statusRef.current === 'success') {
            console.log('[STATE] Reset to idle');
            setStatus('idle');
          }
        }, 3000);
      }
      
    } catch (error) {
      console.error('❌ [ERROR] Erreur envoi audio:');
      console.error('   Type:', (error as any)?.name);
      console.error('   Message:', (error as any)?.message);
      console.error('   Stack:', (error as any)?.stack);
      setStatus('error');
      const errorMsg = (error as any)?.message || 'Erreur lors du traitement audio. Veuillez réessayer.';
      setFeedback(errorMsg);
      console.error(`📢 [FEEDBACK] ERROR: ${errorMsg}`);
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
      console.warn('❌ [ERROR] Pas de transaction_id pour confirmer');
      setFeedback('Erreur: pas de transaction à confirmer');
      return;
    }

    try {
      console.log(`✅ [START] Confirmation de transaction: ${transactionIdRef.current}`);
      
      const headers: any = {
        'Content-Type': 'application/json',
      };
      if (tokenRef.current) {
        headers['Authorization'] = `Bearer ${tokenRef.current}`;
      }

      console.log('📡 [NETWORK] Envoi confirmation...');
      const response = await fetch(`${nlpApiUrl}/api/confirm`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          transaction_id: transactionIdRef.current,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [ERROR] Status ${response.status}: ${errorText}`);
        throw new Error(`Confirmation error: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ [SUCCESS] Action confirmée:', result);
      
      setFeedback(result.message || 'Action confirmée');
      speakFeedback(result.message || 'Action confirmée');
      
      setStatus('success');
      transactionIdRef.current = null;
      
      setTimeout(() => setStatus('idle'), 3000);
      
    } catch (error) {
      console.error('❌ [ERROR] Erreur confirmation:', error);
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
      console.warn('❌ [ERROR] Pas de transaction_id pour annuler');
      setFeedback('Erreur: pas de transaction à annuler');
      return;
    }

    try {
      console.log(`❌ [START] Annulation de transaction: ${transactionIdRef.current}`);
      
      const headers: any = {
        'Content-Type': 'application/json',
      };
      if (tokenRef.current) {
        headers['Authorization'] = `Bearer ${tokenRef.current}`;
      }

      console.log('📡 [NETWORK] Envoi annulation...');
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
