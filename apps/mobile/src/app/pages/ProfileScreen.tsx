import { SmsListenerService } from '../services/sms.service';
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Camera, Mail, Phone, UserCircle2, Wallet, PencilLine, Check, X } from "lucide-react";
import * as usersService from "../services/users.service";
import { useLanguage } from "../contexts/LanguageContext";

type ProfileDraft = {
  fullName: string;
  email: string;
  phone: string;
  avatarUrl: string;
};

const PROFILE_UPDATED_EVENT = "momo:profile-updated";

export default function ProfileScreen() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [profile, setProfile] = useState<ProfileDraft>({
    fullName: "",
    email: "",
    phone: "",
    avatarUrl: "",
  });
  const [draft, setDraft] = useState<ProfileDraft>({
    fullName: "",
    email: "",
    phone: "",
    avatarUrl: "",
  });
  const [balance, setBalance] = useState<number | null>(null);
  const [currency, setCurrency] = useState<string>("FCFA");
  const [editMode, setEditMode] = useState(false);
  const [messageType, setMessageType] = useState<"ok" | "error" | "">("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    usersService.getProfile()
      .then((p) => {
        const nextProfile: ProfileDraft = {
          fullName: p.fullName || "",
          email: p.email || "",
          phone: p.phone || "",
          avatarUrl: p.avatarUrl || "",
        };
        setProfile(nextProfile);
        setDraft(nextProfile);
        setBalance(typeof p.balance === "number" ? p.balance : null);
        setCurrency(p.currency || "FCFA");
      })
      .catch(() => {
        setMessageType("error");
        setMessage("Impossible de charger votre profil.");
      })
      .finally(() => setFetching(false));
  }, []);

  const hasChanges = useMemo(() => {
    return (
      draft.fullName.trim() !== profile.fullName.trim() ||
      draft.email.trim() !== profile.email.trim() ||
      draft.phone.trim() !== profile.phone.trim() ||
      draft.avatarUrl !== profile.avatarUrl
    );
  }, [draft, profile]);

  const onSelectAvatar = () => {
    fileInputRef.current?.click();
  };

  const onAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessageType("error");
      setMessage("Veuillez sélectionner une image valide.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = typeof reader.result === "string" ? reader.result : "";
      if (!base64) return;
      setDraft((prev) => ({ ...prev, avatarUrl: base64 }));
      setMessageType("");
      setMessage("");
    };
    reader.readAsDataURL(file);
  };

  const onCancelEdit = () => {
    setDraft(profile);
    setEditMode(false);
    setMessageType("");
    setMessage("");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.fullName.trim()) {
      setMessageType("error");
      setMessage("Le nom est requis.");
      return;
    }
    if (draft.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
      setMessageType("error");
      setMessage("Adresse email invalide.");
      return;
    }
    setLoading(true);
    setMessageType("");
    setMessage("");
    try {
      const updated = await usersService.updateProfile({
        fullName: draft.fullName.trim(),
        email: draft.email.trim(),
        phone: draft.phone.trim(),
        avatarUrl: draft.avatarUrl,
      });

      const nextProfile: ProfileDraft = {
        fullName: updated.fullName || draft.fullName.trim(),
        email: updated.email || draft.email.trim(),
        phone: updated.phone || draft.phone.trim(),
        avatarUrl: updated.avatarUrl || draft.avatarUrl,
      };
      setProfile(nextProfile);
      setDraft(nextProfile);
      setBalance(typeof updated.balance === "number" ? updated.balance : balance);
      setCurrency(updated.currency || currency);
      window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT, { detail: nextProfile }));
      setEditMode(false);
      setMessageType("ok");
      setMessage(t("profile_saved_ok"));
    } catch (err: any) {
      setMessageType("error");
      setMessage(err.message || "Erreur lors de la mise à jour.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full px-6 py-8 bg-slate-50 dark:bg-[#121212]">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">{t("profile_title")}</h1>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-sm font-bold text-[#004F71] dark:text-[#FFCC00]"
        >
          {t("back")}
        </button>
      </div>

      <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="relative">
            {draft.avatarUrl ? (
              <img
                src={draft.avatarUrl}
                alt="Photo de profil"
                className="h-20 w-20 rounded-2xl object-cover border border-slate-200 dark:border-white/10"
              />
            ) : (
              <div className="h-20 w-20 rounded-2xl bg-slate-100 dark:bg-white/10 flex items-center justify-center border border-slate-200 dark:border-white/10">
                <UserCircle2 size={36} className="text-slate-500 dark:text-zinc-300" />
              </div>
            )}
            {editMode && (
              <button
                type="button"
                onClick={onSelectAvatar}
                className="absolute -bottom-2 -right-2 h-9 w-9 rounded-xl bg-[#004F71] text-white flex items-center justify-center shadow-md"
              >
                <Camera size={16} />
              </button>
            )}
          </div>

          <div className="flex-1">
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              {fetching ? "Chargement..." : profile.fullName || "Utilisateur"}
            </h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {t("profile_subtitle")}
            </p>
            {!editMode && (
              <button
                type="button"
                onClick={() => setEditMode(true)}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#004F71] px-4 py-2 text-sm font-bold text-white"
              >
                <PencilLine size={14} />
                {t("profile_edit")}
              </button>
            )}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onAvatarChange}
          className="hidden"
        />

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <ProfileField
            label={t("profile_name")}
            icon={<UserCircle2 size={16} />}
            value={draft.fullName}
            editable={editMode}
            onChange={(value) => setDraft((prev) => ({ ...prev, fullName: value }))}
            placeholder="Votre nom"
          />
          <ProfileField
            label={t("profile_email")}
            icon={<Mail size={16} />}
            value={draft.email}
            editable={editMode}
            onChange={(value) => setDraft((prev) => ({ ...prev, email: value }))}
            placeholder="exemple@email.com"
            type="email"
          />
          <ProfileField
            label={t("profile_phone")}
            icon={<Phone size={16} />}
            value={draft.phone}
            editable={editMode}
            onChange={(value) => setDraft((prev) => ({ ...prev, phone: value }))}
            placeholder="01 23 45 67 89"
          />

          <div className="rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3 bg-slate-50 dark:bg-white/5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              <Wallet size={14} />
              {t("profile_balance")}
            </div>
            <p className="mt-1 text-base font-black text-slate-900 dark:text-white">
              {balance === null
                ? "-"
                : `${balance.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`}
            </p>
          </div>

          {editMode && (
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={onCancelEdit}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 dark:border-white/20 px-4 py-3 font-bold text-slate-700 dark:text-zinc-200"
              >
                <X size={16} />
                {t("profile_cancel")}
              </button>
              <button
                type="submit"
                disabled={loading || !hasChanges}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#FFCC00] px-4 py-3 font-bold text-[#004F71] disabled:opacity-60"
              >
                <Check size={16} />
                {loading ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          )}
        </form>
      </div>

      {message && (
        <p
          className={`mt-4 rounded-xl px-3 py-2 text-sm ${
            messageType === "error"
              ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
              : "bg-blue-50 text-[#004F71] dark:bg-[#004F71]/20 dark:text-[#FFCC00]"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}

function ProfileField({
  label,
  icon,
  value,
  editable,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  editable: boolean;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "email";
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </span>
      {editable ? (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-3 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#FFCC00]/40"
          placeholder={placeholder}
        />
      ) : (
        <div className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-3 text-slate-800 dark:text-zinc-200">
          {value || "-"}
        </div>
      )}
    </label>
  );
}
