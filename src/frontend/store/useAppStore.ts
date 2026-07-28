import { create } from 'zustand';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

interface AppState {
  theme: 'dark' | 'light' | 'system';
  isSidebarOpen: boolean;
  locale: 'en' | 'ar';
  notifications: Notification[];
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  setSidebarOpen: (isOpen: boolean) => void;
  setLocale: (locale: 'en' | 'ar') => void;
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  theme: 'dark',
  isSidebarOpen: false,
  locale: 'en',
  notifications: [],
  setTheme: (theme) => set({ theme }),
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
  setLocale: (locale) => set({ locale }),
  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        { ...notification, id: Math.random().toString(36).substring(2, 9) },
      ],
    })),
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
}));
