import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, Phone } from "lucide-react";

export default function LoginScreen() {
  const [phone, setPhone] = useState("");
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length >= 8) {
      navigate("/app");
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-md mx-auto bg-slate-50 dark:bg-[#121212] text-slate-900 dark:text-white px-6 py-8 transition-colors duration-300">
      <div className="flex-1 flex flex-col space-y-10 mt-12">
        <div className="space-y-4 text-center mt-10">
          <div className="w-20 h-20 bg-[#FFCC00] rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-[#FFCC00]/20 border-4 border-white dark:border-[#121212]">
            <span className="font-black text-[#004F71] text-2xl tracking-tighter">MTN</span>
          </div>
          <h1 className="text-3xl font-black text-[#004F71] dark:text-white">Bienvenue</h1>
          <p className="text-slate-500 dark:text-zinc-400 font-medium">Connectez-vous à votre compte MoMo Voice.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-8 flex-1 flex flex-col">
          <div className="space-y-3 mt-8">
            <label className="text-sm font-bold text-slate-700 dark:text-zinc-300">Numéro de téléphone MTN</label>
            <div className="relative flex items-center bg-white dark:bg-[#1A1A1A] rounded-2xl border border-slate-200 dark:border-white/5 focus-within:border-[#FFCC00] focus-within:ring-4 focus-within:ring-[#FFCC00]/10 transition-all overflow-hidden shadow-sm">
              <div className="pl-4 text-slate-400 dark:text-zinc-500">
                <Phone size={22} />
              </div>
              <input
                type="tel"
                placeholder="Ex: 01 23 45 67 89"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-transparent text-slate-900 dark:text-white font-bold text-lg py-5 px-4 outline-none placeholder:text-slate-300 dark:placeholder:text-zinc-600 placeholder:font-medium"
              />
            </div>
          </div>

          <div className="w-full mt-auto mb-10">
            <button
              type="submit"
              disabled={phone.length < 8}
              className={`w-full flex items-center justify-center space-x-3 py-5 px-6 rounded-2xl font-bold text-lg transition-all shadow-lg ${
                phone.length >= 8 
                ? 'bg-[#FFCC00] text-[#004F71] active:scale-95 shadow-[#FFCC00]/30 hover:bg-[#FFD633]' 
                : 'bg-slate-200 dark:bg-[#1A1A1A] text-slate-400 dark:text-zinc-600 cursor-not-allowed shadow-none'
              }`}
            >
              <span>Se connecter</span>
              <ArrowRight size={22} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
