import { motion, AnimatePresence } from "motion/react";
import { Phone, Users } from "lucide-react";

export type AmbiguousContact = {
  name: string;
  phone: string;
};

interface ContactDisambiguationModalProps {
  isOpen: boolean;
  contacts: AmbiguousContact[];
  query: string;
}

const getBubbleStyle = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  return {
    backgroundColor: `hsla(${h}, 70%, 45%, 0.15)`,
    color: `hsl(${h}, 70%, 35%)`,
  };
};

const getInitials = (name: string) => {
  const parts = (name || "?").split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

/** Affichage informatif uniquement — la sélection se fait par la voix. */
export default function ContactDisambiguationModal({
  isOpen,
  contacts,
  query,
}: ContactDisambiguationModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end pointer-events-none">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 220 }}
            className="relative w-full max-w-md mx-auto bg-white dark:bg-[#1A1A1A] rounded-t-[40px] shadow-2xl border-t border-slate-100 dark:border-white/5 flex flex-col max-h-[70vh] overflow-hidden"
          >
            <div className="w-12 h-1.5 bg-slate-200 dark:bg-zinc-700 rounded-full mx-auto my-3 shrink-0" />

            <div className="px-6 pb-4 flex items-start gap-3 shrink-0">
              <div className="w-10 h-10 rounded-2xl bg-[#FFCC00]/20 flex items-center justify-center shrink-0">
                <Users size={20} className="text-[#004F71] dark:text-[#FFCC00]" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                  Choisissez à la voix
                </h3>
                <p className="text-xs font-medium text-slate-400 dark:text-zinc-500 mt-0.5">
                  J'ai compris « {query} ». Dites le numéro (1, 2, 3…) ou le nom complet du contact.
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-8 space-y-3">
              {contacts.map((contact, i) => {
                const bubble = getBubbleStyle(contact.name || "?");
                return (
                  <motion.div
                    key={`${contact.phone}-${i}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="w-full flex items-center justify-between p-4 bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-[#004F71]/10 dark:bg-[#FFCC00]/10 flex items-center justify-center font-black text-sm text-[#004F71] dark:text-[#FFCC00] shrink-0">
                        {i + 1}
                      </div>
                      <div
                        style={bubble}
                        className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0"
                      >
                        {getInitials(contact.name)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-white text-sm">
                          {contact.name || "Contact inconnu"}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Phone size={10} className="text-slate-400" />
                          <span className="text-xs font-medium text-slate-500 dark:text-zinc-400 tracking-wide">
                            {contact.phone}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
