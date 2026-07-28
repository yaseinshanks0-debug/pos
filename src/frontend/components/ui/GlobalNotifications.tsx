import { useAppStore } from '../../store/useAppStore';
import { X, CheckCircle, AlertTriangle, Info, AlertOctagon } from 'lucide-react';
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export const GlobalNotifications = () => {
  const { notifications, removeNotification } = useAppStore();

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      <AnimatePresence>
        {notifications.map((notification) => (
          <NotificationToast
            key={notification.id as any}
            notification={notification}
            onClose={() => removeNotification(notification.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

const NotificationToast = ({
  notification,
  onClose,
}: {
  notification: any;
  onClose: () => void;
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const config = {
    success: { icon: CheckCircle, className: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' },
    error: { icon: AlertOctagon, className: 'bg-red-500/10 border-red-500/20 text-red-400' },
    warning: { icon: AlertTriangle, className: 'bg-amber-500/10 border-amber-500/20 text-amber-400' },
    info: { icon: Info, className: 'bg-blue-500/10 border-blue-500/20 text-blue-400' },
  };

  const { icon: Icon, className } = config[notification.type as keyof typeof config] || config.info;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md shadow-xl ${className}`}
    >
      <Icon className="shrink-0 mt-0.5" size={18} />
      <p className="text-sm font-medium flex-1 text-slate-200">{notification.message}</p>
      <button onClick={onClose} className="shrink-0 opacity-50 hover:opacity-100 transition">
        <X size={16} />
      </button>
    </motion.div>
  );
};
