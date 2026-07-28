import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { apiClient } from '../../api/client';
import { useAppStore } from '../../store/useAppStore';
import { Building2, Lock, Loader2 } from 'lucide-react';
import { useState } from 'react';

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export const ResetPassword = () => {
  const [isLoading, setIsLoading] = useState(false);
  const addNotification = useAppStore((state) => state.addNotification);
  const navigate = useNavigate();

  // Extract token from URL search params (e.g. ?token=abc)
  const search: any = useSearch({ strict: false });
  const token = search.token;

  const { register, handleSubmit, formState: { errors } } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordForm) => {
    if (!token) {
      addNotification({ type: 'error', message: 'Missing reset token in URL.' });
      return;
    }

    setIsLoading(true);

    try {
      await apiClient.post('/auth/reset-password', {
        token,
        newPassword: data.newPassword
      });
      addNotification({
        type: 'success',
        message: 'Password reset successful. Please login.'
      });
      navigate({ to: '/login' });
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err.response?.data?.message || 'Failed to reset password. Token may be invalid or expired.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center">
        <h1 className="text-xl font-bold text-red-400 mb-2">Invalid Reset Link</h1>
        <p className="text-slate-400 text-sm mb-6">No reset token was found in the URL. Please request a new link.</p>
        <Link to="/forgot-password" className="text-emerald-400 hover:text-emerald-300 transition">Go to Forgot Password</Link>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-blue-500/10 blur-3xl rounded-full pointer-events-none" />

      <div className="relative relative z-10 text-center mb-8">
        <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
          <Building2 size={32} />
        </div>
        <h1 className="text-2xl font-black text-white tracking-wide">Set New Password</h1>
        <p className="text-slate-400 text-sm mt-2">Enter your new credentials below</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 relative z-10">
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">New Password</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <Lock size={16} />
            </div>
            <input
              type="password"
              {...register('newPassword')}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              placeholder="••••••••"
              disabled={isLoading}
            />
          </div>
          {errors.newPassword && <p className="text-red-400 text-xs ml-1 mt-1">{errors.newPassword.message}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Confirm Password</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <Lock size={16} />
            </div>
            <input
              type="password"
              {...register('confirmPassword')}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              placeholder="••••••••"
              disabled={isLoading}
            />
          </div>
          {errors.confirmPassword && <p className="text-red-400 text-xs ml-1 mt-1">{errors.confirmPassword.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl py-3 px-4 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mt-6 shadow-lg shadow-emerald-900/50"
        >
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : <span>Update Password</span>}
        </button>
      </form>
    </div>
  );
};
