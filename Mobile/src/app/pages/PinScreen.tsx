import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { getPinUpdatedAt, markPinUpdated } from "../utils/localData";

export default function PinScreen() {
  const navigate = useNavigate();
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [message, setMessage] = useState("");
  const lastUpdated = useMemo(() => getPinUpdatedAt(), []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length !== 4 || confirmPin.length !== 4) {
      setMessage("Le nouveau PIN doit contenir 4 chiffres.");
      return;
    }
    if (newPin !== confirmPin) {
      setMessage("La confirmation du PIN ne correspond pas.");
      return;
    }
    if (oldPin === newPin) {
      setMessage("Le nouveau PIN doit etre different de l'ancien.");
      return;
    }
    markPinUpdated();
    setOldPin("");
    setNewPin("");
    setConfirmPin("");
    setMessage("PIN mis a jour avec succes.");
  };

  return (
    <div className="min-h-full px-6 py-8 bg-slate-50 dark:bg-[#121212]">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Code PIN MTN</h1>
        <button onClick={() => navigate(-1)} className="text-sm font-bold text-[#004F71] dark:text-[#FFCC00]">
          Retour
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] p-5">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Ancien PIN</span>
          <input
            value={oldPin}
            onChange={(e) => setOldPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-3 text-slate-900 dark:text-white outline-none"
            inputMode="numeric"
            placeholder="****"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Nouveau PIN</span>
          <input
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-3 text-slate-900 dark:text-white outline-none"
            inputMode="numeric"
            placeholder="****"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Confirmer PIN</span>
          <input
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-3 text-slate-900 dark:text-white outline-none"
            inputMode="numeric"
            placeholder="****"
          />
        </label>
        <button type="submit" className="w-full rounded-2xl bg-[#FFCC00] px-4 py-3 font-bold text-[#004F71]">
          Modifier le PIN
        </button>
      </form>

      {lastUpdated && <p className="mt-4 text-xs font-medium text-slate-500">Derniere mise a jour: {new Date(lastUpdated).toLocaleString("fr-FR")}</p>}
      {message && <p className="mt-2 rounded-xl bg-blue-50 px-3 py-2 text-sm text-[#004F71] dark:bg-[#004F71]/20 dark:text-[#FFCC00]">{message}</p>}
    </div>
  );
}
