import { ChevronRight, User, Settings, LogOut, Check, Moon, Sun } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";

export default function SettingsScreen() {
  const { theme, toggleTheme } = useTheme();
  const { logout } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="flex flex-col min-h-full w-full bg-slate-50 dark:bg-[#121212] px-6 py-8 transition-colors duration-300">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{t("settings_title")}</h1>
      </div>

      <Link
        to="/app/settings/profile"
        className="w-full bg-white dark:bg-[#1A1A1A] rounded-3xl p-5 flex justify-between items-center mb-8 shadow-sm border border-slate-100 dark:border-white/5 transition-colors duration-300"
      >
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-slate-100 dark:bg-white/5 rounded-2xl text-slate-600 dark:text-zinc-400">
            <User size={24} />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white text-lg">{t("settings_profile_title")}</h4>
            <p className="text-sm font-medium text-[#004F71] dark:text-[#FFCC00]">{t("settings_profile_subtitle")}</p>
          </div>
        </div>
        <ChevronRight size={24} className="text-slate-400" />
      </Link>

      <div className="space-y-6">
        <div>
          <h3 className="text-xs font-bold tracking-widest text-slate-500 dark:text-zinc-500 uppercase px-2 mb-3">{t("settings_preferences")}</h3>

          <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl overflow-hidden shadow-sm border border-slate-100 dark:border-white/5 transition-colors duration-300">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center space-x-4">
                <div className="p-2.5 bg-blue-50 dark:bg-[#004F71]/20 rounded-xl text-[#004F71] dark:text-[#FFCC00]">
                  {theme === 'dark' ? <Moon size={22} /> : <Sun size={22} />}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">{t("settings_dark_mode")}</h4>
                  <p className="text-xs font-medium text-slate-500">{t("settings_dark_mode_subtitle")}</p>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={toggleTheme}
                className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ${theme === 'dark' ? 'bg-[#FFCC00]' : 'bg-slate-200'}`}
              >
                <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            <SettingsItem
              to="/app/settings/language"
              icon={<Settings size={22} />}
              title={t("settings_language")}
              subtitle={language === "fr" ? "Français" : "English"}
              color="text-[#004F71] dark:text-white"
              bgColor="bg-slate-50 dark:bg-white/5"
            />
          </div>
        </div>

        <div>
          <h3 className="text-xs font-bold tracking-widest text-slate-500 dark:text-zinc-500 uppercase px-2 mb-3">{t("settings_security")}</h3>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl overflow-hidden shadow-sm border border-slate-100 dark:border-white/5 transition-colors duration-300">
            <SettingsItem
              to="/app/settings/pin"
              icon={<Check size={22} />}
              title={t("settings_pin")}
              subtitle={t("settings_pin_subtitle")}
              color="text-green-600 dark:text-green-400"
              bgColor="bg-green-50 dark:bg-green-500/10"
            />
          </div>
        </div>

        <div className="pt-4">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-between p-5 bg-white dark:bg-[#1A1A1A] rounded-3xl shadow-sm border border-slate-100 dark:border-white/5 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors group"
          >
            <div className="flex items-center space-x-4">
              <div className="p-2.5 bg-red-50 dark:bg-red-500/10 rounded-xl text-red-500 group-hover:bg-red-500 group-hover:text-white transition-colors">
                <LogOut size={22} />
              </div>
              <div>
                <h4 className="font-bold text-red-500">{t("settings_logout")}</h4>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsItem({
  to,
  icon,
  title,
  subtitle,
  color,
  bgColor,
}: {
  to: string,
  icon: React.ReactNode,
  title: string,
  subtitle: string,
  color: string,
  bgColor: string,
}) {
  return (
    <Link
      to={to}
      className="w-full flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer text-left"
    >
      <div className="flex items-center space-x-4">
        <div className={`p-2.5 rounded-xl ${color} ${bgColor}`}>
          {icon}
        </div>
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white">{title}</h4>
          <p className="text-xs font-medium text-slate-500">{subtitle}</p>
        </div>
      </div>
      <ChevronRight size={20} className="text-slate-300 dark:text-zinc-600" />
    </Link>
  );
}
