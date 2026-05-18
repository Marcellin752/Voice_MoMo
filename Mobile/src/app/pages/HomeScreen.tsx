import { SmsListenerService } from '../services/sms.service';
import { MoMoTransactionEngine } from '../services/ussd_engine/MoMoTransactionEngine';
import { useState, useEffect, SetStateAction } from "react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { Eye, EyeOff, Bell, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router";
import * as usersService from "../services/users.service";
import * as transactionsService from "../services/transactions.service";
import type { ApiProfile, ApiTransaction } from "../utils/api";
import { useLanguage } from "../contexts/LanguageContext";
import { toast } from "sonner";

const PROFILE_UPDATED_EVENT = "momo:profile-updated";

export default function HomeScreen() {
  const { t } = useLanguage();
  const [showBalance, setShowBalance] = useState(false);
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Pick<ApiProfile, "fullName"> & { avatarUrl?: string }>({
    fullName: "Utilisateur",
    avatarUrl: "",
  });
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const loadProfile = () => {
      usersService
        .getProfile()
        .then((p: { fullName: any; avatarUrl?: string }) =>
          setProfile({ fullName: p.fullName, avatarUrl: p.avatarUrl || "" })
        )
        .catch(() => { });
    };

    loadProfile();

    // Solde affiché : priorité aux SMS MTN MoMo (patterns), puis API profil si aucun SMS exploitable
    (async () => {
      try {
        const fromSms = await SmsListenerService.readBalanceFromSmsHistory(150);
        if (fromSms !== null) {
          setBalance(fromSms);
          usersService.updateBalance(fromSms).catch(console.error);
          return;
        }
      } catch (e) {
        console.warn("Lecture solde SMS au chargement:", e);
      }
      usersService
        .getBalance()
        .then((b: { balance: SetStateAction<number | null> }) => setBalance(b.balance))
        .catch(() => { });
    })();

    transactionsService.getTransactions()
      .then((res: { transactions: any[]; }) => setTransactions(res.transactions.slice(0, 5)))
      .catch(() => { });

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
    SmsListenerService.startListening((msg, address) => {
      if (!SmsListenerService.isLikelyMtnMomoMessage(address, msg)) return;
      const extractedLevel = SmsListenerService.extractBalance(msg);
      if (extractedLevel !== null) {
        setIsUpdating(true);
        setBalance(extractedLevel);
        usersService.updateBalance(extractedLevel).catch(console.error);
        setTimeout(() => setIsUpdating(false), 2000);
      }
    });

    // Écouter les confirmations de transaction de l'engine USSD
    const onTransactionComplete = (e: Event) => {
      const { success, message, balance: newBalance } = (e as CustomEvent).detail || {};
      if (success) {
        toast.success(message || 'Transaction confirmée par MTN. 🎉');
        if (typeof newBalance === 'number') {
          setIsUpdating(true);
          setBalance(newBalance);
          setTimeout(() => setIsUpdating(false), 2000);
        }
      } else {
        // balanceUnknown = USSD envoyé mais pas de SMS reçu dans les temps
        toast.info(message || 'Transaction envoyée. Consultez vos SMS MTN pour confirmation.');
      }
    };

    window.addEventListener('momo:transaction-complete', onTransactionComplete);

    return () => {
      SmsListenerService.stopListening();
      window.removeEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated);
      window.removeEventListener('momo:transaction-complete', onTransactionComplete);
    };

  }, []);

  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pinValue, setPinValue] = useState("");

  const handleInitialRefreshClick = () => {
    // Si on a déjà mis à jour récemment, on ignore ou on force l'USSD.
    setShowPinPrompt(true);
  };

  const executeLiveRefresh = async () => {
    if (!pinValue || pinValue.length < 4) {
      toast.error('Veuillez entrer un PIN valide');
      return;
    }
    setShowPinPrompt(false);
    setIsUpdating(true);
    toast.loading("Vérification en cours via le réseau...", { id: 'ussd-refresh' });

    try {
      const engine = new MoMoTransactionEngine();
      // On tente d'abord l'USSD Direct
      const result: any = await engine.refreshBalanceLive(pinValue);

      if (result.status === 'success' || result.balance !== undefined) {
        if (result.balance !== undefined) {
          setBalance(result.balance);
          toast.success(`Solde mis à jour: ${result.balance.toLocaleString('fr-FR')} FCFA`, { id: 'ussd-refresh' });
        } else {
          // Si pas de balance extrait
          toast.success('Le solde n\'a pu être extrait automatiquement. Consultez vos SMS.', { id: 'ussd-refresh' });
        }
      } else {
        toast.error(result.error || result.message || 'Impossible de récupérer le solde', { id: 'ussd-refresh' });
      }
    } catch (error) {
      console.error('Error refreshing balance:', error);
      toast.error('Échec de la mise à jour du solde', { id: 'ussd-refresh' });
    } finally {
      setIsUpdating(false);
      setPinValue("");
    }
  };

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

      <div className="px-6 -mt-10 relative z-20 mb-6">
        <motion.div
          animate={isUpdating ? { scale: [1, 1.02, 1], borderColor: ["#f1f5f9", "#FFCC00", "#f1f5f9"] } : {}}
          className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-6 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-white/5 transition-colors duration-300"
        >
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-bold text-slate-500 dark:text-zinc-400">{t("home_balance_title")}</p>
            <div className="flex space-x-2">
              <button
                onClick={handleInitialRefreshClick}
                disabled={isUpdating}
                className="p-2 bg-slate-50 dark:bg-white/5 rounded-full text-[#004F71] dark:text-[#FFCC00] hover:bg-slate-100 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
                title="Actualiser le solde"
              >
                <motion.div animate={isUpdating ? { rotate: 360 } : {}} transition={{ repeat: isUpdating ? Infinity : 0, duration: 1 }}>
                  <ArrowDownLeft size={18} className="rotate-45" />
                </motion.div>
              </button>
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="p-2 bg-slate-50 dark:bg-white/5 rounded-full text-[#004F71] dark:text-[#FFCC00] hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              >
                {showBalance ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <h3 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">
              {showBalance ? formattedBalance : "••••••"}
            </h3>
            <span className="text-lg font-bold text-slate-500 dark:text-zinc-500">FCFA</span>
          </div>
        </motion.div>
      </div>
      {/* Spacer to separate sections cleanly */}
      <div className="h-6" />

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

      {/* PIN Refresh Modal */}
      <AnimatePresence>
        {showPinPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-100 dark:border-white/5"
            >
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Code PIN</h3>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
                Veuillez entrer votre PIN MTN pour interroger votre solde en temps réel (via USSD).
              </p>

              <input
                type="password"
                maxLength={5}
                value={pinValue}
                onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full bg-slate-50 dark:bg-black/20 text-center text-3xl font-black tracking-widest text-[#004F71] dark:text-[#FFCC00] p-4 rounded-2xl border-2 border-transparent focus:border-[#FFCC00] focus:ring-0 outline-none transition-colors mb-6"
                autoFocus
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setShowPinPrompt(false)}
                  className="flex-1 py-3.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-zinc-300 font-bold rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={executeLiveRefresh}
                  disabled={pinValue.length < 4}
                  className="flex-1 py-3.5 bg-[#004F71] dark:bg-[#FFCC00] hover:bg-[#003B5C] dark:hover:bg-[#E6B800] text-white dark:text-slate-900 font-black rounded-xl transition-colors disabled:opacity-50"
                >
                  Valider
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
