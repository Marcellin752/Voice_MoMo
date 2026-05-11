import { SmsListenerService } from '../services/sms.service';
import { useState, useEffect, SetStateAction } from "react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { Mic, Eye, EyeOff, Bell, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useVoiceAssistantNLP } from "../hooks/useVoiceAssistantNLP";
import { useNavigate } from "react-router";
import * as usersService from "../services/users.service";
import * as transactionsService from "../services/transactions.service";
import type { ApiProfile, ApiTransaction } from "../utils/api";
import { useLanguage } from "../contexts/LanguageContext";

const PROFILE_UPDATED_EVENT = "momo:profile-updated";

export default function HomeScreen() {
  const { status, transcript, feedback, startListening, stopListening, confirmAction, cancelAction, parsedIntent } = useVoiceAssistantNLP();
  const { t } = useLanguage();
  const [showBalance, setShowBalance] = useState(false);
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Pick<ApiProfile, "fullName"> & { avatarUrl?: string }>({
    fullName: "Utilisateur",
    avatarUrl: "",
  });
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<ApiTransaction[]>([]);

  useEffect(() => {
    const loadProfile = () => {
      usersService
        .getProfile()
        .then((p: { fullName: any; avatarUrl?: string }) =>
          setProfile({ fullName: p.fullName, avatarUrl: p.avatarUrl || "" })
        )
        .catch(() => {});
    };

    loadProfile();

    usersService.getBalance()
      .then((b: { balance: SetStateAction<number | null>; }) => setBalance(b.balance))
      .catch(() => {});

    transactionsService.getTransactions()
      .then((res: { transactions: any[]; }) => setTransactions(res.transactions.slice(0, 5)))
      .catch(() => {});

    const onProfileUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ fullName?: string; avatarUrl?: string }>;
      const fullName = customEvent.detail?.fullName;
      const avatarUrl = customEvent.detail?.avatarUrl;
      setProfile((prev) => ({
        fullName: fullName || prev.fullName,
        avatarUrl: avatarUrl ?? prev.avatarUrl,
      }));
    };

    window.addEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated);
    
    // SMS Listener implementation
    SmsListenerService.startListening((msg) => {
      const extractedLevel = SmsListenerService.extractBalance(msg);
      if (extractedLevel !== null) {
        setBalance(extractedLevel);
        usersService.updateBalance(extractedLevel).catch(console.error);
      }
    });

    return () => {
      SmsListenerService.stopListening();
      window.removeEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated);
    };

  }, []);

  const formattedBalance = balance !== null
    ? balance.toLocaleString("fr-FR")
    : "••••••";

  return (
    <div className="flex flex-col min-h-full w-full relative bg-slate-50 dark:bg-[#121212] transition-colors duration-300">

      {/* Top Section - MTN Yellow Header */}
      <div className="bg-[#FFCC00] pt-12 pb-16 px-6 rounded-b-[40px] shadow-sm relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/20 rounded-full blur-2xl"></div>
        <div className="absolute top-10 -left-10 w-32 h-32 bg-white/20 rounded-full blur-2xl"></div>

        <header className="flex justify-between items-center mb-8 relative z-10 text-[#004F71]">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-full bg-white border-2 border-white overflow-hidden shadow-sm">
              <ImageWithFallback
                src={
                  profile.avatarUrl ||
                  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&auto=format&fit=crop"
                }
                alt="User Avatar"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="text-xs font-bold opacity-80 uppercase tracking-widest">{t("home_greeting")}</p>
              <h2 className="text-lg font-black tracking-tight">{profile.fullName}</h2>
            </div>
          </div>
          <button
            onClick={() => navigate("/app/notifications")}
            className="p-2.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            aria-label="Afficher les notifications"
          >
            <Bell size={22} className="text-[#004F71]" />
          </button>
        </header>
      </div>

      {/* Balance Card - Overlapping Header */}
      <div className="px-6 -mt-10 relative z-20 mb-6">
        <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-6 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-white/5 transition-colors duration-300">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-bold text-slate-500 dark:text-zinc-400">{t("home_balance_title")}</p>
            <button
              onClick={() => setShowBalance(!showBalance)}
              className="p-2 bg-slate-50 dark:bg-white/5 rounded-full text-[#004F71] dark:text-[#FFCC00] hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            >
              {showBalance ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <div className="flex items-baseline space-x-2">
            <h3 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">
              {showBalance ? formattedBalance : "••••••"}
            </h3>
            <span className="text-lg font-bold text-slate-500 dark:text-zinc-500">FCFA</span>
          </div>
        </div>
      </div>

      {/* Voice Assistant - Centered */}
      <div className="flex flex-col items-center justify-center py-8 gap-4">
        <AnimatePresence>
          {status !== 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="bg-white dark:bg-[#1A1A1A] p-4 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-white/10 max-w-[260px]"
            >
              <p className="text-[#004F71] dark:text-[#FFCC00] text-sm font-bold italic">"{transcript || '...'}"</p>
              {feedback && (
                <p className={`text-xs mt-1 font-medium ${status === 'error' ? 'text-red-500' : 'text-slate-500 dark:text-zinc-400'}`}>
                  {feedback}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          onClick={status === 'idle' ? startListening : stopListening}
          whileTap={{ scale: 0.9 }}
          className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-xl border-[3px] border-slate-50 dark:border-[#121212] ${
            status === 'idle'
              ? 'bg-[#004F71] text-white hover:bg-[#003B5C]'
              : 'bg-red-500 text-white'
          }`}
        >
          {status === 'listening' || status === 'processing' ? (
            <motion.div
              animate={{
                boxShadow: ["0 0 0 0px rgba(239, 68, 68, 0.4)", "0 0 0 20px rgba(239, 68, 68, 0)"]
              }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="absolute inset-0 rounded-full"
            />
          ) : null}
          <Mic size={32} className={status === 'listening' ? 'animate-pulse' : ''} />
        </motion.button>

        {/* Boutons Confirmer/Annuler - affichés quand confirmation nécessaire */}
        {parsedIntent?.needs_confirmation && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 mt-4"
          >
            <button
              onClick={confirmAction}
              className="bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg transition-colors"
            >
              Confirmer
            </button>
            <button
              onClick={cancelAction}
              className="bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg transition-colors"
            >
              Annuler
            </button>
          </motion.div>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="px-6 pb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">{t("home_history_title")}</h3>
          <button
            type="button"
            onClick={() => navigate("/app/transactions")}
            className="text-sm font-bold text-[#004F71] dark:text-[#FFCC00] cursor-pointer"
          >
            {t("home_see_all")}
          </button>
        </div>
        <div className="space-y-3">
          {transactions.length > 0 ? (
            transactions.map((tx) => (
              <TransactionItem
                key={tx.id}
                type={tx.type === 'recharge' ? 'in' : tx.type}
                title={tx.title}
                time={`${tx.dayLabel}, ${tx.time}`}
                amount={tx.amount}
              />
            ))
          ) : (
            <p className="text-sm text-slate-400 dark:text-zinc-500 text-center py-4">{t("home_no_tx")}</p>
          )}
        </div>
      </div>

    </div>
  );
}

function TransactionItem({ type, title, time, amount }: { type: 'in' | 'out', title: string, time: string, amount: string }) {
  const isOut = type === 'out';
  return (
    <div className="flex items-center justify-between p-4 bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 transition-colors duration-300">
      <div className="flex items-center space-x-4">
        <div className={`p-2.5 rounded-xl ${isOut ? 'bg-slate-50 dark:bg-white/5 text-slate-500' : 'bg-green-50 dark:bg-green-500/10 text-green-600'}`}>
          {isOut ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
        </div>
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white text-sm">{title}</h4>
          <p className="text-xs font-medium text-slate-500 mt-0.5">{time}</p>
        </div>
      </div>
      <span className={`font-black text-sm ${isOut ? 'text-slate-900 dark:text-white' : 'text-green-600 dark:text-green-400'}`}>
        {amount}
      </span>
    </div>
  );
}
