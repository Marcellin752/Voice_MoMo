import { useState, useEffect, useCallback, useRef } from 'react';
import { executeVoiceCommand } from '../services/ussd.service';


type AssistantStatus = 'idle' | 'listening' | 'processing' | 'success' | 'error' | 'awaiting_confirmation' | 'awaiting_disambiguation';

interface ParsedResponse {
  success: boolean;
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
  ambiguityContacts: any[] | null;
  ambiguityQuery: string;
  resolveAmbiguity: (contact: { name: string; phone: string }) => void;
}

export function useVoiceAssistantNLP(
  // @ts-ignore - Vite environment variables
  nlpApiUrl: string = (import.meta.env.VITE_VOICE_AI_URL as string | undefined) || 'http://localhost:8000',
  jwtToken?: string
): VoiceHookReturn {
  const [status, setStatus] = useState<AssistantStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState('');
  const [parsedIntent, setParsedIntent] = useState<ParsedResponse | null>(null);
  const [isListening, setIsListening] = useState(false);
  const statusRef = useRef<AssistantStatus>('idle');
  
  // Nouveaux états pour la désambiguïsation
  const [ambiguityContacts, setAmbiguityContacts] = useState<any[] | null>(null);
  const [ambiguityQuery, setAmbiguityQuery] = useState('');
  const ambiguityContextRef = useRef<{ intent: string; data: any } | null>(null);
  
  // MediaRecorder pour audio brut
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recorderMimeTypeRef = useRef<string>('audio/webm');
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

  // Charger les voix TTS au démarrage + workaround bug Chrome
  useEffect(() => {
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        console.log('🎙️ [TTS] Voix chargées:', voices.length);
        const frenchVoices = voices.filter(v => v.lang.startsWith('fr'));
        console.log('🇫🇷 [TTS] Voix françaises:', frenchVoices.map(v => v.name));
      };
      
      // Charger immédiatement si déjà disponibles
      loadVoices();
      
      // Écouter le chargement asynchrone des voix (Chrome)
      window.speechSynthesis.onvoiceschanged = loadVoices;
      
      // 🔧 Workaround bug Chrome: empêcher TTS de s'arrêter après inactivité
      const keepAliveInterval = setInterval(() => {
        if (window.speechSynthesis.paused) {
          console.log('🔧 [TTS] Resume after pause');
          window.speechSynthesis.resume();
        }
      }, 5000);
      
      return () => {
        window.speechSynthesis.onvoiceschanged = null;
        clearInterval(keepAliveInterval);
      };
    }
  }, []);

  /**
   * 🎤 Démarrer l'enregistrement audio brut
   */
  const startListening = useCallback(async () => {
    try {
      console.log('🎤 [START] Demande d\'accès microphone...');
      
      // Request native Android permissions via Capacitor before web access
      try {
        const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
        await SpeechRecognition.requestPermissions();
        console.log('✅ [NATIVE] Capacitor permissions demandées');
      } catch (e) {
        console.warn('⚠️ [NATIVE] Impossible de demander les permissions Capacitor (peut-être sur web)', e);
      }
      
      // 🔔 Réveiller l'audio context (nécessaire pour l'autoplay sur mobile)
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel(); // Réinitialise l'état
        // Petit "blip" silencieux pour débloquer l'audio
        const unlockUtterance = new SpeechSynthesisUtterance('');
        unlockUtterance.volume = 0;
        window.speechSynthesis.speak(unlockUtterance);
        console.log('🔓 [AUDIO] Contexte audio débloqué');
      }
      
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
      recorderMimeTypeRef.current = selectedMimeType || mediaRecorder.mimeType || 'audio/webm';
      
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
        // Conserver le vrai MIME type pour éviter d'envoyer un faux WAV
        const mimeType = recorderMimeTypeRef.current || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const audioExtension = mimeType.includes('webm')
          ? 'webm'
          : mimeType.includes('wav')
          ? 'wav'
          : mimeType.includes('ogg') || mimeType.includes('opus')
          ? 'ogg'
          : mimeType.includes('mp4') || mimeType.includes('aac')
          ? 'm4a'
          : 'webm';

        console.log(`🎵 [SUCCESS] Audio enregistré: ${audioBlob.size} bytes (${mimeType})`);
        if (audioBlob.size === 0) {
          console.error('❌ [ERROR] Audio blob est vide!');
          setStatus('error');
          setFeedback('Erreur: aucun audio enregistré. Réessayez.');
          return;
        }
        
        // Envoyer à l'API backend
        await sendAudioToBackend(audioBlob, `audio.${audioExtension}`);
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
      
      // Détection du silence pour arrêt automatique ultra-rapide (après 800ms de silence)
      const silenceConfig = {
        // @ts-ignore - Vite environment variables
        silenceThreshold: Number((import.meta.env.VITE_SILENCE_THRESHOLD as string | undefined) || 0.015),
        // @ts-ignore - Vite environment variables
        silenceDurationMs: Number((import.meta.env.VITE_SILENCE_DURATION_MS as string | undefined) || 800),
        // @ts-ignore - Vite environment variables
        maxRecordingMs: Number((import.meta.env.VITE_MAX_RECORDING_TIME_MS as string | undefined) || 15000),
      };
      
      let lastSoundTime = Date.now();
      let silenceDetected = false;
      
      // Démarrer le monitoring du silence avec l'analyseur connecté en temps réel
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512; // Plus petit fftSize pour une réactivité optimale
        source.connect(analyser);
        
        const dataArray = new Uint8Array(analyser.fftSize);
        
        const checkSilence = () => {
          if (mediaRecorderRef.current?.state !== 'recording') return;
          
          analyser.getByteTimeDomainData(dataArray);
          
          // Calcul correct du RMS (Root Mean Square) sur les échantillons dans le domaine temporel
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const normalized = (dataArray[i] - 128) / 128;
            sum += normalized * normalized;
          }
          const rms = Math.sqrt(sum / dataArray.length);
          
          if (rms > silenceConfig.silenceThreshold) {
            lastSoundTime = Date.now();
            if (silenceDetected) {
              silenceDetected = false;
            }
          } else {
            const silenceDuration = Date.now() - lastSoundTime;
            if (silenceDuration > silenceConfig.silenceDurationMs && !silenceDetected) {
              console.log(`🔇 [AUDIO-END] Parole terminée. Arrêt auto après ${silenceDuration}ms (RMS: ${rms.toFixed(4)})`);
              silenceDetected = true;
              stopListening();
              return;
            }
          }
          
          requestAnimationFrame(checkSilence);
        };
        
        requestAnimationFrame(checkSilence);
      } catch (e) {
        console.warn('⚠️ [AUDIO] Impossible de configurer AudioContext pour le silence:', e);
      }
      
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
   * ⏹️ Arrêter l'enregistrement audio et fermer proprement l'AudioContext
   */
  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      
      // Libérer le flux microphone
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // Nettoyer et détruire proprement l'AudioContext pour éviter les fuites de mémoire
      if (audioContextRef.current) {
        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(console.error);
        }
        audioContextRef.current = null;
      }
      
      setIsListening(false);
      setStatus('processing');
      console.log('⏹️ Enregistrement arrêté et AudioContext libéré.');
    }
  }, []);

  /**
   * 🚀 Déclencher l'exécution USSD locale
   */
  const triggerUSSD = async (
    intent: string,
    data: any
  ): Promise<{ success: boolean; message: string; dialerFallback?: boolean; ambiguity?: any[] }> => {
    if (!intent || intent === 'unknown' || intent === 'confirm' || intent === 'cancel') {
      console.log(`ℹ️ [USSD] Intent ignoré: ${intent}`);
      return { success: true, message: '' };
    }

    console.log(`📱 [USSD] Lancement local pour intent: ${intent}`);

    try {
      const ussdResult = await executeVoiceCommand(intent, {
        amount: data?.amount,
        recipient: data?.recipient,
      });
      console.log('✅ [USSD] Résultat:', ussdResult);

      if (ussdResult.success) {
        setFeedback(ussdResult.message);
        return ussdResult;
      }
      
      // Gestion spécifique de l'ambiguïté des contacts
      if ((ussdResult as any).ambiguity) {
        console.log('🤔 [USSD] Ambiguïté détectée pour:', data?.recipient);
        setAmbiguityContacts((ussdResult as any).ambiguity);
        setAmbiguityQuery(data?.recipient || 'Contact');
        ambiguityContextRef.current = { intent, data };
        setStatus('awaiting_disambiguation');
        setFeedback('Plusieurs contacts correspondent. Veuillez choisir.');
        speakFeedback('Plusieurs contacts correspondent. Veuillez en choisir un sur l\'écran.');
        return { ...ussdResult, success: false };
      }

      setFeedback(ussdResult.message);
      alert(`Échec USSD: ${ussdResult.message}`);
      return { ...ussdResult, success: false };
    } catch (ussdError: any) {
      console.error('❌ [USSD] Erreur lors du lancement USSD:', ussdError);
      const msg = ussdError?.message || 'Erreur USSD';
      setFeedback(msg);
      alert(`Erreur critique USSD: ${msg}`);
      return { success: false, message: msg };
    }
  };

  /**
   * 📤 Envoyer l'audio au backend
   */
  const sendAudioToBackend = async (audioBlob: Blob, filename: string = 'audio.webm') => {
    try {
      console.log('📤 [START] Envoi audio au backend...');
      console.log(`   URL: ${nlpApiUrl}/api/voice-command`);
      console.log(`   Size: ${audioBlob.size} bytes`);
      console.log(`   Type: ${audioBlob.type}`);
      console.log(`   File: ${filename}`);
      
      // FormData pour uploader le fichier
      const formData = new FormData();
      formData.append('audio_file', audioBlob, filename);
      
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
      console.log(`   Needs confirmation: ${result.needs_confirmation}`);
      
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

      const moneyIntents = new Set(['transfer', 'deposit', 'momo_send', 'momo_deposit']);

      // Gérer l'état selon si confirmation nécessaire
      if (result.needs_confirmation) {
        console.log(`⏳ [STATE] Attente de confirmation pour: ${result.intent}`);
        // TTS / audio seulement quand on attend une confirmation (pas encore d'USSD)
        if (result.audio_base64) {
          console.log('🔊 [AUDIO] Audio de réponse trouvé, lecture...');
          await playAudioResponse(result.audio_base64);
        } else {
          console.log('💬 [TTS] Pas d\'audio de réponse, utilisation TTS');
          speakFeedback(message);
        }
        setStatus('awaiting_confirmation');
      } else {
        console.log(`✅ [STATE] Action réussie: ${result.intent}`);
        setStatus('success');

        if (result.success && result.intent !== 'help') {
          const ussdResult = await triggerUSSD(result.intent, result.data || result);
          if (!ussdResult.success) {
            setStatus('error');
            speakFeedback(ussdResult.message);
          } else if (moneyIntents.has(result.intent)) {
            const spoken = ussdResult.dialerFallback
              ? ussdResult.message
              : ussdResult.message ||
                'Demande envoyée à MTN. Validez avec votre code PIN si une fenêtre apparaît.';
            setFeedback(spoken);
            speakFeedback(spoken);
          } else if (result.audio_base64) {
            await playAudioResponse(result.audio_base64);
          } else {
            speakFeedback(message);
          }
        } else {
          if (result.audio_base64) {
            await playAudioResponse(result.audio_base64);
          } else {
            speakFeedback(message);
          }
        }

        // Reset à idle après 3s
        setTimeout(() => {
          if (statusRef.current === 'success' || statusRef.current === 'error') {
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
   * 🔊 TTS Fallback avec gestion des voix
   */
  const speakFeedback = async (text: string) => {
    try {
      const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
      await TextToSpeech.speak({
        text: text,
        lang: 'fr-FR',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
        category: 'ambient',
      });
      console.log('✅ [TTS] Texte lu via Capacitor:', text);
    } catch (e) {
      console.warn('⚠️ [TTS] Erreur plugin Capacitor, fallback Web Speech API', e);
      if (!('speechSynthesis' in window)) return;
      
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fr-FR';
      utterance.rate = 1;
      utterance.volume = 0.8;
      
      const voices = window.speechSynthesis.getVoices();
      const frenchVoice = voices.find(v => v.lang.startsWith('fr'));
      if (frenchVoice) utterance.voice = frenchVoice;
      
      window.speechSynthesis.speak(utterance);
    }
  };

  /**
   * ✅ Confirmer une action — appel JSON direct à /api/confirm
   */
  const confirmAction = useCallback(async () => {
    const txId = transactionIdRef.current;
    if (!txId) {
      console.warn('❌ [ERROR] Pas de transaction_id à confirmer');
      setFeedback('Erreur: pas d\'action à confirmer');
      return;
    }

    try {
      console.log(`✅ [START] Confirmation lancée — transaction_id: ${txId}`);
      setFeedback('Envoi de votre confirmation...');
      setStatus('processing');

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (tokenRef.current) headers['Authorization'] = `Bearer ${tokenRef.current}`;

      const response = await fetch(`${nlpApiUrl}/api/confirm`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ transaction_id: txId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erreur confirmation: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('📱 [BACKEND] Réponse confirmation:', result);

      const backendMsg = result.message || 'Transaction confirmée';
      const moneyIntents = new Set(['transfer', 'deposit', 'momo_send', 'momo_deposit']);
      const targetIntent = (result.intent || parsedIntent?.intent || '') as string;

      let ussdResult: { success: boolean; message: string; dialerFallback?: boolean } = {
        success: true,
        message: '',
      };

      if (result.success) {
        console.log(`✅ Confirmation réussie, déclenchement USSD pour: ${targetIntent}`);
        ussdResult = await triggerUSSD(targetIntent, result.data || result);
      } else {
        const err = result.message || 'Erreur serveur';
        alert(`Le backend a retourné une erreur: ${err}`);
        setFeedback(err);
        speakFeedback(err);
        setStatus('error');
        transactionIdRef.current = null;
        setParsedIntent(null);
        setTimeout(() => {
          if (statusRef.current === 'error') setStatus('idle');
        }, 5000);
        return;
      }

      if (!ussdResult.success) {
        setFeedback(ussdResult.message);
        speakFeedback(ussdResult.message);
        setStatus('error');
        transactionIdRef.current = null;
        setParsedIntent(null);
        setTimeout(() => {
          if (statusRef.current === 'error') setStatus('idle');
        }, 5000);
        return;
      }

      if (result.success && moneyIntents.has(targetIntent)) {
        const spoken = ussdResult.dialerFallback
          ? ussdResult.message
          : ussdResult.message ||
            'Demande envoyée à MTN. Validez avec votre code PIN si une fenêtre apparaît.';
        setFeedback(spoken);
        speakFeedback(spoken);
      } else if (result.success) {
        setFeedback(backendMsg);
        speakFeedback(backendMsg);
      }

      setStatus('success');
      transactionIdRef.current = null;
      setParsedIntent(null);
      setTimeout(() => {
        if (statusRef.current === 'success') setStatus('idle');
      }, 5000);

    } catch (error) {
      console.error('❌ [ERROR] Erreur lors de la confirmation:', error);
      const msg = 'Erreur lors du traitement de votre confirmation.';
      setFeedback(msg);
      speakFeedback(msg);
      setStatus('error');
      transactionIdRef.current = null;
      setTimeout(() => setStatus('idle'), 3000);
    }
  }, [nlpApiUrl, parsedIntent]);

  /**
   * ❌ Annuler une action
   */
  const cancelAction = useCallback(async () => {
    console.log('❌ [CANCEL] Action annulée par l\'utilisateur');
    
    setFeedback('Action annulée');
    speakFeedback('Action annulée');
    
    setStatus('idle');
    setParsedIntent(null);
    setAmbiguityContacts(null);
    ambiguityContextRef.current = null;
  }, []);

  /**
   * 🎯 Résoudre l'ambiguïté en fournissant le contact choisi
   */
  const resolveAmbiguity = useCallback(async (selectedContact: { name: string; phone: string }) => {
    const ctx = ambiguityContextRef.current;
    setAmbiguityContacts(null);
    ambiguityContextRef.current = null;
    
    if (!ctx) {
      setStatus('idle');
      return;
    }
    
    console.log(`✅ [RESOLVE] Contact sélectionné: ${selectedContact.name} (${selectedContact.phone})`);
    setStatus('processing');
    setFeedback(`Contact sélectionné. Je lance l'opération pour ${selectedContact.name}...`);
    
    // Injecter le numéro exact et forcer le passage sans ambiguïté
    const updatedData = {
      ...ctx.data,
      recipient: selectedContact.phone,
    };
    
    const ussdResult = await triggerUSSD(ctx.intent, updatedData);
    
    if (!ussdResult.success) {
      if (ussdResult.ambiguity) {
        // Ne devrait plus arriver car on a mis un numéro exact
        return;
      }
      setStatus('error');
      speakFeedback(ussdResult.message);
    } else {
      const moneyIntents = new Set(['transfer', 'deposit', 'momo_send', 'momo_deposit']);
      if (moneyIntents.has(ctx.intent)) {
        const spoken = ussdResult.dialerFallback
          ? ussdResult.message
          : ussdResult.message || 'Demande envoyée à MTN. Validez avec votre code PIN si une fenêtre apparaît.';
        setFeedback(spoken);
        speakFeedback(spoken);
      } else {
        speakFeedback(ussdResult.message);
      }
      setStatus('success');
      setTimeout(() => {
        if (statusRef.current === 'success') setStatus('idle');
      }, 5000);
    }
  }, []);

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
    ambiguityContacts,
    ambiguityQuery,
    resolveAmbiguity,
  };
}
