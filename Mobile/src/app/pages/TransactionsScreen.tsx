import { Search, Filter, ArrowDownLeft, ArrowUpRight, Info, Check } from "lucide-react";

export default function TransactionsScreen() {
  return (
    <div className="flex flex-col min-h-full w-full bg-slate-50 dark:bg-[#121212] px-6 py-8 transition-colors duration-300">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Transactions</h1>
        <button className="p-2 text-slate-400 hover:text-[#004F71] dark:hover:text-[#FFCC00] transition-colors">
          <Info size={24} />
        </button>
      </div>

      <div className="flex space-x-3 mb-8">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
            <Search size={20} />
          </div>
          <input 
            type="text" 
            placeholder="Rechercher..." 
            className="w-full bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white border border-slate-200 dark:border-white/5 rounded-2xl py-4 pl-12 pr-4 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-[#FFCC00]/50 focus:border-[#FFCC00] transition-all shadow-sm"
          />
        </div>
        <button className="bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/5 p-4 rounded-2xl text-slate-500 hover:text-[#004F71] dark:hover:text-[#FFCC00] transition-colors shadow-sm">
          <Filter size={20} />
        </button>
      </div>

      <div className="flex space-x-3 mb-8 overflow-x-auto no-scrollbar pb-2">
        <FilterPill label="TOUT" active />
        <FilterPill label="REÇU" icon={<ArrowDownLeft size={16} />} />
        <FilterPill label="DÉPENSE" icon={<ArrowUpRight size={16} />} />
      </div>

      <div className="space-y-8">
        <div>
          <h3 className="text-xs font-bold tracking-widest text-slate-500 uppercase mb-4 px-2">Aujourd'hui</h3>
          <div className="space-y-3">
            <TransactionItem 
              type="in"
              title="Dépôt Agence"
              desc="Référence: 19384729"
              time="15:32"
              amount="+25 000"
              icon={<ArrowDownLeft size={20} />}
            />
          </div>
        </div>

        <div>
          <h3 className="text-xs font-bold tracking-widest text-slate-500 uppercase mb-4 px-2">Hier</h3>
          <div className="space-y-3">
            <TransactionItem 
              type="out"
              title="Achat Crédit"
              desc="Vers: 0123456789"
              time="19:27"
              amount="-2 000"
              icon={<ArrowUpRight size={20} />}
            />
            <TransactionItem 
              type="out"
              title="Paiement Marchand"
              desc="Super U"
              time="11:45"
              amount="-15 500"
              icon={<ArrowUpRight size={20} />}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterPill({ label, icon, active }: { label: string, icon?: React.ReactNode, active?: boolean }) {
  return (
    <button className={`flex items-center space-x-2 px-6 py-3 rounded-2xl whitespace-nowrap font-bold text-sm transition-all ${
      active 
      ? 'bg-[#004F71] dark:bg-[#FFCC00] text-white dark:text-[#004F71] shadow-md shadow-[#004F71]/20 dark:shadow-[#FFCC00]/20' 
      : 'bg-white dark:bg-[#1A1A1A] text-slate-500 border border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10'
    }`}>
      {icon && <span className={active ? "" : "text-slate-400"}>{icon}</span>}
      <span>{label}</span>
    </button>
  );
}

function TransactionItem({ type, title, desc, time, amount, icon }: { type: 'in'|'out', title: string, desc: string, time: string, amount: string, icon: React.ReactNode }) {
  const isOut = type === 'out';
  return (
    <div className="flex items-center justify-between p-5 bg-white dark:bg-[#1A1A1A] rounded-3xl shadow-sm border border-slate-100 dark:border-white/5 transition-colors duration-300">
      <div className="flex items-center space-x-4">
        <div className={`p-3 rounded-2xl ${isOut ? 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300' : 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400'}`}>
          {icon}
        </div>
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white">{title}</h4>
          <p className="text-xs font-medium text-slate-500 mt-0.5">{desc}</p>
        </div>
      </div>
      <div className="text-right">
        <span className={`font-black text-sm block mb-1 ${isOut ? 'text-slate-900 dark:text-white' : 'text-green-600 dark:text-green-400'}`}>
          {amount}
        </span>
        <span className="text-xs font-medium text-slate-400">{time}</span>
      </div>
    </div>
  );
}
