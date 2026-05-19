import { useState, useEffect, useCallback, useRef } from 'react';
import { executeVoiceCommand } from '../services/ussd.service';

type AssistantStatus = 'idle' | 'listening' | 'processing' | 'success' | 'error' | 'awaiting_confirmation' | 'awaiting_disambiguation' | 'awaiting_pin';

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
  showPinModal: boolean;
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

  const [showPinModal, setShowPinModal] = useState(false);
  const [pinContext, setPinContext] = useState<{ intent: string; data: any } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recorderMimeTypeRef = useRef<string>('audio/webm');
  const streamRef = useRef<MediaStream | null>(null);
  const tokenRef = useRef<string | null>(null);
  const transactionIdRef = useRef<string | null>(null);

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

  const triggerUSSD = useCallback(async (intent: string, data: any) => {
    if (!intent || ['unknown', 'confirm', 'cancel'].includes(intent)) return { success: true, message: '' };
    
    console.log(`📱 [USSD] Intent: ${intent}`, data);
    try {
      const ussdResult = await executeVoiceCommand(intent, {
        amount: data?.amount,
        recipient: data?.recipient,
      });

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
        const msg = `Plusieurs contacts trouvés pour '${data?.recipient || 'ce nom'}'. Veuillez choisir sur l'écran.`;
        setFeedback(msg);
        speakFeedback(msg);
        return { success: false, isAwaiting: true };
      }

      if (resultAny.promptPin) {
        console.log('🔐 [USSD] PIN prompt required');
        setPinContext({ intent, data: resultAny.context });
        setShowPinModal(true);
        updateStatus('awaiting_pin');
        const amount = resultAny.context?.amount || '...';
        const recipient = resultAny.context?.recipientName || resultAny.context?.phone || '...';
        const pinMsg = `Transfert de ${amount} FCFA à ${recipient}. Veuillez entrer votre code PIN.`;
        setFeedback(pinMsg);
        speakFeedback(`Veuillez entrer votre code PIN pour confirmer le transfert.`);
        return { success: false, isAwaiting: true };
      }

      return { success: false, message: ussdResult.message || 'Échec de l\'opération' };
    } catch (e: any) {
      console.error('❌ [USSD] Erreur:', e);
      return { success: false, message: e.message || 'Erreur USSD' };
    }
  }, [updateStatus]);

  const sendAudioToBackend = async (audioBlob: Blob, filename: string = 'audio.webm') => {
    try {
      updateStatus('processing');
      const formData = new FormData();
      formData.append('audio_file', audioBlob, filename);
      const headers: any = {};
      if (tokenRef.current) headers['Authorization'] = `Bearer ${tokenRef.current}`;

      const response = await fetch(`${nlpApiUrl}/api/voice-command`, { method: 'POST', headers, body: formData });
      if (!response.ok) throw new Error(`Erreur backend: ${response.status}`);

      const result: ParsedResponse = await response.json();
      setParsedIntent(result);
      setTranscript(result.understood_text || '');
      if (result.transaction_id) transactionIdRef.current = result.transaction_id;

      const feedbackMsg = result.message || result.confirmation_message || 'Action exécutée';
      setFeedback(feedbackMsg);

      if (result.needs_confirmation || result.requires_confirmation) {
        if (result.audio_base64) await playAudioResponse(result.audio_base64);
        else speakFeedback(feedbackMsg);
        updateStatus('awaiting_confirmation');
      } else {
        if (result.success && result.intent !== 'help') {
          const ussdRes = await triggerUSSD(result.intent, result.data || result);
          if (ussdRes.success) {
            updateStatus('success');
            const spoken = ussdRes.message || 'Opération réussie.';
            setFeedback(spoken);
            speakFeedback(spoken);
            setTimeout(() => { if (statusRef.current === 'success') updateStatus('idle'); }, 5000);
          } else if (!(ussdRes as any).isAwaiting) {
            updateStatus('error');
            const spoken = ussdRes.message || 'Une erreur est survenue.';
            setFeedback(spoken);
            speakFeedback(spoken);
            setTimeout(() => { if (statusRef.current === 'error') updateStatus('idle'); }, 5000);
          }
        } else {
          updateStatus('success');
          if (result.audio_base64) await playAudioResponse(result.audio_base64);
          else speakFeedback(feedbackMsg);
          setTimeout(() => { if (statusRef.current === 'success') updateStatus('idle'); }, 5000);
        }
      }
    } catch (error: any) {
      console.error('❌ Erreur audio:', error);
      updateStatus('error');
      setFeedback(error.message || 'Erreur de traitement');
      setTimeout(() => updateStatus('idle'), 5000);
    }
  };

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recorderMimeTypeRef.current });
        if (audioBlob.size > 0) await sendAudioToBackend(audioBlob);
      };
      mediaRecorder.start();
      updateStatus('listening');
      setIsListening(true);
      setFeedback('Je vous écoute...');
    } catch (e: any) {
      updateStatus('error');
      setFeedback('Microphone inaccessible');
    }
  }, [updateStatus]);

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
    try {
      updateStatus('processing');
      const headers: any = { 'Content-Type': 'application/json' };
      if (tokenRef.current) headers['Authorization'] = `Bearer ${tokenRef.current}`;
      const response = await fetch(`${nlpApiUrl}/api/confirm`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ transaction_id: transactionIdRef.current }),
      });
      const result = await response.json();
      if (!result.success) {
        updateStatus('error');
        setFeedback(result.message || 'Erreur confirmation');
        setTimeout(() => { if (statusRef.current === 'error') updateStatus('idle'); }, 5000);
        return;
      }
      const ussdRes = await triggerUSSD(result.intent || parsedIntent?.intent, result.data || result);
      if (ussdRes.success) {
        updateStatus('success');
        setFeedback(ussdRes.message);
        speakFeedback(ussdRes.message);
        setTimeout(() => { if (statusRef.current === 'success') updateStatus('idle'); }, 5000);
      } else if (!(ussdRes as any).isAwaiting) {
        updateStatus('error');
        setFeedback(ussdRes.message || 'Échec de la transaction');
        setTimeout(() => { if (statusRef.current === 'error') updateStatus('idle'); }, 5000);
      }
    } catch (e) {
      updateStatus('error');
      setTimeout(() => { if (statusRef.current === 'error') updateStatus('idle'); }, 5000);
    }
  }, [nlpApiUrl, parsedIntent, triggerUSSD, updateStatus]);

  const cancelAction = useCallback(() => {
    updateStatus('idle');
    setParsedIntent(null);
    setAmbiguityContacts(null);
    setShowPinModal(false);
    setFeedback('Action annulée');
  }, [updateStatus]);

  const resolveAmbiguity = useCallback(async (contact: { name: string; phone: string }) => {
    const ctx = ambiguityContextRef.current;
    if (!ctx) return;
    setAmbiguityContacts(null);
    updateStatus('processing');
    const ussdRes = await triggerUSSD(ctx.intent, { ...ctx.data, recipient: contact.phone });
    if (ussdRes.success) {
      updateStatus('success');
      setFeedback(ussdRes.message);
      speakFeedback(ussdRes.message);
      setTimeout(() => { if (statusRef.current === 'success') updateStatus('idle'); }, 5000);
    } else if (!(ussdRes as any).isAwaiting) {
      updateStatus('error');
      setFeedback(ussdRes.message || 'Échec de la transaction');
      setTimeout(() => { if (statusRef.current === 'error') updateStatus('idle'); }, 5000);
    }
  }, [triggerUSSD, updateStatus]);

  const executeTransferWithPin = useCallback(async (pin: string) => {
    if (!pinContext) return;
    try {
      updateStatus('processing');
      const { MoMoTransactionEngine } = await import('../services/ussd_engine/MoMoTransactionEngine');
      const engine = new MoMoTransactionEngine();
      const res = await engine.confirmWithPin(pin, { phone: pinContext.data?.phone, amount: pinContext.data?.amount });
      setShowPinModal(false);
      if (res.status === 'success') {
        updateStatus('success');
        setFeedback(res.message);
        speakFeedback(res.message);
        setTimeout(() => { if (statusRef.current === 'success') updateStatus('idle'); }, 5000);
      } else {
        updateStatus('error');
        setFeedback(res.message);
        speakFeedback(res.message);
        setTimeout(() => { if (statusRef.current === 'error') updateStatus('idle'); }, 5000);
      }
    } catch (e) {
      updateStatus('error');
      setTimeout(() => { if (statusRef.current === 'error') updateStatus('idle'); }, 5000);
    }
  }, [pinContext, updateStatus]);

  return {
    status, transcript, feedback, parsedIntent, isListening, ambiguityContacts, ambiguityQuery, showPinModal,
    startListening, stopListening, confirmAction, cancelAction,
    resolveAmbiguity, executeTransferWithPin, cancelPinModal: cancelAction
  };
}
