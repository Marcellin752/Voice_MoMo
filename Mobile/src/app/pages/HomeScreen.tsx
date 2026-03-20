import { useMemo, useState } from "react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { Mic, Eye, EyeOff, Send, Download, Phone, Wifi, CreditCard, Landmark, FileText, Bell, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useVoiceAssistant } from "../hooks/useVoiceAssistant";
import { useNavigate } from "react-router";
import { getProfile } from "../utils/localData";

export default function HomeScreen() {
  const { status, transcript, feedback, startListening, stopListening } = useVoiceAssistant();
  const [showBalance, setShowBalance] = useState(false);
  const navigate = useNavigate();
  const profile = useMemo(() => getProfile(), []);

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
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&auto=format&fit=crop"
                alt="User Avatar"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="text-xs font-bold opacity-80 uppercase tracking-widest">Bonjour</p>
              <h2 className="text-lg font-black tracking-tight">{profile.fullName || "Utilisateur"}</h2>
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
      <div className="px-6 -mt-10 relative z-20 mb-8">
        <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-6 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-white/5 transition-colors duration-300">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-bold text-slate-500 dark:text-zinc-400">Solde Mobile Money</p>
            <button
              onClick={() => setShowBalance(!showBalance)}
              className="p-2 bg-slate-50 dark:bg-white/5 rounded-full text-[#004F71] dark:text-[#FFCC00] hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            >
              {showBalance ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <div className="flex items-baseline space-x-2">
             <h3 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">
                {showBalance ? "15.000" : "••••••"}
             </h3>
             <span className="text-lg font-bold text-slate-500 dark:text-zinc-500">FCFA</span>
          </div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="px-6 mb-8">
        <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white tracking-tight">Services</h3>
        <div className="grid grid-cols-4 gap-4">
          <ActionIcon icon={<Send size={26} />} label="Transfert" onClick={() => navigate("/app/services/transfert")} />
          <ActionIcon icon={<Download size={26} />} label="Retrait" onClick={() => navigate("/app/services/retrait")} />
          <ActionIcon icon={<Phone size={26} />} label="Crédit" onClick={() => navigate("/app/services/credit")} />
          <ActionIcon icon={<Wifi size={26} />} label="Forfaits" onClick={() => navigate("/app/services/forfaits")} />
          <ActionIcon icon={<CreditCard size={26} />} label="MoMoPay" onClick={() => navigate("/app/services/momopay")} />
          <ActionIcon icon={<Landmark size={26} />} label="Banque" onClick={() => navigate("/app/services/banque")} />
          <ActionIcon icon={<FileText size={26} />} label="Factures" onClick={() => navigate("/app/services/factures")} />
          <button
            type="button"
            onClick={() => navigate("/app/services")}
            className="flex flex-col items-center justify-center cursor-pointer group"
            aria-label="Afficher plus de services"
          >
             <div className="w-14 h-14 rounded-[20px] bg-transparent flex items-center justify-center text-[#004F71] dark:text-[#FFCC00] group-hover:bg-slate-100 dark:group-hover:bg-white/10 transition-colors mb-1">
                <span className="font-black text-3xl">+</span>
             </div>
             <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300 text-center">Plus</span>
          </button>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="px-6 pb-32">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">Historique récent</h3>
          <button
            type="button"
            onClick={() => navigate("/app/transactions")}
            className="text-sm font-bold text-[#004F71] dark:text-[#FFCC00] cursor-pointer"
          >
            Voir tout
          </button>
        </div>
        <div className="space-y-3">
          <TransactionItem type="out" title="Achat Crédit" time="Aujourd'hui, 14:30" amount="-2 000" />
          <TransactionItem type="in" title="Dépôt Agence" time="Hier, 10:15" amount="+15 000" />
          <TransactionItem type="out" title="Transfert à Paul" time="15 Mars, 09:00" amount="-5 000" />
          <TransactionItem type="out" title="Paiement Canal+" time="12 Mars, 20:45" amount="-10 000" />
          <TransactionItem type="in" title="Réception de Marie" time="10 Mars, 11:20" amount="+8 500" />
        </div>
      </div>

      {/* Floating Voice Assistant Button (FAB) */}
      <div className="fixed bottom-[90px] w-full max-w-md mx-auto pointer-events-none z-50 flex flex-col items-end justify-end px-6 space-y-3 right-0 left-0">

        <AnimatePresence>
          {status !== 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="pointer-events-auto bg-white dark:bg-[#1A1A1A] p-4 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-white/10 max-w-[260px] mr-2"
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
          className={`pointer-events-auto relative w-16 h-16 rounded-full flex items-center justify-center shadow-xl z-20 border-[3px] border-slate-50 dark:border-[#121212] ${
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
          <Mic size={28} className={status === 'listening' ? 'animate-pulse' : ''} />
        </motion.button>

      </div>
    </div>
  );
}

function ActionIcon({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center justify-center cursor-pointer group">
      <div className="w-14 h-14 rounded-[20px] bg-transparent flex items-center justify-center text-[#004F71] dark:text-[#FFCC00] transition-all group-active:scale-95 group-hover:bg-slate-100 dark:group-hover:bg-white/10 mb-1">
        {icon}
      </div>
      <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 text-center leading-tight">
        {label}
      </span>
    </button>
  );
}

function TransactionItem({ type, title, time, amount }: { type: 'in'|'out', title: string, time: string, amount: string }) {
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
