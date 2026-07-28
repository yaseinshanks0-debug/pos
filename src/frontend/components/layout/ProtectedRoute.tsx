import React from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { ShieldAlert } from 'lucide-react';
import { Link } from '@tanstack/react-router';

interface ProtectedRouteProps {
  component: React.ComponentType;
  requiredPermission?: string;
  requiredRole?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  component: Component,
  requiredPermission,
  requiredRole
}) => {
  const { user, hasPermission } = useAuthStore();

  let isAllowed = true;

  if (requiredRole && user?.roleName !== requiredRole && user?.roleName !== 'super_admin') {
    isAllowed = false;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    isAllowed = false;
  }

  if (!isAllowed) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mb-6">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Access Restricted</h2>
        <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
          You do not have the required permissions to view this module. Please contact your system administrator if you believe this is an error.
        </p>
        <Link to="/" className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return <Component />;
};
