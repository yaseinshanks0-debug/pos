import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Locale } from "../types";
import {
  FileText,
  Plus,
  Users,
  Award,
  DollarSign,
  UserCheck,
  RefreshCw,
  Mail,
  Phone
} from "lucide-react";

interface SalesModuleProps {
  locale: Locale;
}

export const SalesModule: React.FC<SalesModuleProps> = ({ locale }) => {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"customers" | "invoices">("customers");
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  // New customer form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listCustomers();
      setCustomers(data);
    } catch (err: any) {
      console.error(err);
      setError(locale === "en" ? "Failed to load customers" : "فشل تحميل بيانات العملاء");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !mobileNumber) {
      setError(locale === "en" ? "Please fill in all required fields" : "يرجى ملء الحقول المطلوبة");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.registerCustomer({
        name,
        email: email || undefined,
        mobileNumber
      });
      setShowRegisterModal(false);
      setName("");
      setEmail("");
      setMobileNumber("");
      fetchCustomers();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to register customer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("customers")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "customers"
                ? "bg-emerald-600 text-white"
                : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Users size={14} />
              {locale === "en" ? "Customer Accounts" : "حسابات العملاء"}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRegisterModal(true)}
            className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1"
          >
            <Plus size={14} />
            <span>{locale === "en" ? "Register Customer" : "تسجيل عميل جديد"}</span>
          </button>
          <button
            onClick={fetchCustomers}
            className="text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-red-950/40 border border-red-800/60 text-red-200 text-xs rounded-xl">
          {error}
        </div>
      )}

      {loading && customers.length === 0 ? (
        <div className="flex justify-center items-center h-64 bg-slate-900 rounded-xl border border-slate-800">
          <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((c) => {
            const loyaltyPoints = Number(c.loyaltyPoints || 0);
            return (
              <div
                key={c.id}
                className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 relative overflow-hidden group hover:border-emerald-500/30 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <h4 className="text-sm font-bold text-white group-hover:text-emerald-400 transition">{c.name}</h4>
                    <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-950 border border-slate-850 text-slate-500 font-mono">
                      #{c.id}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-slate-400 mb-4">
                    <p className="flex items-center gap-1">
                      <Phone size={12} className="text-slate-500" />
                      <span>{c.mobileNumber}</span>
                    </p>
                    {c.email && (
                      <p className="flex items-center gap-1">
                        <Mail size={12} className="text-slate-500" />
                        <span className="truncate">{c.email}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-slate-800/80 pt-4 mt-2">
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850/50">
                    <p className="text-[10px] text-slate-500 flex items-center gap-0.5 uppercase tracking-wider font-mono">
                      <DollarSign size={10} />
                      <span>{locale === "en" ? "AR Balance" : "الرصيد المدين"}</span>
                    </p>
                    <p className="text-xs font-black text-red-400 mt-1">${Number(c.balance || 0).toFixed(2)}</p>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850/50">
                    <p className="text-[10px] text-slate-500 flex items-center gap-0.5 uppercase tracking-wider font-mono">
                      <Award size={10} />
                      <span>{locale === "en" ? "Loyalty" : "النقاط"}</span>
                    </p>
                    <p className="text-xs font-black text-yellow-400 mt-1">{loyaltyPoints} {locale === "en" ? "Pts" : "نقطة"}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Register Customer Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleRegisterSubmit}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <UserCheck className="text-emerald-500" size={16} />
              {locale === "en" ? "Register New Customer Account" : "تسجيل عميل جديد بالملف"}
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {locale === "en" ? "Full Name *" : "الاسم الكامل *"}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="block w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-600 text-xs focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {locale === "en" ? "Mobile Phone Number *" : "رقم الهاتف المحمول *"}
              </label>
              <input
                type="text"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                placeholder="+971501234567"
                className="block w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-600 text-xs focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {locale === "en" ? "Email Address (Optional)" : "البريد الإلكتروني (اختياري)"}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@email.com"
                className="block w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-600 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex gap-2 justify-end border-t border-slate-800/80 pt-3.5">
              <button
                type="button"
                onClick={() => {
                  setShowRegisterModal(false);
                  setName("");
                  setMobileNumber("");
                  setEmail("");
                }}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                {locale === "en" ? "Cancel" : "إلغاء"}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition cursor-pointer"
              >
                {locale === "en" ? "Register Customer" : "تسجيل وتأكيد"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
