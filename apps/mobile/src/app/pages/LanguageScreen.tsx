import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Check, Globe, Languages } from "lucide-react";
import * as usersService from "../services/users.service";
import { useLanguage } from "../contexts/LanguageContext";

export default function LanguageScreen() {
  const navigate = useNavigate();
  const { t, setLanguage } = useLanguage();
  const [savedLanguage, setSavedLanguage] = useState<"fr" | "en">("fr");
  const [selectedLanguage, setSelectedLanguage] = useState<"fr" | "en">("fr");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"ok" | "error" | "">("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    usersService.getLanguage()
      .then((res) => {
        setSavedLanguage(res.language);
        setSelectedLanguage(res.language);
      })
      .catch(() => {
        setMessageType("error");
        setMessage(t("lang_load_error"));
      })
      .finally(() => setFetching(false));
  }, []);

  const onSave = async () => {
    if (selectedLanguage === savedLanguage) return;
    setLoading(true);
    setMessage("");
    setMessageType("");
    try {
      const res = await usersService.updateLanguage(selectedLanguage);
      setSavedLanguage(res.language);
      setSelectedLanguage(res.language);
      setLanguage(res.language);
      setMessageType("ok");
      setMessage(t("lang_saved_ok"));
    } catch (err: any) {
      setMessageType("error");
      setMessage(err?.message || t("lang_save_error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full px-6 py-8 bg-slate-50 dark:bg-[#121212]">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">{t("lang_title")}</h1>
        <button onClick={() => navigate(-1)} className="text-sm font-bold text-[#004F71] dark:text-[#FFCC00]">
          {t("back")}
        </button>
      </div>

      <div className="space-y-4 rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] p-5 shadow-sm">
        <div className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-4 py-3">
          <p className="text-xs font-bold tracking-widest uppercase text-slate-500 mb-1">{t("lang_current")}</p>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {savedLanguage === "fr" ? "Français" : "English"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setSelectedLanguage("fr")}
          className={`w-full rounded-2xl border px-4 py-3 text-left font-semibold flex items-center justify-between ${selectedLanguage === "fr" ? "border-[#FFCC00] bg-[#FFCC00]/10 text-[#004F71] dark:text-[#FFCC00]" : "border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-200"}`}
        >
          <span className="inline-flex items-center gap-2">
            <Languages size={16} />
            Français
          </span>
          {selectedLanguage === "fr" ? <Check size={16} /> : null}
        </button>
        <button
          type="button"
          onClick={() => setSelectedLanguage("en")}
          className={`w-full rounded-2xl border px-4 py-3 text-left font-semibold flex items-center justify-between ${selectedLanguage === "en" ? "border-[#FFCC00] bg-[#FFCC00]/10 text-[#004F71] dark:text-[#FFCC00]" : "border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-200"}`}
        >
          <span className="inline-flex items-center gap-2">
            <Globe size={16} />
            English
          </span>
          {selectedLanguage === "en" ? <Check size={16} /> : null}
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={loading || fetching || selectedLanguage === savedLanguage}
          className="mt-2 w-full rounded-2xl bg-[#FFCC00] px-4 py-3 font-bold text-[#004F71] disabled:opacity-60"
        >
          {loading ? t("saving") : t("save")}
        </button>
      </div>

      {message && (
        <p
          className={`mt-4 rounded-xl px-3 py-2 text-sm ${
            messageType === "error"
              ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
              : "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
