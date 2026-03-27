import { Outlet, NavLink } from "react-router";
import { Home, ArrowLeftRight, Settings, Users } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";

export default function Layout() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-[#121212] w-full max-w-md mx-auto relative overflow-hidden transition-colors duration-300">
      <div className="flex-1 overflow-y-auto pb-[72px] no-scrollbar relative">
        <Outlet />
      </div>

      <nav className="absolute bottom-0 left-0 right-0 h-[72px] bg-white dark:bg-[#1A1A1A] border-t border-slate-200 dark:border-white/10 flex justify-between items-center px-4 pb-2 z-50 transition-colors duration-300 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] dark:shadow-none">
        <NavItem to="/app" icon={<Home size={22} />} label={t("nav_home")} end />
        <NavItem to="/app/transactions" icon={<ArrowLeftRight size={22} />} label={t("nav_transactions")} />
        <NavItem to="/app/contacts" icon={<Users size={22} />} label={t("nav_contacts")} />
        <NavItem to="/app/settings" icon={<Settings size={22} />} label={t("nav_settings")} />
      </nav>
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
