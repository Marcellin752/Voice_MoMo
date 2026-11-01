import { Outlet, NavLink } from "react-router";
import { Home, ArrowLeftRight, Settings, Users, Mic } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { motion, AnimatePresence } from "motion/react";
import { useVoiceAssistantNLP } from "../hooks/useVoiceAssistantNLP";
import ContactDisambiguationModal from "./ContactDisambiguationModal";
import SecurePinModal from "./SecurePinModal";

export default function Layout() {
  const { t } = useLanguage();
  const { token } = useAuth();

  const {
    status,
    transcript,
    feedback,
    startListening,
    stopListening,
    cancelAction,
    isSpeaking,
    ambiguityContacts,
    ambiguityQuery,
    resolveAmbiguity,
    showPinModal,
    pinPrompt,
    executeTransferWithPin,
  } = useVoiceAssistantNLP(undefined, token ?? undefined);

  const choosingContact = !!ambiguityContacts && ambiguityContacts.length > 0;

  const handleMicClick = () => {
    if (status === 'idle') {
      startListening();
    } else if (status === 'listening' || status === 'awaiting_voice_biometric') {
      stopListening();
    } else if (
      status === 'awaiting_confirmation' ||
      status === 'awaiting_disambiguation' ||
      (status === 'processing' && isSpeaking)
    ) {
      // L'utilisateur veut répondre (oui / non / numéro du contact), ou coupe l'app qui parle
      // encore : on se tait et on ouvre le micro tout de suite au lieu d'annuler.
      // L'annulation se dit à voix haute (« non », « annule »).
      startListening();
    } else if (status === 'processing' || status === 'awaiting_pin') {
      cancelAction();
    }
  };

  const hint =
    status === 'awaiting_pin'
      ? 'Saisissez le PIN sur le clavier (jamais à voix haute).'
      : status === 'awaiting_voice_biometric'
        ? 'Dites la phrase courte demandée pour confirmer votre voix.'
        : choosingContact
          ? 'Touchez le bon contact, ou dites son numéro dans la liste. Touchez le micro pour finir de parler.'
          : status === 'awaiting_confirmation' || status === 'listening'
          ? 'Parlez, puis touchez le micro pour finir. Dites « non » pour annuler.'
          : null;

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-[#121212] w-full max-w-md mx-auto relative overflow-hidden transition-colors duration-300">
      <div className="flex-1 overflow-y-auto pb-[72px] no-scrollbar relative">
        <Outlet />
      </div>

      {/* z-[60] : reste touchable au-dessus de la modale de choix de contact (z-50), pour arrêter le micro. */}
      <div className="absolute bottom-[92px] right-6 z-[60] flex flex-col items-end gap-3 pointer-events-none max-w-[280px]">
        <AnimatePresence>
          {status !== 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.9 }}
              className="bg-white/95 dark:bg-[#1A1A1A]/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-100 dark:border-white/10 w-full max-w-[240px] pointer-events-auto text-right"
            >
              <p className="text-[#004F71] dark:text-[#FFCC00] text-sm font-bold italic">"{transcript || '...'}"</p>
              {feedback && (
                <p className={`text-xs mt-1 font-medium ${status === 'error' ? 'text-red-500' : 'text-slate-500 dark:text-zinc-400'}`}>
                  {feedback}
                </p>
              )}
              {hint && (
                <p className="text-[10px] mt-2 text-slate-400 dark:text-zinc-500 font-medium">{hint}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col items-center pointer-events-auto shrink-0">
          <motion.button
            onClick={handleMicClick}
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.05 }}
            disabled={status === 'awaiting_pin'}
            className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-2xl border-[3px] border-white dark:border-[#1A1A1A] cursor-pointer transition-colors duration-300 ${
              status === 'idle'
                ? 'bg-[#004F71] text-white hover:bg-[#003B5C]'
                : status === 'awaiting_pin'
                  ? 'bg-slate-400 text-white cursor-not-allowed'
                  : 'bg-red-500 text-white hover:bg-red-600'
            }`}
            title="Assistant Vocal"
          >
            {(status === 'listening' || status === 'awaiting_voice_biometric') ? (
              <>
                <motion.div
                  animate={{ scale: [1, 1.8], opacity: [0.4, 0] }}
                  transition={{ repeat: Infinity, duration: 1.6, ease: "easeOut" }}
                  className="absolute inset-0 rounded-full bg-red-500/40"
                />
                <motion.div
                  animate={{ scale: [1, 2.3], opacity: [0.2, 0] }}
                  transition={{ repeat: Infinity, duration: 1.6, delay: 0.4, ease: "easeOut" }}
                  className="absolute inset-0 rounded-full bg-red-500/25"
                />
              </>
            ) : null}

            {status === 'processing' ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                className="absolute inset-2 border-2 border-white border-t-transparent rounded-full"
              />
            ) : (
              <Mic size={22} className={(status === 'listening' || status === 'awaiting_voice_biometric') ? 'animate-pulse' : ''} />
            )}
          </motion.button>
        </div>
      </div>

      <nav className="absolute bottom-0 left-0 right-0 h-[72px] bg-white dark:bg-[#1A1A1A] border-t border-slate-200 dark:border-white/10 flex justify-between items-center px-4 pb-2 z-50 transition-colors duration-300 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] dark:shadow-none">
        <NavItem to="/app" icon={<Home size={22} />} label={t("nav_home")} end />
        <NavItem to="/app/transactions" icon={<ArrowLeftRight size={22} />} label={t("nav_transactions")} />
        <NavItem to="/app/contacts" icon={<Users size={22} />} label={t("nav_contacts")} />
        <NavItem to="/app/settings" icon={<Settings size={22} />} label={t("nav_settings")} />
      </nav>

      <ContactDisambiguationModal
        isOpen={choosingContact}
        contacts={ambiguityContacts || []}
        query={ambiguityQuery}
        onSelect={resolveAmbiguity}
      />

      <SecurePinModal
        isOpen={showPinModal}
        prompt={pinPrompt}
        onSubmit={executeTransferWithPin}
        onCancel={cancelAction}
      />
    </div>
  );
}

function NavItem({ to, icon, label, end }: { to: string; icon: React.ReactNode; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center space-y-1 w-20 py-2 transition-colors ${
          isActive ? "text-[#004F71] dark:text-[#FFCC00]" : "text-slate-400 dark:text-zinc-500 hover:text-[#004F71] dark:hover:text-white"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <div className={`p-1.5 rounded-xl transition-colors ${isActive ? 'bg-[#FFCC00] dark:bg-[#FFCC00]/10 text-[#004F71] dark:text-[#FFCC00]' : 'text-slate-400 dark:text-zinc-500'}`}>
             {icon}
          </div>
          <span className={`text-[10px] font-bold ${isActive ? 'text-[#004F71] dark:text-[#FFCC00]' : 'text-slate-400 dark:text-zinc-500'}`}>{label}</span>
        </>
      )}
    </NavLink>
  );
}
