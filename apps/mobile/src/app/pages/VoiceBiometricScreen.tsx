import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  LEARNING_MIN_SAMPLES,
  clearVoiceBiometric,
  getBiometricJournal,
  getVoiceBiometricProfile,
  hasVoiceBiometric,
  type BiometricJournalEntry,
  type VoiceBiometricProfile,
} from '../services/voiceBiometric.service';

export default function VoiceBiometricScreen() {
  const [profile, setProfile] = useState<VoiceBiometricProfile | null>(null);
  const [journal, setJournal] = useState<BiometricJournalEntry[]>([]);

  const refresh = async () => {
    const ok = await hasVoiceBiometric();
    setProfile(ok ? await getVoiceBiometricProfile() : null);
    setJournal(await getBiometricJournal());
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleReset = async () => {
    await clearVoiceBiometric();
    await refresh();
    toast.message('Empreinte vocale effacée — l\'apprentissage recommencera en parlant');
  };

  const learning = !profile || profile.learning || profile.sampleCount < LEARNING_MIN_SAMPLES;
  const samples = profile?.sampleCount ?? 0;
  const progress = Math.min(100, Math.round((samples / LEARNING_MIN_SAMPLES) * 100));

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
            <h2 className="font-bold text-slate-900 dark:text-white">Apprentissage automatique</h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
              Pas besoin d’enregistrer des phrases. En parlant à Voice MoMo, l’app apprend
              <strong> uniquement sur ce téléphone</strong> le son de votre voix — comme Siri.
              Une fois prêt, les opérations sensibles vérifient que c’est bien vous. Le PIN MTN reste au clavier.
            </p>
            <p className="text-xs font-medium mt-3 text-[#004F71] dark:text-[#FFCC00]">
              {learning
                ? `Apprentissage en cours · ${samples} / ${LEARNING_MIN_SAMPLES} échantillons`
                : `Empreinte active${profile?.enrolledAt ? ` · depuis ${new Date(profile.enrolledAt).toLocaleDateString('fr-FR')}` : ''}`}
            </p>
            {learning && (
              <div className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#004F71] dark:bg-[#FFCC00] transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {(profile || samples > 0) && (
        <button
          type="button"
          onClick={handleReset}
          className="w-full py-4 rounded-2xl bg-red-50 dark:bg-red-500/10 text-red-600 font-bold flex items-center justify-center gap-2 mb-6"
        >
          <Trash2 size={18} />
          Réinitialiser l’apprentissage
        </button>
      )}

      {journal.length > 0 && (
        <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-5 border border-slate-100 dark:border-white/5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Journal de sécurité</h3>
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {journal.slice(0, 12).map((j, idx) => (
              <li key={`${j.at}-${idx}`} className="text-xs text-slate-500 dark:text-zinc-400 flex justify-between gap-2">
                <span>
                  {j.event === 'learn' && '🧠 Apprentissage'}
                  {j.event === 'verify_ok' && '✅ Vérification OK'}
                  {j.event === 'verify_fail' && '❌ Échec voix'}
                  {j.event === 'replay_blocked' && '🚫 Replay bloqué'}
                  {j.event === 'lockout' && '🔒 Verrouillage'}
                  {j.event === 'enroll' && '🎙️ Enrôlement'}
                  {j.score != null ? ` (${(j.score * 100).toFixed(0)}%)` : ''}
                  {j.detail ? ` · ${j.detail}` : ''}
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
