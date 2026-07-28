import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: number;
  email: string;
  fullName: string;
  roleId: number;
  roleName: string;
  companyId: number;
  storeId: number | null;
  permissions: string[];
}

interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      accessToken: null,
      user: null,
      setAuth: (accessToken, user) => set({ isAuthenticated: true, accessToken, user }),
      logout: () => set({ isAuthenticated: false, accessToken: null, user: null }),
      hasPermission: (permission) => {
        const user = get().user;
        if (!user) return false;
        if (user.roleName === 'super_admin') return true;
        return user.permissions.includes(permission);
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
