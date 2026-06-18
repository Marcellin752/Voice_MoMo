import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, Phone, KeyRound, ArrowLeft, RefreshCw, Smartphone } from "lucide-react";
import * as authService from "../services/auth.service";
import { useAuth } from "../contexts/AuthContext";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

type AuthStep = "phone" | "otp";

export default function LoginScreen() {
  const [step, setStep] = useState<AuthStep>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSentCode, setOtpSentCode] = useState<string | null>(null); // Utilisé pour la simulation/démo
  
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);
  
  const navigate = useNavigate();
  const { setAuth, token, loading: authLoading } = useAuth();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-redirect if already authenticated
  useEffect(() => {
    if (!authLoading && token) {
      navigate("/app", { replace: true });
    }
  }, [token, authLoading, navigate]);

  // Gérer le compte à rebours pour la validité de l'OTP
  useEffect(() => {
    if (timer > 0) {
      timerRef.current = setTimeout(() => setTimer(prev => prev - 1), 1000);
    } else if (timer === 0 && timerRef.current) {
      clearTimeout(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timer]);

  // Nettoyer le numéro de téléphone (uniquement les chiffres)
  const handlePhoneChange = (val: string) => {
    setPhone(val.replace(/\D/g, ""));
  };

  // Limiter l'OTP à 6 chiffres et auto-soumettre
  const handleOtpChange = (val: string) => {
    const cleaned = val.replace(/\D/g, "").slice(0, 6);
    setOtp(cleaned);
    if (cleaned.length === 6) {
      submitVerifyOtp(cleaned);
    }
  };

  // Étape 1 : Demander l'envoi de l'OTP
  const submitSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (phone.length < 8) {
      toast.error("Veuillez entrer un numéro de téléphone valide.");
      return;
    }

    setLoading(true);
    try {
      const res = await authService.sendOtp(phone);
      if (res.success) {
        setStep("otp");
        setTimer(300); // 5 minutes
        if (res.devCode) {
          // Le SMS n'a pas pu être envoyé (numéro non vérifié Twilio trial)
          // On affiche le code directement sur l'écran pour permettre la connexion
          setOtpSentCode(res.devCode);
          toast.success("SMS indisponible. Votre code est affiché ci-dessous.");
        } else {
          setOtpSentCode("");
          toast.success("Code OTP envoyé par SMS !");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Impossible d'envoyer l'OTP.");
    } finally {
      setLoading(false);
    }
  };

  // Étape 2 : Valider l'OTP
  const submitVerifyOtp = async (codeToVerify?: string) => {
    const targetCode = codeToVerify || otp;
    if (targetCode.length !== 6) return;

    setLoading(true);
    try {
      const result = await authService.verifyOtp(phone, targetCode);
      toast.success("Authentification réussie !");
      await setAuth(result.token, result.user);
      navigate("/app");
    } catch (err: any) {
      toast.error(err.message || "Code OTP incorrect ou expiré.");
      setOtp(""); // Vider en cas d'erreur
    } finally {
      setLoading(false);
    }
  };

  // Formater les secondes restantes en MM:SS
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const isPhoneValid = phone.length >= 8;

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-md mx-auto bg-slate-50 dark:bg-[#121212] text-slate-900 dark:text-white px-6 py-8 transition-colors duration-300 relative overflow-hidden">
      {/* Background blobs for premium glassmorphism feel */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] aspect-square bg-[#FFCC00]/10 rounded-full blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] aspect-square bg-[#004F71]/10 rounded-full blur-3xl" />

      {/* Header Back Button */}
      {step === "otp" && (
        <button
          onClick={() => {
            setStep("phone");
            setOtp("");
            setOtpSentCode(null);
          }}
          className="self-start p-3 bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft size={20} />
        </button>
      )}

      <div className="flex-1 flex flex-col justify-center space-y-12 z-10">
        {/* Brand Logo & Presentation */}
        <div className="space-y-4 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-20 h-20 bg-[#FFCC00] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-[#FFCC00]/20 border-4 border-white dark:border-[#121212]"
          >
            <span className="font-black text-[#004F71] text-2xl tracking-tighter">MTN</span>
          </motion.div>
          
          <h1 className="text-3xl font-black tracking-tight text-[#004F71] dark:text-white">
            {step === "phone" ? "Connexion & Inscription" : "Saisir le code"}
          </h1>
          <p className="text-slate-500 dark:text-zinc-400 font-semibold text-sm max-w-xs mx-auto">
            {step === "phone"
              ? "Entrez votre numéro MTN pour recevoir un code d'authentification."
              : `Entrez le code secret à 4 chiffres envoyé au numéro : ${phone.replace(/(\d{2})/g, "$1 ").trim()}`}
          </p>
        </div>

        {/* Form area with animated screen transitions */}
        <AnimatePresence mode="wait">
          {step === "phone" ? (
            <motion.form
              key="phone-step"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.3 }}
              onSubmit={submitSendOtp}
              className="space-y-6"
            >
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                  Numéro de téléphone MTN
                </label>
                <div className="relative flex items-center bg-white dark:bg-[#1A1A1A] rounded-2xl border border-slate-200 dark:border-white/5 focus-within:border-[#FFCC00] focus-within:ring-4 focus-within:ring-[#FFCC00]/10 transition-all overflow-hidden shadow-sm">
                  <div className="pl-5 text-slate-400 dark:text-zinc-500 shrink-0">
                    <Phone size={20} />
                  </div>
                  <input
                    type="tel"
                    inputMode="tel"
                    placeholder="01 23 45 67 89"
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className="w-full bg-transparent text-slate-900 dark:text-white font-bold text-lg py-5 px-4 outline-none placeholder:text-slate-300 dark:placeholder:text-zinc-700"
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!isPhoneValid || loading}
                className={`w-full flex items-center justify-center space-x-3 py-5 px-6 rounded-2xl font-black text-base tracking-wide transition-all shadow-lg cursor-pointer ${
                  isPhoneValid && !loading
                    ? 'bg-[#FFCC00] text-[#004F71] active:scale-95 shadow-[#FFCC00]/30 hover:bg-[#FFD633]'
                    : 'bg-slate-200 dark:bg-[#1A1A1A] text-slate-400 dark:text-zinc-600 cursor-not-allowed shadow-none'
                }`}
              >
                <span>{loading ? "Envoi du code..." : "Recevoir l'OTP"}</span>
                {!loading && <ArrowRight size={18} />}
              </button>
            </motion.form>
          ) : (
            <motion.div
              key="otp-step"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Fallback : afficher le code si le SMS n'a pas pu être envoyé */}
              {otpSentCode && (
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-[#FFCC00]/15 border border-[#FFCC00]/50 rounded-2xl p-4 text-center space-y-1"
                >
                  <p className="text-xs font-semibold text-[#004F71] dark:text-[#FFCC00]/80">
                    ⚠️ SMS non reçu ? Utilisez ce code :
                  </p>
                  <p className="text-3xl font-black tracking-[0.3em] text-[#004F71] dark:text-[#FFCC00]">
                    {otpSentCode}
                  </p>
                </motion.div>
              )}

              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="relative flex items-center bg-white dark:bg-[#1A1A1A] rounded-2xl border border-slate-200 dark:border-white/5 focus-within:border-[#FFCC00] focus-within:ring-4 focus-within:ring-[#FFCC00]/10 transition-all overflow-hidden shadow-sm w-64">
                    <div className="pl-5 text-slate-400 shrink-0">
                      <KeyRound size={20} />
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="••••••"
                      value={otp}
                      onChange={(e) => handleOtpChange(e.target.value)}
                      className="w-full bg-transparent text-slate-900 dark:text-white font-black text-2xl py-5 px-4 outline-none placeholder:text-slate-300 dark:placeholder:text-zinc-700 tracking-[0.3em] text-center"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Expiry Timer */}
                <div className="text-center">
                  {timer > 0 ? (
                    <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500">
                      Code valide pendant <span className="font-bold text-red-500">{formatTime(timer)}</span>
                    </p>
                  ) : (
                    <p className="text-xs font-bold text-red-500">
                      Code expiré !
                    </p>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="space-y-3 pt-2">
                <button
                  onClick={() => submitVerifyOtp()}
                  disabled={otp.length !== 4 || loading}
                  className={`w-full flex items-center justify-center space-x-2 py-5 px-6 rounded-2xl font-black text-base tracking-wide transition-all shadow-lg cursor-pointer ${
                    otp.length === 4 && !loading
                      ? 'bg-[#FFCC00] text-[#004F71] active:scale-95 shadow-[#FFCC00]/30 hover:bg-[#FFD633]'
                      : 'bg-slate-200 dark:bg-[#1A1A1A] text-slate-400 dark:text-zinc-600 cursor-not-allowed shadow-none'
                  }`}
                >
                  <span>{loading ? "Vérification..." : "Valider le code"}</span>
                </button>

                <button
                  onClick={submitSendOtp}
                  disabled={timer > 0 || loading}
                  className={`w-full flex items-center justify-center space-x-2 py-4 px-6 rounded-2xl font-bold text-sm transition-all border border-slate-200 dark:border-white/5 cursor-pointer ${
                    timer === 0 && !loading
                      ? 'bg-white dark:bg-[#1A1A1A] text-slate-700 dark:text-zinc-300 active:scale-95 hover:bg-slate-50'
                      : 'bg-transparent text-slate-300 dark:text-zinc-700 cursor-not-allowed'
                  }`}
                >
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                  <span>Renvoyer le code</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Small footer info */}
      <div className="text-center text-xs font-bold text-slate-400 dark:text-zinc-600 mt-auto pt-6 z-10">
        Propulsé par MTN MoMo Bénin
      </div>
    </div>
  );
}
