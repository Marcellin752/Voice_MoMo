import { Outlet, NavLink, useLocation } from "react-router";
import { Home, ArrowLeftRight, Settings, Users, Mic } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { motion, AnimatePresence } from "motion/react";
import { useVoiceAssistantNLP } from "../hooks/useVoiceAssistantNLP";
import ContactDisambiguationModal from "./ContactDisambiguationModal";

export default function Layout() {
  const { t } = useLanguage();
  const location = useLocation();
  const isHome = location.pathname === "/app" || location.pathname === "/app/";

  const {
    status,
    transcript,
    feedback,
    startListening,
    stopListening,
    confirmAction,
    cancelAction,
    parsedIntent,
    ambiguityContacts,
    ambiguityQuery,
    resolveAmbiguity,
  } = useVoiceAssistantNLP();

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-[#121212] w-full max-w-md mx-auto relative overflow-hidden transition-colors duration-300">
      <div className="flex-1 overflow-y-auto pb-[72px] no-scrollbar relative">
        <Outlet />
      </div>

      {/* Floating Voice Assistant - Fixed just above bottom nav and slightly right of center */}
      {/* Assistant Vocal Flottant - Positionné en bas à droite, disponible globalement sur toutes les pages */}
      <div className="absolute bottom-[92px] right-6 z-40 flex flex-col items-end gap-3 pointer-events-none max-w-[280px]">
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
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col items-center pointer-events-auto shrink-0">
          <motion.button
            onClick={status === 'idle' ? startListening : stopListening}
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.05 }}
            className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-2xl border-[3px] border-white dark:border-[#1A1A1A] cursor-pointer transition-colors duration-300 ${
              status === 'idle'
                ? 'bg-[#004F71] text-white hover:bg-[#003B5C]'
                : 'bg-red-500 text-white hover:bg-red-600'
            }`}
            title="Assistant Vocal"
          >
            {status === 'listening' ? (
              <>
                {/* Ondes radar multiples pour un effet d'enregistrement audio hyper qualitatif */}
                <motion.div
                  animate={{
                    scale: [1, 1.8],
                    opacity: [0.4, 0]
                  }}
                  transition={{ repeat: Infinity, duration: 1.6, ease: "easeOut" }}
                  className="absolute inset-0 rounded-full bg-red-500/40"
                />
                <motion.div
                  animate={{
                    scale: [1, 2.3],
                    opacity: [0.2, 0]
                  }}
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
              <Mic size={22} className={status === 'listening' ? 'animate-pulse' : ''} />
            )}
          </motion.button>

          {/* Boutons Confirmer/Annuler en dessous du bouton */}
          {parsedIntent?.needs_confirmation && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-2 mt-3 justify-center"
            >
              <button
                onClick={confirmAction}
                className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-xl font-bold shadow-lg transition-colors text-[10px] cursor-pointer"
              >
                Confirmer
              </button>
              <button
                onClick={cancelAction}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-xl font-bold shadow-lg transition-colors text-[10px] cursor-pointer"
              >
                Annuler
              </button>
            </motion.div>
          )}
        </div>
      </div>

      <nav className="absolute bottom-0 left-0 right-0 h-[72px] bg-white dark:bg-[#1A1A1A] border-t border-slate-200 dark:border-white/10 flex justify-between items-center px-4 pb-2 z-50 transition-colors duration-300 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] dark:shadow-none">
        <NavItem to="/app" icon={<Home size={22} />} label={t("nav_home")} end />
        <NavItem to="/app/transactions" icon={<ArrowLeftRight size={22} />} label={t("nav_transactions")} />
        <NavItem to="/app/contacts" icon={<Users size={22} />} label={t("nav_contacts")} />
        <NavItem to="/app/settings" icon={<Settings size={22} />} label={t("nav_settings")} />
      </nav>

      {/* Modale de désambiguïsation vocale (Globale) */}
      <ContactDisambiguationModal
        isOpen={status === 'awaiting_disambiguation'}
        contacts={ambiguityContacts || []}
        query={ambiguityQuery}
        onSelect={(contact) => {
          resolveAmbiguity(contact);
        }}
        onClose={() => {
          cancelAction();
        }}
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
