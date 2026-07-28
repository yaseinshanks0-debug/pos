import { useAppStore } from '../../store/useAppStore';
import { Menu, Building2, Clock, Globe } from 'lucide-react';
import { useState, useEffect } from 'react';

export const TopNavigation = () => {
  const { setSidebarOpen, locale, setLocale } = useAppStore();
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toUTCString().replace("GMT", "UTC"));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-900/40 backdrop-blur-md relative z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden p-1 bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition"
        >
          <Menu size={18} />
        </button>

        <div className="flex items-center gap-2 text-xs font-bold bg-slate-950 px-3.5 py-1.5 rounded-full border border-slate-800 text-slate-300">
          <Building2 size={14} className="text-emerald-500" />
          <span>{locale === 'en' ? 'HQ Branch #01' : 'الفرع الرئيسي #01'}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-1.5 text-[10px] text-slate-500 font-mono bg-slate-950/50 px-3 py-1.5 rounded-full border border-slate-850">
          <Clock size={12} />
          <span>{currentTime || 'Loading...'}</span>
        </div>

        <button
          onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')}
          className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition text-xs bg-slate-800/60 hover:bg-slate-800 px-3.5 py-1.5 rounded-full border border-slate-700/40 cursor-pointer"
        >
          <Globe size={14} />
          <span className="font-semibold">{locale === 'en' ? 'العربية' : 'English'}</span>
        </button>
      </div>
    </header>
  );
};
