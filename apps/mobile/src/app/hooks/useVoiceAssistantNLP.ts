import { useState, useEffect, useCallback, useRef } from 'react';
import { executeVoiceCommand } from '../services/ussd.service';
import { useAuth } from '../contexts/AuthContext';
import {
  formatAmbiguityVoicePrompt,
  isCancelSpeech,
  isConfirmSpeech,
  matchContactFromSpeech,
} from '../utils/voiceSelection';
import {
  startProgressiveFeedback,
  NLP_PROCESSING_STEPS,
  USSD_PROCESSING_STEPS,
  type ProgressiveStep,
} from '../utils/progressiveFeedback';
import { playListeningStartCue } from '../utils/audioCues';
import {
  VOICE_BIOMETRIC_MAX_ATTEMPTS,
  hasVoiceBiometric,
  verifyVoiceBiometric,
  wipeSecret,
} from '../services/voiceBiometric.service';

type AssistantStatus =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'success'
  | 'error'
  | 'awaiting_confirmation'
  | 'awaiting_disambiguation'
  | 'awaiting_voice_biometric'
  | 'awaiting_pin';

const SENSITIVE_INTENTS = new Set([
  'transfer',
  'momo_send',
  'deposit',
  'momo_deposit',
  'withdraw',
  'withdraw_gab',
  'recharge',
  'bill_payment',
  'balance',
  'momo_balance',
  'internet_day',
  'internet_week',
  'internet_month',
  'internet_unlimited',
  'gopack_day',
  'gopack_week',
  'gopack_month',
]);

const BIOMETRIC_CHALLENGE = 'Je suis le propriétaire de ce compte Voice MoMo';

interface ParsedResponse {
  success: boolean;
  intent: string;
  amount?: number;
  recipient?: string;
  currency?: string;
  bill_type?: string;
  needs_confirmation: boolean;
  requires_confirmation?: boolean;
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
  closeAmbiguityModal: () => void;
  showPinModal: boolean;
  pinPrompt: string;
  executeTransferWithPin: (pin: string) => Promise<void>;
  cancelPinModal: () => void;
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

  const [ambiguityContacts, setAmbiguityContacts] = useState<any[] | null>(null);
  const [ambiguityQuery, setAmbiguityQuery] = useState('');
  const ambiguityContextRef = useRef<{ intent: string; data: any } | null>(null);
  const ambiguityContactsRef = useRef<any[] | null>(null);

  const { resetSessionActivity, logout } = useAuth();

  const [showPinModal, setShowPinModal] = useState(false);
  const [pinContext, setPinContext] = useState<{ intent: string; data: any } | null>(null);
  // Message contextuel affiché dans la modale PIN (transfert vs consultation solde)
  const [pinPrompt, setPinPrompt] = useState('Saisissez votre code PIN MTN sur le clavier (ne le dictez jamais).');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recorderMimeTypeRef = useRef<string>('audio/webm');
  const streamRef = useRef<MediaStream | null>(null);
  const tokenRef = useRef<string | null>(null);
  const transactionIdRef = useRef<string | null>(null);
  const biometricAttemptsRef = useRef(0);
  const biometricModeRef = useRef(false);
  const pendingAfterBiometricRef = useRef<null | (() => Promise<void>)>(null);
  const biometricTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const token = jwtToken || localStorage.getItem('momo.auth.token');
    tokenRef.current = token;
  }, [jwtToken]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const updateStatus = useCallback((newStatus: AssistantStatus) => {
    console.log(`[STATUS] ${statusRef.current} -> ${newStatus}`);
    setStatus(newStatus);
    statusRef.current = newStatus;
  }, []);

  // UX Fix #9: Reprise automatique après échec de compréhension (1 tentative max)
  const autoRetryRef = useRef(0);
  const startListeningRef = useRef<((isAutoRetry?: boolean) => void) | null>(null);

  // UX Fix #11: Epoch d'annulation — toute réponse arrivée après un "Annuler"
  // est ignorée pour ne pas déclencher l'USSD d'une transaction annulée
  const cancelEpochRef = useRef(0);

  // UX Fix #3: Feedback progressif pendant les traitements longs
  const stopProgressiveRef = useRef<(() => void) | null>(null);

  const beginProcessingFeedback = useCallback((steps: ProgressiveStep[] = NLP_PROCESSING_STEPS) => {
    stopProgressiveRef.current?.();
    stopProgressiveRef.current = startProgressiveFeedback(setFeedback, steps);
  }, []);

  const endProcessingFeedback = useCallback(() => {
    stopProgressiveRef.current?.();
    stopProgressiveRef.current = null;
  }, []);

  useEffect(() => {
    return () => { stopProgressiveRef.current?.(); };
  }, []);

  // Ré-arme le micro après une transition vers un état "en attente de réponse".
  // PAS pour awaiting_pin : le PIN se saisit uniquement au clavier (confidentialité).
  useEffect(() => {
    if (status !== 'awaiting_confirmation' && status !== 'awaiting_disambiguation' && status !== 'awaiting_voice_biometric') {
      return;
    }
    const delay = setTimeout(() => {
      startListeningRef.current?.(true);
    }, 1200);
    return () => clearTimeout(delay);
  }, [status]);

  const speakFeedback = async (text: string) => {
    try {
      const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
      // Coupe toute lecture en cours avant de démarrer la suivante : sans ça,
      // deux appels rapprochés peuvent se chevaucher et donner l'impression
      // que l'assistant coupe une phrase pour en démarrer une autre au milieu.
      await TextToSpeech.stop().catch(() => {});
      await TextToSpeech.speak({
        text: text,
        lang: 'fr-FR',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
        category: 'ambient',
      });
    } catch (e) {
      console.warn('⚠️ [TTS] Fallback Web Speech API', e);
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fr-FR';
      const voices = window.speechSynthesis.getVoices();
      const frenchVoice = voices.find(v => v.lang.startsWith('fr'));
      if (frenchVoice) utterance.voice = frenchVoice;
      window.speechSynthesis.speak(utterance);
    }
  };

  const playAudioResponse = async (base64Audio: string): Promise<void> => {
    return new Promise((resolve) => {
      try {
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const audioBlob = new Blob([bytes.buffer], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.onended = () => { URL.revokeObjectURL(audioUrl); resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(audioUrl); resolve(); };
        audio.play().catch(() => resolve());
        setTimeout(resolve, 30000);
      } catch (error) {
        console.error('❌ Erreur décodage audio:', error);
        resolve();
      }
    });
  };

  const requestVoiceBiometric = useCallback(async (onSuccess: () => Promise<void>) => {
    const enrolled = await hasVoiceBiometric();
    if (!enrolled) {
      updateStatus('error');
      const msg =
        'Empreinte vocale obligatoire. Allez dans Paramètres → Empreinte vocale pour enregistrer votre voix avant toute opération sensible.';
      setFeedback(msg);
      speakFeedback(msg);
      setTimeout(() => {
        if (statusRef.current === 'error') updateStatus('idle');
      }, 9000);
      return;
    }
    pendingAfterBiometricRef.current = onSuccess;
    biometricModeRef.current = true;
    updateStatus('awaiting_voice_biometric');
    const msg = `Vérification vocale. Dites : ${BIOMETRIC_CHALLENGE}`;
    setFeedback(msg);
    setTranscript('');
    speakFeedback(msg);
  }, [updateStatus]);

  const handleBiometricAudio = useCallback(async (audioBlob: Blob) => {
    biometricModeRef.current = false;
    updateStatus('processing');
    setFeedback('Vérification de votre voix…');
    try {
      const result = await verifyVoiceBiometric(audioBlob);
      if (!result.enrolled) {
        updateStatus('error');
        setFeedback('Aucune empreinte vocale. Enregistrez-la dans Paramètres.');
        speakFeedback('Aucune empreinte vocale. Enregistrez-la dans les paramètres.');
        setTimeout(() => updateStatus('idle'), 8000);
        return;
      }
      if (!result.matched) {
        biometricAttemptsRef.current += 1;
        const left = VOICE_BIOMETRIC_MAX_ATTEMPTS - biometricAttemptsRef.current;
        if (left <= 0) {
          updateStatus('error');
          setFeedback('Voix non reconnue. Sécurité : déconnexion.');
          speakFeedback('Voix non reconnue. Déconnexion pour protéger votre compte.');
          biometricAttemptsRef.current = 0;
          pendingAfterBiometricRef.current = null;
          setTimeout(() => logout(), 1500);
          return;
        }
        updateStatus('awaiting_voice_biometric');
        biometricModeRef.current = true;
        const msg = `Voix non reconnue. Il vous reste ${left} essai. Dites : ${BIOMETRIC_CHALLENGE}`;
        setFeedback(msg);
        speakFeedback(msg);
        return;
      }

      biometricAttemptsRef.current = 0;
      const next = pendingAfterBiometricRef.current;
      pendingAfterBiometricRef.current = null;
      if (next) await next();
    } catch (e: any) {
      updateStatus('error');
      setFeedback(e?.message || 'Échec de la vérification vocale.');
      speakFeedback('Échec de la vérification vocale. Réessayez.');
      setTimeout(() => updateStatus('idle'), 8000);
    }
  }, [logout, updateStatus]);

  const openSecurePinPrompt = useCallback((intent: string, data: any) => {
    setPinContext({ intent, data });
    setShowPinModal(true);
    updateStatus('awaiting_pin');

    if (data?.mode === 'balance') {
      const pinMsg = 'Pour consulter votre solde à jour, saisissez votre code PIN MTN sur le clavier (ne le dictez pas).';
      setPinPrompt(pinMsg);
      setFeedback(pinMsg);
      speakFeedback('Saisissez votre code PIN MTN sur le clavier pour consulter le solde.');
      return;
    }

    const amount = data?.amount || '...';
    const recipient = data?.recipientName || data?.phone || '...';
    const pinMsg = `Transfert de ${Number(amount).toLocaleString('fr-FR')} francs à ${recipient}. Saisissez votre code PIN MTN sur le clavier.`;
    setPinPrompt(pinMsg);
    setFeedback(pinMsg);
    speakFeedback('Saisissez votre code PIN MTN sur le clavier pour confirmer.');
  }, [updateStatus]);

  const triggerUSSD = useCallback(async (intent: string, data: any) => {
    if (!intent || ['unknown', 'confirm', 'cancel'].includes(intent)) return { success: true, message: '' };

    const run = async (): Promise<{ success: boolean; message?: string; isAwaiting?: boolean }> => {
      console.log(`📱 [USSD] Intent: ${intent}`, data);
      beginProcessingFeedback(USSD_PROCESSING_STEPS);
      try {
        const ussdResult = await executeVoiceCommand(intent, {
          amount: data?.amount,
          recipient: data?.recipient,
        });
        endProcessingFeedback();

        if (ussdResult.success) {
          return { success: true, message: ussdResult.message };
        }

        const resultAny = ussdResult as any;

        if (resultAny.ambiguity) {
          console.log('🤔 [USSD] Ambiguity detected');
          setAmbiguityContacts(resultAny.ambiguity);
          setAmbiguityQuery(data?.recipient || 'Contact');
          ambiguityContextRef.current = { intent, data };
          updateStatus('awaiting_disambiguation');
          const msg = formatAmbiguityVoicePrompt(resultAny.ambiguity, data?.recipient || 'ce nom');
          setFeedback(msg);
          speakFeedback(msg);
          return { success: false, isAwaiting: true };
        }

        if (resultAny.promptPin || resultAny.context?.mode === 'balance') {
          console.log('🔐 [USSD] PIN clavier requis (jamais vocal)');
          openSecurePinPrompt(intent, resultAny.context || { mode: 'balance' });
          return { success: false, isAwaiting: true };
        }

        return { success: false, message: ussdResult.message || 'Échec de l\'opération' };
      } catch (e: any) {
        endProcessingFeedback();
        console.error('❌ [USSD] Erreur:', e);
        return { success: false, message: e.message || 'Erreur USSD' };
      }
    };

    if (SENSITIVE_INTENTS.has(String(intent).toLowerCase())) {
      // Biométrie avant toute opération sensible ; le PIN clavier vient ensuite si besoin.
      await requestVoiceBiometric(async () => {
        const ussdRes = await run();
        if (ussdRes.success) {
          updateStatus('success');
          setFeedback(ussdRes.message || 'OK');
          speakFeedback(ussdRes.message || 'Opération lancée');
          setTimeout(() => {
            if (statusRef.current === 'success') updateStatus('idle');
          }, 8000);
        } else if (!ussdRes.isAwaiting) {
          updateStatus('error');
          setFeedback(ussdRes.message || 'Échec');
          speakFeedback(ussdRes.message || 'Échec');
          setTimeout(() => {
            if (statusRef.current === 'error') updateStatus('idle');
          }, 8000);
        }
      });
      return { success: false, isAwaiting: true };
    }

    return run();
  }, [updateStatus, beginProcessingFeedback, endProcessingFeedback, requestVoiceBiometric, openSecurePinPrompt]);

  const sendAudioToBackend = async (audioBlob: Blob, filename: string = 'audio.webm') => {
    const epoch = cancelEpochRef.current;
    const captureStatus = statusRef.current;
    resetSessionActivity();
    try {
      updateStatus('processing');
      // UX Fix #3: Messages d'attente échelonnés pendant l'analyse vocale
      beginProcessingFeedback(NLP_PROCESSING_STEPS);
      const formData = new FormData();
      formData.append('audio_file', audioBlob, filename);
      const headers: any = {};
      if (tokenRef.current) headers['Authorization'] = `Bearer ${tokenRef.current}`;

      const response = await fetch(`${nlpApiUrl}/api/voice-command`, { method: 'POST', headers, body: formData });
      if (!response.ok) {
        if (response.status === 401) {
          await logout();
          updateStatus('idle');
          endProcessingFeedback();
          setFeedback('Session expirée. Veuillez vous reconnecter.');
          speakFeedback('Votre session a expiré. Veuillez vous reconnecter.');
          return;
        }
        throw new Error(`Erreur backend: ${response.status}`);
      }

      const result: ParsedResponse = await response.json();
      endProcessingFeedback();

      const understood = result.understood_text || '';

      // PIN : jamais traité par la voix / NLP
      if (captureStatus === 'awaiting_pin') {
        updateStatus('awaiting_pin');
        setFeedback('Utilisez le clavier pour saisir votre PIN. Ne le dictez jamais.');
        speakFeedback('Utilisez le clavier pour votre code PIN.');
        return;
      }

      if (captureStatus === 'awaiting_disambiguation' && ambiguityContactsRef.current?.length) {
        const match = matchContactFromSpeech(understood, ambiguityContactsRef.current);
        if (match) {
          await resolveAmbiguity(match);
          return;
        }
        const msg = formatAmbiguityVoicePrompt(ambiguityContactsRef.current, ambiguityQuery);
        updateStatus('awaiting_disambiguation');
        setFeedback(msg);
        speakFeedback('Je n\'ai pas reconnu ce contact. ' + msg);
        return;
      }

      if (captureStatus === 'awaiting_confirmation') {
        if (result.intent === 'confirm' || isConfirmSpeech(understood)) {
          await confirmAction();
          return;
        }
        if (result.intent === 'cancel' || isCancelSpeech(understood)) {
          await cancelAction();
          return;
        }
        const msg = 'Dites oui pour confirmer, ou non pour annuler.';
        updateStatus('awaiting_confirmation');
        setFeedback(msg);
        speakFeedback(msg);
        return;
      }

      // UX Fix #11: L'utilisateur a annulé pendant l'analyse → ne rien exécuter
      if (epoch !== cancelEpochRef.current) {
        console.log('🛑 [NLP] Réponse ignorée : annulée par l\'utilisateur');
        return;
      }

      setParsedIntent(result);
      setTranscript(result.understood_text || '');
      if (result.transaction_id) transactionIdRef.current = result.transaction_id;

      const feedbackMsg = result.message || result.confirmation_message || 'Action exécutée';
      setFeedback(feedbackMsg);

      // UX Fix #11: Commande vocale "stop" / "annule" → annuler la transaction active
      if (result.intent === 'cancel') {
        autoRetryRef.current = 0;
        const { cancelActiveTransaction } = await import('../services/ussd_engine/MoMoTransactionEngine');
        const cancelRes = cancelActiveTransaction();
        const msg = cancelRes.cancelled ? cancelRes.message : (result.message || 'Action annulée.');
        updateStatus('success');
        setFeedback(msg);
        speakFeedback(msg);
        setParsedIntent(null);
        setTimeout(() => { if (statusRef.current === 'success') updateStatus('idle'); }, 8000);
        return;
      }

      if (result.needs_confirmation || result.requires_confirmation) {
        autoRetryRef.current = 0;
        if (result.audio_base64) await playAudioResponse(result.audio_base64);
        else speakFeedback(feedbackMsg);
        updateStatus('awaiting_confirmation');
      } else {
        if (result.success && result.intent !== 'help') {
          autoRetryRef.current = 0;
          const ussdRes = await triggerUSSD(result.intent, result.data || result);
          if (ussdRes.success) {
            updateStatus('success');
            const spoken = ussdRes.message || 'Opération réussie.';
            setFeedback(spoken);
            speakFeedback(spoken);
            // UX Fix #13: Délai plus long pour lire le message
        setTimeout(() => { if (statusRef.current === 'success') updateStatus('idle'); }, 8000);
          } else if (!(ussdRes as any).isAwaiting) {
            updateStatus('error');
            const spoken = ussdRes.message || 'Une erreur est survenue.';
            setFeedback(spoken);
            speakFeedback(spoken);
            // UX Fix #13: Délai plus long pour lire le message
        setTimeout(() => { if (statusRef.current === 'error') updateStatus('idle'); }, 8000);
          }
        } else {
          const notUnderstood = !result.success || result.intent === 'unknown';

          // UX Fix #9: Reprise automatique de l'écoute après échec de compréhension
          if (notUnderstood && autoRetryRef.current < 1) {
            autoRetryRef.current += 1;
            updateStatus('error');
            if (result.audio_base64) await playAudioResponse(result.audio_base64);
            else await speakFeedback(feedbackMsg);
            if (epoch !== cancelEpochRef.current) return;
            setFeedback("J'écoute à nouveau...");
            startListeningRef.current?.(true);
            return;
          }

          if (!notUnderstood) autoRetryRef.current = 0;
          updateStatus(notUnderstood ? 'error' : 'success');
          if (result.audio_base64) await playAudioResponse(result.audio_base64);
          else speakFeedback(feedbackMsg);
          // UX Fix #13: Délai plus long pour lire le message
          setTimeout(() => { if (statusRef.current === 'success' || statusRef.current === 'error') updateStatus('idle'); }, 8000);
        }
      }
    } catch (error: any) {
      endProcessingFeedback();
      console.error('❌ Erreur audio:', error);
      updateStatus('error');
      // UX: Message humain, pas de code d'erreur technique
      setFeedback("Je n'ai pas pu traiter votre demande. Vérifiez votre connexion internet et réessayez.");
      // UX Fix #13: Délai plus long
      setTimeout(() => updateStatus('idle'), 8000);
    }
  };

  // UX Fix #9: `isAutoRetry === true` uniquement lors d'une relance automatique
  // (un clic utilisateur passe un event en premier argument → compteur remis à zéro)
  const startListening = useCallback(async (isAutoRetry?: unknown) => {
    if (isAutoRetry !== true) autoRetryRef.current = 0;
    // Pendant la saisie PIN : micro désactivé (confidentialité)
    if (statusRef.current === 'awaiting_pin' || showPinModal) {
      setFeedback('Saisissez votre PIN sur le clavier uniquement.');
      return;
    }
    resetSessionActivity();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      recorderMimeTypeRef.current = mediaRecorder.mimeType || 'audio/webm';
      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recorderMimeTypeRef.current });
        if (audioBlob.size <= 0) return;
        // Biométrie : traitement 100 % local, jamais envoyé au NLP
        if (biometricModeRef.current || statusRef.current === 'awaiting_voice_biometric') {
          await handleBiometricAudio(audioBlob);
          return;
        }
        await sendAudioToBackend(audioBlob);
      };
      mediaRecorder.start();
      updateStatus(biometricModeRef.current ? 'awaiting_voice_biometric' : 'listening');
      setIsListening(true);
      playListeningStartCue();
      if (biometricModeRef.current) {
        setFeedback(`Dites : ${BIOMETRIC_CHALLENGE}`);
        if (biometricTimerRef.current) clearTimeout(biometricTimerRef.current);
        biometricTimerRef.current = setTimeout(() => {
          if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
            streamRef.current?.getTracks().forEach((t) => t.stop());
            setIsListening(false);
          }
        }, 3500);
      } else {
        setFeedback('Je vous écoute... Dites par exemple: "Envoie 5000 à Maman"');
      }
    } catch (e: any) {
      updateStatus('error');
      setFeedback('Microphone inaccessible');
    }
  }, [updateStatus, showPinModal, handleBiometricAudio, resetSessionActivity]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
      setIsListening(false);
      updateStatus('processing');
    }
  }, [updateStatus]);

  const confirmAction = useCallback(async () => {
    if (!transactionIdRef.current) return;
    const epoch = cancelEpochRef.current;
    try {
      updateStatus('processing');
      // UX Fix #3: Messages d'attente échelonnés pendant la confirmation
      beginProcessingFeedback(NLP_PROCESSING_STEPS);
      const headers: any = { 'Content-Type': 'application/json' };
      if (tokenRef.current) headers['Authorization'] = `Bearer ${tokenRef.current}`;
      const response = await fetch(`${nlpApiUrl}/api/confirm`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ transaction_id: transactionIdRef.current }),
      });
      if (response.status === 401) {
        await logout();
        updateStatus('idle');
        endProcessingFeedback();
        setFeedback('Session expirée. Veuillez vous reconnecter.');
        speakFeedback('Votre session a expiré. Veuillez vous reconnecter.');
        return;
      }
      const result = await response.json();
      endProcessingFeedback();

      // UX Fix #11: L'utilisateur a annulé pendant la confirmation → ne pas lancer l'USSD
      if (epoch !== cancelEpochRef.current) {
        console.log('🛑 [NLP] Confirmation ignorée : annulée par l\'utilisateur');
        return;
      }

      if (!result.success) {
        updateStatus('error');
        setFeedback(result.message || 'Erreur confirmation');
        // UX Fix #13: Délai plus long pour lire le message
        setTimeout(() => { if (statusRef.current === 'error') updateStatus('idle'); }, 8000);
        return;
      }
      const ussdRes = await triggerUSSD(result.intent || parsedIntent?.intent, result.data || result);
      if (ussdRes.success) {
        updateStatus('success');
        setFeedback(ussdRes.message);
        speakFeedback(ussdRes.message);
        // UX Fix #13: Délai plus long pour lire le message
        setTimeout(() => { if (statusRef.current === 'success') updateStatus('idle'); }, 8000);
      } else if (!(ussdRes as any).isAwaiting) {
        updateStatus('error');
        setFeedback(ussdRes.message || 'Échec de la transaction');
        // UX Fix #13: Délai plus long pour lire le message
        setTimeout(() => { if (statusRef.current === 'error') updateStatus('idle'); }, 8000);
      }
    } catch (e) {
      endProcessingFeedback();
      updateStatus('error');
      // UX: Toujours expliquer ce qui s'est passé, même sur erreur inattendue
      setFeedback("La confirmation n'a pas abouti. Veuillez réessayer.");
      setTimeout(() => { if (statusRef.current === 'error') updateStatus('idle'); }, 5000);
    }
  }, [nlpApiUrl, parsedIntent, triggerUSSD, updateStatus, beginProcessingFeedback, endProcessingFeedback]);

  const cancelAction = useCallback(async () => {
    cancelEpochRef.current += 1;
    endProcessingFeedback();
    autoRetryRef.current = 0;
    biometricModeRef.current = false;
    pendingAfterBiometricRef.current = null;
    if (biometricTimerRef.current) {
      clearTimeout(biometricTimerRef.current);
      biometricTimerRef.current = null;
    }
    setParsedIntent(null);
    setAmbiguityContacts(null);
    setShowPinModal(false);
    try {
      const { cancelActiveTransaction } = await import('../services/ussd_engine/MoMoTransactionEngine');
      const res = cancelActiveTransaction();
      if (res.cancelled) {
        updateStatus('success');
        setFeedback(res.message);
        speakFeedback(res.message);
        setTimeout(() => { if (statusRef.current === 'success') updateStatus('idle'); }, 8000);
      } else {
        updateStatus('idle');
        setFeedback('Action annulée');
      }
    } catch (e) {
      console.warn('⚠️ [NLP] Annulation moteur impossible:', e);
      updateStatus('idle');
      setFeedback('Action annulée');
    }
  }, [updateStatus, endProcessingFeedback]);

  const closeAmbiguityModal = useCallback(() => {
    setAmbiguityContacts(null);
  }, []);

  const resolveAmbiguity = useCallback(async (contact: { name: string; phone: string }) => {
    const ctx = ambiguityContextRef.current;
    if (!ctx) return;
    closeAmbiguityModal(); // Fermer la modale sans annuler
    updateStatus('processing');
    beginProcessingFeedback(USSD_PROCESSING_STEPS);
    const ussdRes = await triggerUSSD(ctx.intent, { ...ctx.data, recipient: contact.phone });
    endProcessingFeedback();
    if (ussdRes.success) {
      updateStatus('success');
      setFeedback(ussdRes.message);
      speakFeedback(ussdRes.message);
      setTimeout(() => { if (statusRef.current === 'success') updateStatus('idle'); }, 8000);
    } else if (!(ussdRes as any).isAwaiting) {
      updateStatus('error');
      setFeedback(ussdRes.message || 'Échec de la transaction');
      speakFeedback(ussdRes.message);
      setTimeout(() => { if (statusRef.current === 'error') updateStatus('idle'); }, 8000);
    }
  }, [closeAmbiguityModal, triggerUSSD, updateStatus, beginProcessingFeedback, endProcessingFeedback, speakFeedback]);

  const executeTransferWithPin = useCallback(async (pin: string) => {
    if (!pinContext) return;
    const pinHolder = { value: pin };
    try {
      updateStatus('processing');
      beginProcessingFeedback(USSD_PROCESSING_STEPS);
      const { MoMoTransactionEngine } = await import('../services/ussd_engine/MoMoTransactionEngine');
      const engine = new MoMoTransactionEngine();

      if (pinContext.data?.mode === 'balance') {
        const res = await engine.checkBalanceWithPin(pinHolder.value);
        wipeSecret(pinHolder);
        endProcessingFeedback();
        setShowPinModal(false);
        updateStatus(res.status === 'success' ? 'success' : 'error');
        setFeedback(res.message);
        speakFeedback(res.message);
        setTimeout(() => {
          if (statusRef.current === 'success' || statusRef.current === 'error') updateStatus('idle');
        }, 8000);
        return;
      }

      const res = await engine.confirmWithPin(pinHolder.value, {
        phone: pinContext.data?.phone,
        amount: pinContext.data?.amount,
      });
      wipeSecret(pinHolder);
      endProcessingFeedback();
      setShowPinModal(false);
      if (res.status === 'success') {
        updateStatus('success');
        setFeedback(res.message);
        speakFeedback(res.message);
        setTimeout(() => { if (statusRef.current === 'success') updateStatus('idle'); }, 8000);
      } else {
        updateStatus('error');
        setFeedback(res.message);
        speakFeedback(res.message);
        setTimeout(() => { if (statusRef.current === 'error') updateStatus('idle'); }, 8000);
      }
    } catch (e) {
      wipeSecret(pinHolder);
      endProcessingFeedback();
      updateStatus('error');
      setFeedback("Le transfert n'a pas pu être lancé. Votre argent n'a pas été débité. Veuillez réessayer.");
      setTimeout(() => { if (statusRef.current === 'error') updateStatus('idle'); }, 5000);
    }
  }, [pinContext, updateStatus, beginProcessingFeedback, endProcessingFeedback]);

  return {
    status, transcript, feedback, parsedIntent, isListening, ambiguityContacts, ambiguityQuery, showPinModal, pinPrompt,
    startListening, stopListening, confirmAction, cancelAction,
    resolveAmbiguity, closeAmbiguityModal, executeTransferWithPin, cancelPinModal: cancelAction
  };
}
