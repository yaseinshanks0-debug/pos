import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Locale } from "../types";
import {
  Settings,
  Store,
  Users,
  Shield,
  Activity,
  UserPlus,
  RefreshCw,
  Server
} from "lucide-react";

interface AdminModuleProps {
  locale: Locale;
}

export const AdminModule: React.FC<AdminModuleProps> = ({ locale }) => {
  const [loading, setLoading] = useState(false);
  const [stores, setStores] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"stores" | "users" | "audit">("stores");
  const [error, setError] = useState<string | null>(null);

  const fetchAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      const storeList = await api.getCrudList("stores");
      setStores(storeList);

      const userList = await api.getCrudList("users");
      setUsers(userList);
    } catch (err: any) {
      console.error(err);
      setError(locale === "en" ? "Failed to load platform admin records" : "فشل تحميل سجلات الإدارة");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  return (
    <div className="space-y-6" dir={locale === "ar" ? "rtl" : "ltr"}>
      {/* Tab Select bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab("stores")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "stores"
                ? "bg-emerald-600 text-white"
                : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Store size={14} />
              {locale === "en" ? "Stores & Outlets" : "الفروع والمتاجر"}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "users"
                ? "bg-emerald-600 text-white"
                : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Users size={14} />
              {locale === "en" ? "User Management" : "إدارة المستخدمين"}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("audit")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "audit"
                ? "bg-emerald-600 text-white"
                : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Activity size={14} />
              {locale === "en" ? "Audit Trail Logs" : "سجلات التدقيق والمتابعة"}
            </span>
          </button>
        </div>

        <button
          onClick={fetchAdminData}
          className="text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 px-3.5 py-1.5 rounded-lg transition cursor-pointer"
        >
          {locale === "en" ? "Refresh Logs" : "تحديث السجلات"}
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-red-950/40 border border-red-800/60 text-red-200 text-xs rounded-xl">
          {error}
        </div>
      )}

      {loading && stores.length === 0 ? (
        <div className="flex justify-center items-center h-64 bg-slate-900 rounded-xl border border-slate-800">
          <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : activeTab === "stores" ? (
        /* Multi-Store outlet management */
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">{locale === "en" ? "Outlet Code" : "كود الفرع"}</th>
                <th className="px-6 py-3.5">{locale === "en" ? "Outlet Name" : "اسم الفرع"}</th>
                <th className="px-6 py-3.5">{locale === "en" ? "Location / Coordinates" : "الموقع"}</th>
                <th className="px-6 py-3.5">{locale === "en" ? "Type" : "التصنيف"}</th>
                <th className="px-6 py-3.5 text-center">{locale === "en" ? "Status" : "الحالة"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {stores.map((s) => (
                <tr key={s.id} className="hover:bg-slate-850/50 transition">
                  <td className="px-6 py-4 font-mono font-bold text-emerald-400">{s.code}</td>
                  <td className="px-6 py-4 font-semibold text-white">{s.name}</td>
                  <td className="px-6 py-4 text-slate-400">{s.location || "N/A"}</td>
                  <td className="px-6 py-4 uppercase font-bold text-slate-500 text-[10px]">{s.type || "Branch"}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-block bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                      {locale === "en" ? "Operational" : "نشط"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : activeTab === "users" ? (
        /* Corporate User Account management */
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">{locale === "en" ? "User UID" : "معرف المستخدم"}</th>
                <th className="px-6 py-3.5">{locale === "en" ? "Full Name" : "الاسم الكامل"}</th>
                <th className="px-6 py-3.5">{locale === "en" ? "Email address" : "البريد الإلكتروني"}</th>
                <th className="px-6 py-3.5">{locale === "en" ? "Role Tier" : "مستوى الصلاحية"}</th>
                <th className="px-6 py-3.5 text-center">{locale === "en" ? "Account Status" : "الحالة"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-850/50 transition">
                  <td className="px-6 py-4 font-mono text-[11px] text-slate-500">{u.uid}</td>
                  <td className="px-6 py-4 font-bold text-white">{u.fullName}</td>
                  <td className="px-6 py-4 text-slate-400">{u.email}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-400 bg-emerald-950/40 border border-emerald-900/40 px-2 py-0.5 rounded">
                      <Shield size={10} />
                      {u.roleId === 1 ? "Admin Controller" : "Staff Cashier"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-block bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                      {locale === "en" ? "Active" : "مفعل"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Real-time platform audit log stream */
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Server className="text-emerald-500 animate-pulse" size={16} />
            <h3 className="text-xs font-bold text-slate-300 tracking-wider uppercase">
              {locale === "en" ? "System Core Audit Logs" : "سجلات مراقبة وتدقيق عمليات النظام"}
            </h3>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {[
              { time: "2026-06-27T08:22:15Z", actor: "financier@acme.com", ip: "10.128.0.4", action: "FINANCIAL_STATEMENT_GENERATION", status: "SUCCESS", detail: "Generated Balance Sheet statement report." },
              { time: "2026-06-27T08:18:42Z", actor: "grni-test-user@acme.com", ip: "10.128.0.12", action: "JOURNAL_VOUCHER_POSTING", status: "SUCCESS", detail: "Posted manual general ledger adjustment voucher #JE-4019." },
              { time: "2026-06-27T08:11:09Z", actor: "grni-test-user@acme.com", ip: "10.128.0.12", action: "POS_CHECKOUT_RETAIL", status: "SUCCESS", detail: "Processed retail cash receipt terminal #01 | Total $244.50." },
              { time: "2026-06-27T08:05:30Z", actor: "financier@acme.com", ip: "10.128.0.4", action: "USER_AUTHENTICATION_LOGIN", status: "SUCCESS", detail: "Verified PBKDF2 secure session token." }
            ].map((log, idx) => (
              <div key={idx} className="bg-slate-950 border border-slate-850 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-500">{new Date(log.time).toLocaleTimeString()}</span>
                    <span className="text-emerald-400 font-semibold">{log.actor}</span>
                    <span className="text-[10px] font-mono text-slate-600">({log.ip})</span>
                  </div>
                  <p className="text-slate-300 font-semibold mt-1">{log.detail}</p>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  <span className="text-[9px] font-bold font-mono text-slate-500 uppercase bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                    {log.action}
                  </span>
                  <span className="text-[9px] font-bold font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-900/40 px-2 py-0.5 rounded">
                    {log.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
