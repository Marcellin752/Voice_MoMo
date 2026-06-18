import { Link, useNavigate } from "react-router";

const services = [
  { id: "transfert", label: "Transfert" },
  { id: "retrait", label: "Retrait" },
  { id: "credit", label: "Credit" },
  { id: "forfaits", label: "Forfaits" },
  { id: "momopay", label: "MoMoPay" },
  { id: "banque", label: "Banque" },
  { id: "factures", label: "Factures" },
];

export default function ServicesHubScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-full px-6 py-8 bg-slate-50 dark:bg-[#121212]">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Tous les services</h1>
        <button onClick={() => navigate(-1)} className="text-sm font-bold text-[#004F71] dark:text-[#FFCC00]">
          Retour
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {services.map((service) => (
          <Link
            key={service.id}
            to={`/app/services/${service.id}`}
            className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] px-4 py-5 font-bold text-slate-800 dark:text-zinc-100"
          >
            {service.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
