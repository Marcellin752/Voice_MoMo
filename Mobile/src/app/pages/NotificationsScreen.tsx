import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import * as usersService from "../services/users.service";
import type { ApiNotification } from "../utils/api";

export default function NotificationsScreen() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usersService.getNotifications()
      .then((res) => setNotifications(res.notifications))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-full px-6 py-8 bg-slate-50 dark:bg-[#121212]">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Notifications</h1>
        <button onClick={() => navigate(-1)} className="text-sm font-bold text-[#004F71] dark:text-[#FFCC00]">
          Retour
        </button>
      </div>

      {loading ? (
        <p className="text-center text-slate-400 dark:text-zinc-500 py-10">Chargement...</p>
      ) : notifications.length === 0 ? (
        <p className="text-center text-slate-400 dark:text-zinc-500 py-10">Aucune notification.</p>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div key={n.id} className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] p-4">
              <p className="font-bold text-slate-900 dark:text-white">{n.title}</p>
              <p className="text-sm text-slate-600 dark:text-zinc-300">{n.content}</p>
              <p className="mt-1 text-xs text-slate-400">{n.when}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
