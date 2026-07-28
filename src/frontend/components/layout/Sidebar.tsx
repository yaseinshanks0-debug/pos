import { apiClient } from "../../api/client";
import { Link } from '@tanstack/react-router';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import {
  Building2,
  TrendingUp,
  CreditCard,
  Package,
  FileText,
  Users,
  BookOpen,
  Settings,
  LogOut,
  X
} from 'lucide-react';

export const Sidebar = () => {
  const { isSidebarOpen, setSidebarOpen, locale } = useAppStore();
  const { user, logout, hasPermission } = useAuthStore();

  const navItems = [
    { to: '/', label: 'Dashboard', icon: TrendingUp },
    { to: '/pos', label: 'Point of Sale', icon: CreditCard, accent: true, requiredPermission: 'process_sales' },
    { to: '/inventory', label: 'Inventory', icon: Package, requiredPermission: 'manage_inventory' },
    { to: '/purchasing', label: 'Purchasing', icon: FileText, requiredPermission: 'manage_purchasing' },
    { to: '/sales', label: 'Sales', icon: Users, requiredPermission: 'view_sales' },
    { to: '/accounting', label: 'Accounting', icon: BookOpen, requiredPermission: 'manage_accounting' },
    { to: '/admin', label: 'Admin', icon: Settings, requiredRole: 'super_admin' }
  ];

  // Filter items based on user permissions
  const filteredNavItems = navItems.filter(item => {
    if (user?.roleName === 'super_admin') return true;
    if (item.requiredRole && user?.roleName !== item.requiredRole) return false;
    if (item.requiredPermission && !hasPermission(item.requiredPermission)) return false;
    return true;
  });

  return (
    <aside
      className={`fixed inset-y-0 lg:static z-50 flex flex-col w-64 bg-slate-900 border-slate-800 transition-all duration-300 ${
        locale === 'ar' ? 'right-0 border-l lg:border-l-0' : 'left-0 border-r lg:border-r-0'
      } ${
        isSidebarOpen
          ? 'translate-x-0'
          : locale === 'ar'
          ? 'translate-x-full lg:translate-x-0'
          : '-translate-x-full lg:translate-x-0'
      }`}
    >
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-950">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
            <Building2 size={18} />
          </div>
          <div className="text-left" dir="ltr">
            <span className="block text-xs font-black tracking-widest text-emerald-400 font-mono">MULTISTORE</span>
            <span className="block text-[9px] text-slate-500 font-bold uppercase tracking-wider">Enterprise ERP v4.1</span>
          </div>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden text-slate-500 hover:text-slate-300"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1.5 scrollbar-thin">
        {filteredNavItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setSidebarOpen(false)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer text-slate-400 hover:text-slate-200 hover:bg-slate-850 data-[status=active]:bg-slate-800 data-[status=active]:text-white"
            activeProps={{
              className: item.accent ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/40 !text-white' : 'bg-slate-800 text-white !text-white',
            }}
          >
            <item.icon size={16} className="text-inherit" />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
          <div className="truncate">
            <span className="block text-xs font-bold text-white truncate">{user?.fullName || 'User'}</span>
            <span className="block text-[9px] text-slate-500 font-mono truncate">{user?.email || 'email@example.com'}</span>
          </div>
          <button
            onClick={async () => { await apiClient.post("/auth/logout"); logout(); }}
            className="p-1.5 bg-slate-800 hover:bg-red-950/30 text-slate-400 hover:text-red-400 rounded-lg border border-slate-700/50 transition cursor-pointer"
            title="Logout"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
};
