import React, { useState } from "react";
import { api } from "../lib/api";
import { User, Locale } from "../types";
import { Lock, Mail, Eye, EyeOff, Globe, Sparkles, Building2 } from "lucide-react";

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
  locale: Locale;
  setLocale: (l: Locale) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  locale,
  setLocale,
}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError(locale === "en" ? "Please fill in all fields" : "يرجى ملء جميع الحقول");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const user = await api.login(email.trim(), password);
      onLoginSuccess(user);
    } catch (err: any) {
      console.error(err);
      setError(
        err.message ||
          (locale === "en"
            ? "Authentication failed. Check your credentials."
            : "فشل التحقق من الهوية. يرجى التحقق من بيانات الاعتماد.")
      );
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("admin123");
    setLoading(true);
    setError(null);
    try {
      const user = await api.login(demoEmail, "admin123");
      onLoginSuccess(user);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to log in with quick demo credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-slate-950 p-4 font-sans relative overflow-hidden select-none"
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      {/* Background Decorative Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-500/10 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px]" />

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden relative z-10">
        {/* Header language selector */}
        <div className="flex justify-between items-center px-6 pt-6 pb-2">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold font-mono text-xs tracking-wider">
            <Building2 size={16} />
            <span>CLOUD MULTISTORE POS</span>
          </div>
          <button
            onClick={() => setLocale(locale === "en" ? "ar" : "en")}
            className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition text-xs bg-slate-800/50 hover:bg-slate-800 px-3 py-1 rounded-full border border-slate-700/50"
          >
            <Globe size={14} />
            <span>{locale === "en" ? "العربية" : "English"}</span>
          </button>
        </div>

        <div className="px-8 pb-8 pt-4">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
              {locale === "en" ? "Sign In to ERP Portal" : "تسجيل الدخول إلى نظام ERP"}
            </h1>
            <p className="text-xs text-slate-400">
              {locale === "en"
                ? "Enter your enterprise credentials or use a demo account"
                : "أدخل بيانات الاعتماد المؤسسية الخاصة بك أو استخدم حساباً تجريبياً"}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-950/50 border border-red-800/80 rounded-lg text-red-200 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {locale === "en" ? "Work Email Address" : "البريد الإلكتروني للعمل"}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm transition"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {locale === "en" ? "Password" : "كلمة المرور"}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <Lock size={16} />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm transition"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 rounded-lg text-sm transition shadow-lg shadow-emerald-950/20 flex justify-center items-center gap-2 cursor-pointer mt-6"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <span>{locale === "en" ? "Sign In to Platform" : "تسجيل الدخول إلى المنصة"}</span>
              )}
            </button>
          </form>

          {/* Quick seeded login credentials */}
          <div className="mt-8 border-t border-slate-800/80 pt-6">
            <div className="flex items-center gap-2 justify-center text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider font-mono">
              <Sparkles size={12} className="text-yellow-400" />
              <span>{locale === "en" ? "Instant Demo Accounts" : "حسابات ديمو سريعة"}</span>
            </div>
            <div className="grid grid-cols-1 gap-2.5">
              <button
                type="button"
                onClick={() => quickLogin("financier@acme.com")}
                className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 py-2 px-3 rounded-lg flex items-center justify-between text-left transition cursor-pointer"
              >
                <div>
                  <div className="text-xs font-semibold text-slate-200">System Auditor (Financier)</div>
                  <div className="text-[10px] text-slate-500">financier@acme.com</div>
                </div>
                <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-800/40">
                  Password: admin123
                </span>
              </button>

              <button
                type="button"
                onClick={() => quickLogin("grni-test-user@acme.com")}
                className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 py-2 px-3 rounded-lg flex items-center justify-between text-left transition cursor-pointer"
              >
                <div>
                  <div className="text-xs font-semibold text-slate-200">Admin Controller (POS/HQ)</div>
                  <div className="text-[10px] text-slate-500">grni-test-user@acme.com</div>
                </div>
                <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-800/40">
                  Password: admin123
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
