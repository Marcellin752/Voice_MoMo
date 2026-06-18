import { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as usersService from "../services/users.service";
import { StorageService } from "../services/storage.service";

export type AppLanguage = "fr" | "en";

type LanguageContextType = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: string) => string;
};

const translations: Record<AppLanguage, Record<string, string>> = {
  fr: {
    nav_home: "Accueil",
    nav_transactions: "Transactions",
    nav_contacts: "Contacts",
    nav_settings: "Paramètres",
    settings_title: "Paramètres",
    settings_profile_title: "Mon Profil",
    settings_profile_subtitle: "Gérer les infos",
    settings_preferences: "Préférences",
    settings_dark_mode: "Mode Sombre",
    settings_dark_mode_subtitle: "Apparence de l'application",
    settings_language: "Langue",
    settings_security: "Sécurité",
    settings_pin: "Code PIN MTN",
    settings_pin_subtitle: "Modifier le code secret",
    settings_logout: "Se déconnecter",
    lang_title: "Langue",
    back: "Retour",
    lang_current: "Langue actuelle",
    lang_saved_ok: "Langue mise à jour avec succès.",
    lang_load_error: "Impossible de charger vos préférences de langue.",
    lang_save_error: "Échec de la mise à jour de la langue.",
    save: "Enregistrer",
    saving: "Enregistrement...",
    home_greeting: "Bonjour",
    home_balance_title: "Solde Mobile Money",
    home_history_title: "Historique récent",
    home_see_all: "Voir tout",
    home_no_tx: "Aucune transaction récente.",
    profile_title: "Mon Profil",
    profile_subtitle: "Gérez vos informations personnelles et votre photo de profil.",
    profile_edit: "Modifier",
    profile_name: "Nom complet",
    profile_email: "Email",
    profile_phone: "Téléphone",
    profile_balance: "Solde",
    profile_cancel: "Annuler",
    profile_saved_ok: "Informations mises à jour avec succès.",
  },
  en: {
    nav_home: "Home",
    nav_transactions: "Transactions",
    nav_contacts: "Contacts",
    nav_settings: "Settings",
    settings_title: "Settings",
    settings_profile_title: "My Profile",
    settings_profile_subtitle: "Manage info",
    settings_preferences: "Preferences",
    settings_dark_mode: "Dark Mode",
    settings_dark_mode_subtitle: "Application appearance",
    settings_language: "Language",
    settings_security: "Security",
    settings_pin: "MTN PIN code",
    settings_pin_subtitle: "Change secret code",
    settings_logout: "Log out",
    lang_title: "Language",
    back: "Back",
    lang_current: "Current language",
    lang_saved_ok: "Language updated successfully.",
    lang_load_error: "Unable to load your language preferences.",
    lang_save_error: "Failed to update language.",
    save: "Save",
    saving: "Saving...",
    home_greeting: "Hello",
    home_balance_title: "Mobile Money balance",
    home_history_title: "Recent history",
    home_see_all: "See all",
    home_no_tx: "No recent transactions.",
    profile_title: "My Profile",
    profile_subtitle: "Manage your personal information and profile photo.",
    profile_edit: "Edit",
    profile_name: "Full name",
    profile_email: "Email",
    profile_phone: "Phone",
    profile_balance: "Balance",
    profile_cancel: "Cancel",
    profile_saved_ok: "Profile updated successfully.",
  },
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>("fr");

  useEffect(() => {
    async function loadLanguage() {
      // 1. Lire immédiatement depuis les préférences locales (SharedPreferences)
      const localLang = await StorageService.get<AppLanguage>('momo.language');
      if (localLang === 'fr' || localLang === 'en') {
        setLanguageState(localLang);
      }
      
      // 2. Tenter de charger/synchroniser avec le serveur
      try {
        const res = await usersService.getLanguage();
        if (res.language && res.language !== localLang) {
          setLanguageState(res.language);
          await StorageService.set('momo.language', res.language);
        }
      } catch (err) {
        console.warn("⚠️ Impossible de synchroniser la langue avec le backend", err);
      }
    }
    loadLanguage();
  }, []);

  const changeLanguage = async (lang: AppLanguage) => {
    setLanguageState(lang);
    await StorageService.set('momo.language', lang);
    try {
      await usersService.updateLanguage(lang);
    } catch (err) {
      console.warn("⚠️ Échec d'envoi de la langue au backend", err);
    }
  };

  const value = useMemo<LanguageContextType>(
    () => ({
      language,
      setLanguage: changeLanguage,
      t: (key: string) => translations[language][key] || key,
    }),
    [language]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}


