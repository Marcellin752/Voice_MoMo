import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import * as usersService from "../services/users.service";

export default function LanguageScreen() {
  const navigate = useNavigate();
  const [language, setLanguage] = useState<"fr" | "en">("fr");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    usersService.getLanguage()
      .then((res) => setLanguage(res.language))
      .catch(() => {});
  }, []);

  const onSave = async () => {
    setLoading(true);
    setSaved(false);
    try {
      await usersService.updateLanguage(language);
      setSaved(true);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full px-6 py-8 bg-slate-50 dark:bg-[#121212]">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Langue</h1>
        <button onClick={() => navigate(-1)} className="text-sm font-bold text-[#004F71] dark:text-[#FFCC00]">
          Retour
        </button>
      </div>

      <div className="space-y-3 rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] p-5">
        <button
          type="button"
          onClick={() => setLanguage("fr")}
          className={`w-full rounded-2xl border px-4 py-3 text-left font-semibold ${language === "fr" ? "border-[#FFCC00] bg-[#FFCC00]/10 text-[#004F71] dark:text-[#FFCC00]" : "border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-200"}`}
        >
          Francais
        </button>
        <button
          type="button"
          onClick={() => setLanguage("en")}
          className={`w-full rounded-2xl border px-4 py-3 text-left font-semibold ${language === "en" ? "border-[#FFCC00] bg-[#FFCC00]/10 text-[#004F71] dark:text-[#FFCC00]" : "border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-200"}`}
        >
          English
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={loading}
          className="mt-2 w-full rounded-2xl bg-[#FFCC00] px-4 py-3 font-bold text-[#004F71] disabled:opacity-60"
        >
          {loading ? "Enregistrement..." : "Valider"}
        </button>
      </div>

      {saved && (
        <p className="mt-4 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-500/10 dark:text-green-400">
          Langue enregistrée.
        </p>
      )}
    </div>
  );
}
