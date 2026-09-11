import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Delete, Shield } from 'lucide-react';
import { wipeSecret } from '../services/voiceBiometric.service';

interface SecurePinModalProps {
  isOpen: boolean;
  prompt: string;
  onSubmit: (pin: string) => void | Promise<void>;
  onCancel: () => void;
}

/**
 * Saisie PIN tactile uniquement.
 * Le PIN n'est jamais loggé ni lu à voix haute.
 */
export default function SecurePinModal({ isOpen, prompt, onSubmit, onCancel }: SecurePinModalProps) {
  const [digits, setDigits] = useState('');
  const [busy, setBusy] = useState(false);
  const pinRef = useRef<{ value: string }>({ value: '' });

  const syncDigits = (next: string) => {
    setDigits(next);
    pinRef.current.value = next;
  };

  const handleDigit = (d: string) => {
    if (busy || digits.length >= 5) return;
    syncDigits(digits + d);
  };

  const handleDelete = () => {
    if (busy) return;
    syncDigits(digits.slice(0, -1));
  };

  const handleSubmit = async () => {
    if (digits.length < 4 || busy) return;
    setBusy(true);
    const pinCopy = pinRef.current.value;
    try {
      await onSubmit(pinCopy);
    } finally {
      wipeSecret(pinRef.current);
      syncDigits('');
      setBusy(false);
    }
  };

  const handleCancel = () => {
    wipeSecret(pinRef.current);
    syncDigits('');
    onCancel();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="bg-white dark:bg-[#1A1A1A] rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-100 dark:border-white/5 mx-0 sm:mx-4"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-[#004F71]/10 dark:bg-[#FFCC00]/10 flex items-center justify-center">
                <Shield size={20} className="text-[#004F71] dark:text-[#FFCC00]" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Code PIN MTN</h3>
                <p className="text-[11px] text-slate-400">Saisie privée · jamais dicté · jamais envoyé au cloud</p>
              </div>
            </div>

            <p className="text-sm text-slate-500 dark:text-zinc-400 mb-5">{prompt}</p>

            <div className="flex justify-center gap-3 mb-6" aria-hidden>
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full ${
                    i < digits.length ? 'bg-[#004F71] dark:bg-[#FFCC00]' : 'bg-slate-200 dark:bg-zinc-700'
                  }`}
                />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((key) => {
                if (key === '') return <div key="empty" />;
                if (key === 'del') {
                  return (
                    <button
                      key="del"
                      type="button"
                      onClick={handleDelete}
                      className="h-14 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-600 dark:text-zinc-300"
                      aria-label="Effacer"
                    >
                      <Delete size={20} />
                    </button>
                  );
                }
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleDigit(key)}
                    className="h-14 rounded-2xl bg-slate-50 dark:bg-white/5 text-xl font-black text-slate-900 dark:text-white active:bg-[#FFCC00]/30"
                  >
                    {key}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCancel}
                disabled={busy}
                className="flex-1 py-3.5 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-zinc-300 font-bold rounded-xl"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={digits.length < 4 || busy}
                className="flex-1 py-3.5 bg-[#004F71] dark:bg-[#FFCC00] text-white dark:text-slate-900 font-black rounded-xl disabled:opacity-40"
              >
                {busy ? '…' : 'Valider'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
