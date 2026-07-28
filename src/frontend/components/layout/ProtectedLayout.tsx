import { Outlet, useNavigate } from '@tanstack/react-router';
import { Sidebar } from './Sidebar';
import { TopNavigation } from './TopNavigation';
import { MobileNavigation } from './MobileNavigation';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import { useEffect } from 'react';

export const ProtectedLayout = () => {
  const { isAuthenticated } = useAuthStore();
  const { isSidebarOpen, setSidebarOpen } = useAppStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate({ to: '/login', replace: true });
    }
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans overflow-hidden">
      {isSidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-slate-950/80 z-40 lg:hidden transition"
        />
      )}

      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden w-full relative">
        <TopNavigation />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-900/50">
          <Outlet />
        </main>
      </div>

      <MobileNavigation />
    </div>
  );
};
