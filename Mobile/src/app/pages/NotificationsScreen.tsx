import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { fetchNotificationsFromApi, getNotifications, type NotificationItem } from "../utils/localData";

export default function NotificationsScreen() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>(getNotifications());
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchNotificationsFromApi()
      .then((items) => setNotifications(items))
      .catch(() => {
        setMessage("Mode hors ligne: notifications locales affichees.");
      });
  }, []);

  return (
    <div className="min-h-full px-6 py-8 bg-slate-50 dark:bg-[#121212]">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Notifications</h1>
        <button onClick={() => navigate(-1)} className="text-sm font-bold text-[#004F71] dark:text-[#FFCC00]">
          Retour
        </button>
      </div>

      {message && <p className="mb-3 rounded-xl bg-blue-50 px-3 py-2 text-sm text-[#004F71] dark:bg-[#004F71]/20 dark:text-[#FFCC00]">{message}</p>}

      <div className="space-y-3">
        {notifications.map((n) => (
          <div key={n.id} className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] p-4">
            <p className="font-bold text-slate-900 dark:text-white">{n.title}</p>
            <p className="text-sm text-slate-600 dark:text-zinc-300">{n.content}</p>
            <p className="mt-1 text-xs text-slate-400">{n.when}</p>
          </div>
        ))}
        {notifications.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-white/20 dark:text-zinc-400">
            Aucune notification disponible.
          </div>
        )}
      </div>
    </div>
  );
}
