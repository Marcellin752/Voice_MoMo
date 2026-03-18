import { useNavigate } from "react-router";

const notifications = [
  { id: "n1", title: "Depot recu", content: "Vous avez recu +25 000 FCFA.", when: "Aujourd'hui 15:32" },
  { id: "n2", title: "Paiement confirme", content: "Votre paiement marchand a ete valide.", when: "Hier 11:45" },
];

export default function NotificationsScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-full px-6 py-8 bg-slate-50 dark:bg-[#121212]">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Notifications</h1>
        <button onClick={() => navigate(-1)} className="text-sm font-bold text-[#004F71] dark:text-[#FFCC00]">
          Retour
        </button>
      </div>

      <div className="space-y-3">
        {notifications.map((n) => (
          <div key={n.id} className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] p-4">
            <p className="font-bold text-slate-900 dark:text-white">{n.title}</p>
            <p className="text-sm text-slate-600 dark:text-zinc-300">{n.content}</p>
            <p className="mt-1 text-xs text-slate-400">{n.when}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
