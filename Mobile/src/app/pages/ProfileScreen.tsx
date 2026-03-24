import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import * as usersService from "../services/users.service";

export default function ProfileScreen() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    usersService.getProfile()
      .then((p) => {
        setFullName(p.fullName);
        setEmail(p.email);
        setPhone(p.phone);
      })
      .catch(() => {});
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setMessage("Le nom est requis.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      await usersService.updateProfile({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
      });
      setMessage("Profil mis à jour avec succès.");
    } catch (err: any) {
      setMessage(err.message || "Erreur lors de la mise à jour.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full px-6 py-8 bg-slate-50 dark:bg-[#121212]">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Mon Profil</h1>
        <button onClick={() => navigate(-1)} className="text-sm font-bold text-[#004F71] dark:text-[#FFCC00]">
          Retour
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] p-5">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Nom complet</span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-3 text-slate-900 dark:text-white outline-none"
            placeholder="Votre nom"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-3 text-slate-900 dark:text-white outline-none"
            placeholder="exemple@email.com"
            type="email"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Telephone</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-3 text-slate-900 dark:text-white outline-none"
            placeholder="01 23 45 67 89"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-[#FFCC00] px-4 py-3 font-bold text-[#004F71] disabled:opacity-60"
        >
          {loading ? "Enregistrement..." : "Enregistrer"}
        </button>
      </form>

      {message && (
        <p className="mt-4 rounded-xl bg-blue-50 px-3 py-2 text-sm text-[#004F71] dark:bg-[#004F71]/20 dark:text-[#FFCC00]">
          {message}
        </p>
      )}
    </div>
  );
}
