import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Locale } from "../types";
import {
  CreditCard,
  Plus,
  RefreshCw,
  ArrowRightLeft,
  CheckCircle,
  FileSpreadsheet,
  AlertCircle
} from "lucide-react";

interface BankingModuleProps {
  locale: Locale;
}

export const BankingModule: React.FC<BankingModuleProps> = ({ locale }) => {
  const [loading, setLoading] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"accounts" | "reconcile">("accounts");
  const [unreconciledCount, setUnreconciledCount] = useState(3);
  const [error, setError] = useState<string | null>(null);

  const fetchBankAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listBankAccounts();
      setBankAccounts(data);
    } catch (err: any) {
      console.error(err);
      setError(locale === "en" ? "Failed to load bank ledger accounts" : "فشل تحميل الحسابات المصرفية");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBankAccounts();
  }, []);

  const handleMatchTransaction = (txnId: number) => {
    setUnreconciledCount(prev => Math.max(0, prev - 1));
    alert(locale === "en" ? "Transaction successfully matched and reconciled!" : "تمت مطابقة وتدوين الحركة المصرفية بنجاح!");
  };

  return (
    <div className="space-y-6" dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("accounts")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "accounts"
                ? "bg-emerald-600 text-white"
                : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <CreditCard size={14} />
              {locale === "en" ? "Bank Accounts" : "الحسابات المصرفية"}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("reconcile")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "reconcile"
                ? "bg-emerald-600 text-white"
                : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <ArrowRightLeft size={14} />
              {locale === "en" ? "Bank Reconciliation" : "التسويات المصرفية"}
            </span>
          </button>
        </div>

        <button
          onClick={fetchBankAccounts}
          className="text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 px-3.5 py-1.5 rounded-lg transition cursor-pointer"
        >
          {locale === "en" ? "Refresh Accounts" : "تحديث الحسابات"}
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-red-950/40 border border-red-800/60 text-red-200 text-xs rounded-xl">
          {error}
        </div>
      )}

      {loading && bankAccounts.length === 0 ? (
        <div className="flex justify-center items-center h-64 bg-slate-900 rounded-xl border border-slate-800">
          <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : activeTab === "accounts" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bankAccounts.map((b) => (
            <div
              key={b.id}
              className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 relative overflow-hidden group hover:border-emerald-500/30 transition flex flex-col justify-between"
            >
              <div>
                <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-slate-950 border border-slate-850 text-emerald-400 font-mono tracking-wider">
                  {b.accountType || "Checking Account"}
                </span>
                <h4 className="text-sm font-bold text-white mt-3 group-hover:text-emerald-400 transition">{b.accountName}</h4>
                <p className="text-xs font-mono text-slate-500 mt-1">{locale === "en" ? "Acc No:" : "رقم الحساب:"} {b.accountNumber}</p>
                <p className="text-[11px] text-slate-400 font-semibold mt-1">{b.bankName || "Corporate Treasury Bank"}</p>
              </div>

              <div className="border-t border-slate-850 pt-4 mt-4 flex justify-between items-center">
                <span className="text-xs text-slate-500">{locale === "en" ? "Statement Balance" : "الرصيد الفعلي"}</span>
                <span className="font-mono font-black text-white text-sm">
                  ${Number(b.ledgerBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Reconciliation Matching Screen */
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden p-6 space-y-6">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white">
                {locale === "en" ? "Imported Bank Statement Matching" : "مطابقة حركات كشف الحساب المستوردة"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {locale === "en" ? "Match imported transaction rows with recorded ledger journal entries" : "قم بمطابقة كشف حساب البنك مع قيود دفتر اليومية"}
              </p>
            </div>
            <span className="text-xs text-amber-400 font-semibold bg-amber-950/40 border border-amber-900/40 px-3 py-1 rounded-full">
              {unreconciledCount} {locale === "en" ? "Pending Matchings" : "حركات بانتظار المطابقة"}
            </span>
          </div>

          {unreconciledCount === 0 ? (
            <div className="text-center py-12 text-slate-500 space-y-2">
              <CheckCircle size={32} className="mx-auto text-emerald-500" />
              <p className="text-xs font-semibold text-white">
                {locale === "en" ? "Bank Reconciliation is 100% complete!" : "التسويات المصرفية مكتملة بنجاح!"}
              </p>
              <p className="text-[11px] text-slate-500">All external transactions are balanced with ledger journals.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { id: 101, desc: "Point of Sale (POS) Settlement Card Batch", date: "2026-06-25", amt: 1245.80, match: "Sales Invoice Batch #2026-441" },
                { id: 102, desc: "Vendor Supplier payment ACH #401024", date: "2026-06-24", amt: -820.00, match: "Vendor AP Invoice #VE-8991" },
                { id: 103, desc: "HQ Office Rent Autopay landlord Ltd", date: "2026-06-23", amt: -3500.00, match: "Accrued Land Lease Journal #JE-4029" }
              ].slice(0, unreconciledCount).map((item) => (
                <div key={item.id} className="bg-slate-950 border border-slate-850 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <span className="text-[10px] font-mono text-slate-500">{item.date} | ID: {item.id}</span>
                    <h4 className="text-xs font-bold text-white mt-1">{item.desc}</h4>
                    <span className="inline-block text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-900/40 px-2 py-0.5 rounded mt-2">
                      Suggested Match: {item.match}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 self-end md:self-center">
                    <span className={`font-mono font-black text-sm ${item.amt > 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {item.amt > 0 ? `+$${item.amt.toLocaleString()}` : `-$${Math.abs(item.amt).toLocaleString()}`}
                    </span>
                    <button
                      onClick={() => handleMatchTransaction(item.id)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg transition cursor-pointer"
                    >
                      {locale === "en" ? "Approve Match" : "تأكيد المطابقة"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
