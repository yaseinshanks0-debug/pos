import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from '@tanstack/react-router';
import { apiClient } from '../../api/client';
import { useAppStore } from '../../store/useAppStore';
import { Building2, Mail, Loader2, ArrowLeft } from 'lucide-react';
import { useState } from 'react';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export const ForgotPassword = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const addNotification = useAppStore((state) => state.addNotification);

  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordForm) => {
    setIsLoading(true);

    try {
      await apiClient.post('/auth/reset-password-request', data);
      setIsSubmitted(true);
      addNotification({
        type: 'success',
        message: 'Password reset instructions sent to your email.'
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err.response?.data?.message || 'Failed to request reset. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-blue-500/10 blur-3xl rounded-full pointer-events-none" />

      <div className="relative relative z-10 text-center mb-8">
        <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
          <Building2 size={32} />
        </div>
        <h1 className="text-2xl font-black text-white tracking-wide">Recover Access</h1>
        <p className="text-slate-400 text-sm mt-2">Enter your email to receive reset instructions</p>
      </div>

      {!isSubmitted ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 relative z-10">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Mail size={16} />
              </div>
              <input
                type="email"
                {...register('email')}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                placeholder="admin@example.com"
                disabled={isLoading}
              />
            </div>
            {errors.email && <p className="text-red-400 text-xs ml-1 mt-1">{errors.email.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl py-3 px-4 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mt-6 shadow-lg shadow-emerald-900/50"
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <span>Send Instructions</span>}
          </button>
        </form>
      ) : (
        <div className="text-center relative z-10 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <p className="text-emerald-400 text-sm font-medium">
            Check your email inbox for further instructions on resetting your password.
          </p>
        </div>
      )}

      <div className="mt-6 text-center relative z-10">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-emerald-400 transition-colors">
          <ArrowLeft size={14} />
          <span>Back to Login</span>
        </Link>
      </div>
    </div>
  );
};
