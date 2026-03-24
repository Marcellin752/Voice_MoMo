import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import * as usersService from "../services/users.service";

export default function PinScreen() {
  const navigate = useNavigate();
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    usersService.getSecurity()
      .then((res) => setLastUpdated(res.pinUpdatedAt))
      .catch(() => {});
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
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
      setMessage("Le nouveau PIN doit être différent de l'ancien.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const res = await usersService.updatePin(oldPin, newPin, confirmPin);
      setLastUpdated(res.pinUpdatedAt);
      setOldPin("");
      setNewPin("");
      setConfirmPin("");
      setMessage("PIN mis à jour avec succès.");
    } catch (err: any) {
      setMessage(err.message || "Erreur lors de la mise à jour du PIN.");
    } finally {
      setLoading(false);
    }
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
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-[#FFCC00] px-4 py-3 font-bold text-[#004F71] disabled:opacity-60"
        >
          {loading ? "Modification..." : "Modifier le PIN"}
        </button>
      </form>

      {lastUpdated && (
        <p className="mt-4 text-xs font-medium text-slate-500">
          Dernière mise à jour: {new Date(lastUpdated).toLocaleString("fr-FR")}
        </p>
      )}
      {message && (
        <p className="mt-2 rounded-xl bg-blue-50 px-3 py-2 text-sm text-[#004F71] dark:bg-[#004F71]/20 dark:text-[#FFCC00]">
          {message}
        </p>
      )}
    </div>
  );
}
