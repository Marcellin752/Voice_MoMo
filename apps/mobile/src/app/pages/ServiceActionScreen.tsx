import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import * as transactionsService from "../services/transactions.service";
import ContactSelectorModal from "../components/ContactSelectorModal";
import { Users } from "lucide-react";

const SERVICE_LABELS: Record<string, string> = {
  transfert: "Transfert",
  retrait: "Retrait",
  credit: "Credit",
  forfaits: "Forfaits",
  momopay: "MoMoPay",
  banque: "Banque",
  factures: "Factures",
};

export default function ServiceActionScreen() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [target, setTarget] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  const serviceLabel = useMemo(() => {
    if (!serviceId) return "Service";
    return SERVICE_LABELS[serviceId] ?? "Service";
  }, [serviceId]);

  const isIncoming = serviceId === "banque";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setMessage("Veuillez saisir un montant valide.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      await transactionsService.createTransaction({
        title: serviceLabel,
        desc: target.trim() ? `Destination: ${target.trim()}` : "Opération effectuée via application",
        amount: numericAmount,
        type: isIncoming ? "in" : "out",
      });
      setMessage(`${serviceLabel} effectué avec succès.`);
      setAmount("");
      setTarget("");
    } catch (err: any) {
      setMessage(err.message || "Erreur lors de l'opération.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full px-6 py-8 bg-slate-50 dark:bg-[#121212]">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">{serviceLabel}</h1>
        <button onClick={() => navigate(-1)} className="text-sm font-bold text-[#004F71] dark:text-[#FFCC00]">
          Retour
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] p-5">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Montant (FCFA)</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-3 text-slate-900 dark:text-white outline-none"
            inputMode="numeric"
            placeholder="5000"
          />
        </label>
        <label className="block">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-bold uppercase text-slate-500">Numero ou reference</span>
            <button
              type="button"
              onClick={() => setIsContactModalOpen(true)}
              className="text-xs font-bold text-[#004F71] dark:text-[#FFCC00] hover:underline"
            >
              Sélectionner un contact
            </button>
          </div>
          <div className="relative">
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent pl-3 pr-10 py-3 text-slate-900 dark:text-white outline-none"
              placeholder="Ex: 0123456789"
            />
            <button
              type="button"
              onClick={() => setIsContactModalOpen(true)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-[#004F71] dark:hover:text-[#FFCC00]"
            >
              <Users size={18} />
            </button>
          </div>
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-[#FFCC00] px-4 py-3 font-bold text-[#004F71] disabled:opacity-60"
        >
          {loading ? "Traitement..." : "Confirmer"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => navigate("/app/transactions")}
        className="mt-3 w-full rounded-2xl border border-slate-300 dark:border-white/20 px-4 py-3 text-sm font-bold text-slate-700 dark:text-zinc-200"
      >
        Voir l'historique
      </button>

      {message && (
        <p className="mt-4 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-500/10 dark:text-green-400">
          {message}
        </p>
      )}

      {/* Modal / Bottom Sheet dynamique de recherche et sélection de contacts */}
      <ContactSelectorModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        onSelect={(contact) => {
          setTarget(contact.phone);
        }}
      />
    </div>
  );
}
