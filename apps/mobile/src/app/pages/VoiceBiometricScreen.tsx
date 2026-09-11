import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Mic, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  ENROLLMENT_PHRASES,
  clearVoiceBiometric,
  enrollVoiceBiometric,
  getBiometricJournal,
  hasVoiceBiometric,
  getVoiceBiometricProfile,
  type BiometricJournalEntry,
} from '../services/voiceBiometric.service';

type Phase = 'idle' | 'recording' | 'processing';

export default function VoiceBiometricScreen() {
  const [enrolled, setEnrolled] = useState(false);
  const [enrolledAt, setEnrolledAt] = useState<string | null>(null);
  const [journal, setJournal] = useState<BiometricJournalEntry[]>([]);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [samples, setSamples] = useState<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const refresh = async () => {
    const ok = await hasVoiceBiometric();
    setEnrolled(ok);
    if (ok) {
      const p = await getVoiceBiometricProfile();
      setEnrolledAt(p?.enrolledAt || null);
    } else {
      setEnrolledAt(null);
    }
    setJournal(await getBiometricJournal());
  };

  useEffect(() => {
    refresh();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const nextSamples = [...samples, blob];
        setSamples(nextSamples);
        setPhase('idle');

        if (step < ENROLLMENT_PHRASES.length - 1) {
          setStep(step + 1);
          toast.success(`Phrase ${step + 1} enregistrée`);
          return;
        }

        setPhase('processing');
        try {
          await enrollVoiceBiometric(nextSamples);
          toast.success('Empreinte vocale enregistrée sur cet appareil');
          setSamples([]);
          setStep(0);
          await refresh();
        } catch (e: any) {
          toast.error(e?.message || 'Échec de l\'enrôlement');
          setSamples([]);
          setStep(0);
        } finally {
          setPhase('idle');
        }
      };
      recorder.start();
      setPhase('recording');
      // ~3.5s par phrase
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 3500);
    } catch {
      toast.error('Microphone inaccessible');
      setPhase('idle');
    }
  };

  const handleReset = async () => {
    await clearVoiceBiometric();
    setSamples([]);
    setStep(0);
    await refresh();
    toast.message('Empreinte vocale effacée');
  };

  return (
    <div className="flex flex-col min-h-full w-full bg-slate-50 dark:bg-[#121212] px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/app/settings" className="p-2 rounded-full bg-white dark:bg-[#1A1A1A] border border-slate-100 dark:border-white/5">
          <ArrowLeft size={18} className="text-slate-600 dark:text-zinc-300" />
        </Link>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Empreinte vocale</h1>
      </div>

      <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-5 border border-slate-100 dark:border-white/5 shadow-sm mb-6">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-green-50 dark:bg-green-500/10 text-green-600">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">Protection anti-usurpation</h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
              Votre voix est analysée <strong>uniquement sur ce téléphone</strong>. Elle n’est jamais envoyée au cloud.
              Avant chaque transfert, l’app vérifie que c’est bien vous — le PIN MTN se saisit ensuite au clavier, en silence.
            </p>
            <p className="text-xs font-medium mt-3 text-[#004F71] dark:text-[#FFCC00]">
              {enrolled
                ? `Empreinte active${enrolledAt ? ` · depuis ${new Date(enrolledAt).toLocaleDateString('fr-FR')}` : ''}`
                : 'Aucune empreinte — obligatoire pour les opérations sensibles'}
            </p>
          </div>
        </div>
      </div>

      {!enrolled && (
        <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-5 border border-slate-100 dark:border-white/5 shadow-sm mb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
            Phrase {step + 1} / {ENROLLMENT_PHRASES.length}
          </p>
          <p className="text-lg font-bold text-slate-900 dark:text-white mb-6">
            « {ENROLLMENT_PHRASES[step]} »
          </p>
          <button
            type="button"
            disabled={phase !== 'idle'}
            onClick={startRecording}
            className="w-full py-4 rounded-2xl bg-[#004F71] dark:bg-[#FFCC00] text-white dark:text-slate-900 font-black flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Mic size={20} />
            {phase === 'recording' ? 'Écoute…' : phase === 'processing' ? 'Analyse…' : 'Enregistrer cette phrase'}
          </button>
        </div>
      )}

      {enrolled && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => {
              setEnrolled(false);
              setStep(0);
              setSamples([]);
            }}
            className="w-full py-4 rounded-2xl bg-[#004F71] dark:bg-[#FFCC00] text-white dark:text-slate-900 font-black"
          >
            Ré-enregistrer mon empreinte
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="w-full py-4 rounded-2xl bg-red-50 dark:bg-red-500/10 text-red-600 font-bold flex items-center justify-center gap-2"
          >
            <Trash2 size={18} />
            Supprimer l’empreinte
          </button>
        </div>
      )}

      {journal.length > 0 && (
        <div className="mt-8 bg-white dark:bg-[#1A1A1A] rounded-3xl p-5 border border-slate-100 dark:border-white/5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Journal de sécurité</h3>
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {journal.slice(0, 12).map((j, idx) => (
              <li key={`${j.at}-${idx}`} className="text-xs text-slate-500 dark:text-zinc-400 flex justify-between gap-2">
                <span>
                  {j.event === 'verify_ok' && '✅ Vérification OK'}
                  {j.event === 'verify_fail' && '❌ Échec voix'}
                  {j.event === 'replay_blocked' && '🚫 Replay bloqué'}
                  {j.event === 'lockout' && '🔒 Verrouillage'}
                  {j.event === 'enroll' && '🎙️ Enrôlement'}
                  {j.score != null ? ` (${(j.score * 100).toFixed(0)}%)` : ''}
                </span>
                <span className="shrink-0">{new Date(j.at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
