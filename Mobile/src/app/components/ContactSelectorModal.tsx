import { useState, useEffect, useRef } from "react";
import { Search, X, Phone, HelpCircle, UserCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Capacitor } from "@capacitor/core";
import { StorageService } from "../services/storage.service";

type Contact = {
  name: string[];
  tel: string[];
  email?: string[];
};

interface ContactSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (contact: { name: string; phone: string }) => void;
}

export default function ContactSelectorModal({ isOpen, onClose, onSelect }: ContactSelectorModalProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Charger les contacts natifs ou démo
  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setDebouncedSearch("");
      
      const loadContacts = async () => {
        setLoading(true);
        const cached = await StorageService.get<Contact[]>('momo.contacts');
        if (cached && cached.length > 0) {
          setContacts(cached);
        } else if (Capacitor.isNativePlatform()) {
          // Pas de cache : on lit le VRAI carnet d'adresses de l'appareil.
          // (Aucun contact factice — on n'invente jamais de numéro.)
          try {
            const { Contacts } = await import("@capacitor-community/contacts");
            const permission = await Contacts.requestPermissions();
            if (permission.contacts === "granted" || permission.contacts === "limited") {
              const result = await Contacts.getContacts({ projection: { name: true, phones: true } });
              const native: Contact[] = result.contacts
                .map((c: any) => ({
                  name: [c.name?.display || c.displayName || ""],
                  tel: (c.phones ?? []).map((p: any) => p.number).filter(Boolean),
                }))
                .filter((c) => c.name[0] && c.tel.length > 0);
              setContacts(native);
              if (native.length > 0) await StorageService.set('momo.contacts', native);
            } else {
              setContacts([]);
            }
          } catch (e) {
            console.error("[ContactSelector] Lecture contacts natifs échouée:", e);
            setContacts([]);
          }
        } else {
          // Web/tests : pas d'accès au carnet natif, liste vide (recherche manuelle).
          setContacts([]);
        }
        setLoading(false);
        
        // Focus sur l'input après l'ouverture
        setTimeout(() => {
          inputRef.current?.focus();
        }, 300);
      };
      
      loadContacts();
    }
  }, [isOpen]);

  // Implémentation du Debounce (300ms) pour filtrer de manière performante
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [search]);

  // Filtrer les contacts en fonction de la saisie debouncée
  const filtered = contacts.filter((c) => {
    const name = c.name?.[0]?.toLowerCase() ?? "";
    const tel = c.tel?.[0] ?? "";
    const q = debouncedSearch.toLowerCase().trim();
    
    if (!q) return true; // Tout afficher si vide
    return name.includes(q) || tel.includes(q);
  });

  // Gestion du cas "Un seul résultat trouvé" -> Sélection automatique directe
  useEffect(() => {
    const q = debouncedSearch.trim();
    if (q && filtered.length === 1) {
      const single = filtered[0];
      const name = single.name?.[0] || "Inconnu";
      const phone = single.tel?.[0] || "";
      
      console.log(`🎯 [CONTACT-AUTOSELECT] Un seul résultat trouvé pour "${q}" : ${name} (${phone})`);
      
      // Petit feedback visuel avant de valider automatiquement
      const timeout = setTimeout(() => {
        onSelect({ name, phone });
        onClose();
      }, 500); // Léger délai de 500ms pour laisser l'utilisateur voir la sélection automatique
      
      return () => clearTimeout(timeout);
    }
  }, [debouncedSearch, filtered, onSelect, onClose]);

  // Générer des couleurs de bulles harmonieuses basées sur le nom
  const getBubbleStyle = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash % 360);
    return {
      backgroundColor: `hsla(${h}, 70%, 45%, 0.15)`,
      color: `hsl(${h}, 70%, 40%)`,
    };
  };

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* Overlay avec flou d'arrière-plan */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Corps de la Bottom Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 220 }}
            className="relative w-full max-w-md mx-auto bg-white dark:bg-[#1A1A1A] rounded-t-[40px] shadow-2xl border-t border-slate-100 dark:border-white/5 flex flex-col max-h-[85vh] overflow-hidden"
          >
            {/* Barre de drag décorative */}
            <div className="w-12 h-1.5 bg-slate-200 dark:bg-zinc-700 rounded-full mx-auto my-3 shrink-0" />

            {/* Header */}
            <div className="px-6 pb-4 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Sélectionner un contact</h3>
                <p className="text-xs font-medium text-slate-400 dark:text-zinc-500">
                  Recherchez par nom ou numéro MTN
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 bg-slate-100 dark:bg-white/5 rounded-full text-slate-400 dark:text-zinc-500 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Barre de recherche */}
            <div className="px-6 pb-4 shrink-0">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <Search size={18} />
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Saisissez un nom ou un numéro..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white border border-slate-100 dark:border-white/5 rounded-2xl py-3.5 pl-11 pr-4 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-[#FFCC00]/50 focus:border-[#FFCC00] transition-all text-sm"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Indicateur de chargement / statut */}
            {loading && (
              <div className="px-6 py-1 shrink-0 flex items-center gap-2 text-xs font-bold text-slate-400">
                <span className="w-3.5 h-3.5 border-2 border-[#004F71]/30 border-t-[#004F71] rounded-full animate-spin" />
                Chargement des contacts...
              </div>
            )}

            {/* Liste des résultats */}
            <div className="flex-1 overflow-y-auto px-6 pb-8 space-y-3">
              {/* Cas : 1 seul résultat trouvé (Indicateur visuel d'auto-sélection) */}
              {search.trim() !== "" && filtered.length === 1 && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#FFCC00]/10 border border-[#FFCC00]/30 text-xs font-bold text-[#004F71] dark:text-[#FFCC00] animate-pulse">
                  <UserCheck size={14} />
                  Correspondance unique ! Sélection automatique en cours...
                </div>
              )}

              {/* Cas : Aucun contact trouvé */}
              {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
                    <HelpCircle size={28} className="text-red-500" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-white text-sm">Aucun contact trouvé</h4>
                    <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-[200px] mx-auto mt-1">
                      Aucun nom ou numéro ne correspond à "{search}"
                    </p>
                  </div>
                  <button
                    onClick={() => setSearch("")}
                    className="text-xs font-bold text-[#004F71] dark:text-[#FFCC00] hover:underline"
                  >
                    Réinitialiser la recherche
                  </button>
                </div>
              )}

              {/* Liste filtrée */}
              {filtered.length > 0 &&
                filtered.map((contact, i) => {
                  const name = contact.name?.[0] || "Inconnu";
                  const phone = contact.tel?.[0] || "";
                  const bubble = getBubbleStyle(name);
                  
                  return (
                    <button
                      key={`${name}-${i}`}
                      onClick={() => {
                        onSelect({ name, phone });
                        onClose();
                      }}
                      className="w-full flex items-center justify-between p-3.5 bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 hover:border-[#FFCC00]/40 transition-all active:scale-[0.98] text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          style={bubble}
                          className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
                        >
                          {getInitials(name)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 dark:text-white text-sm">{name}</p>
                          {phone && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Phone size={10} className="text-slate-400" />
                              <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">{phone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
