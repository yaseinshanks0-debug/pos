import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Locale } from "../types";
import {
  BookOpen,
  Plus,
  Scale,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  FolderTree,
  Calendar,
  Lock
} from "lucide-react";

interface AccountingModuleProps {
  locale: Locale;
}

export const AccountingModule: React.FC<AccountingModuleProps> = ({ locale }) => {
  const [loading, setLoading] = useState(false);
  const [coa, setCoa] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [trialBalance, setTrialBalance] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"coa" | "journal" | "trial" | "periods">("coa");

  // Journal entry form state
  const [memo, setMemo] = useState("");
  const [journalDate, setJournalDate] = useState(new Date().toISOString().split("T")[0]);
  const [jeLines, setJeLines] = useState<{ accountId: number; debit: number; credit: number }[]>([
    { accountId: 0, debit: 0, credit: 0 },
    { accountId: 0, debit: 0, credit: 0 }
  ]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchAccountingData = async () => {
    setLoading(true);
    setError(null);
    try {
      const coaList = await api.getChartOfAccounts();
      setCoa(coaList);

      const periodList = await api.getAccountingPeriods();
      setPeriods(periodList);

      const tb = await api.getTrialBalance();
      setTrialBalance(tb);
    } catch (err: any) {
      console.error(err);
      setError(locale === "en" ? "Failed to load accounting ledger data" : "فشل تحميل الدفاتر المحاسبية");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountingData();
  }, []);

  const handleAddJeLine = () => {
    setJeLines([...jeLines, { accountId: 0, debit: 0, credit: 0 }]);
  };

  const handleRemoveJeLine = (idx: number) => {
    setJeLines(jeLines.filter((_, i) => i !== idx));
  };

  const updateJeLine = (idx: number, field: string, val: any) => {
    const next = [...jeLines];
    next[idx] = { ...next[idx], [field]: val };
    setJeLines(next);
  };

  const calculateTotals = () => {
    const debits = jeLines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
    const credits = jeLines.reduce((sum, l) => sum + Number(l.credit || 0), 0);
    return { debits, credits, balanced: debits === credits && debits > 0 };
  };

  const handlePostJournalEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const { debits, credits, balanced } = calculateTotals();
    if (!balanced) {
      setError(
        locale === "en"
          ? `Journal Entry is out of balance. Debits ($${debits}) must equal Credits ($${credits}).`
          : `القيد غير متزن. يجب أن يتساوى المدين (${debits}) مع الدائن (${credits}).`
      );
      return;
    }

    const filtered = jeLines.filter((l) => l.accountId > 0 && (l.debit > 0 || l.credit > 0));
    if (filtered.length < 2) {
      setError(locale === "en" ? "Journal entry must contain at least 2 distinct account lines" : "يجب أن يحتوي القيد على بندين محاسبيين على الأقل");
      return;
    }

    setLoading(true);
    try {
      await api.postJournalEntry({
        memo,
        date: journalDate,
        lines: filtered.map((l) => ({
          accountId: l.accountId,
          debit: Number(l.debit),
          credit: Number(l.credit)
        }))
      });

      setSuccess(locale === "en" ? "Double-entry Journal Voucher successfully posted!" : "تم ترحيل قيد اليومية بنجاح!");
      setMemo("");
      setJeLines([
        { accountId: 0, debit: 0, credit: 0 },
        { accountId: 0, debit: 0, credit: 0 }
      ]);
      fetchAccountingData();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to post Journal Entry");
    } finally {
      setLoading(false);
    }
  };

  const handleClosePeriod = async (pId: number) => {
    setLoading(true);
    try {
      await api.closeAccountingPeriod(pId, { closedById: 1 });
      fetchAccountingData();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to lock fiscal period");
    } finally {
      setLoading(false);
    }
  };

  const { debits: totalDebits, credits: totalCredits, balanced: isBalanced } = calculateTotals();

  return (
    <div className="space-y-6" dir={locale === "ar" ? "rtl" : "ltr"}>
      {/* Tab Select Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab("coa")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "coa"
                ? "bg-emerald-600 text-white"
                : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <FolderTree size={14} />
              {locale === "en" ? "Chart of Accounts" : "شجرة الحسابات"}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("journal")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "journal"
                ? "bg-emerald-600 text-white"
                : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <BookOpen size={14} />
              {locale === "en" ? "Journal Voucher" : "قيد يومية يدوي"}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("trial")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "trial"
                ? "bg-emerald-600 text-white"
                : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Scale size={14} />
              {locale === "en" ? "Trial Balance" : "ميزان المراجعة"}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("periods")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "periods"
                ? "bg-emerald-600 text-white"
                : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Calendar size={14} />
              {locale === "en" ? "Period Closing" : "إغلاق الفترات"}
            </span>
          </button>
        </div>

        <button
          onClick={fetchAccountingData}
          className="text-xs bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3.5 py-1.5 rounded-lg transition cursor-pointer"
        >
          {locale === "en" ? "Refresh Ledger" : "تحديث القيود"}
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-red-950/40 border border-red-800/60 text-red-200 text-xs rounded-xl">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/60 text-emerald-200 text-xs rounded-xl">
          {success}
        </div>
      )}

      {loading && coa.length === 0 ? (
        <div className="flex justify-center items-center h-64 bg-slate-900 rounded-xl border border-slate-800">
          <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : activeTab === "coa" ? (
        /* Chart of Accounts Grid list */
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">{locale === "en" ? "Account Code" : "رقم الحساب"}</th>
                <th className="px-6 py-3.5">{locale === "en" ? "Account Name" : "اسم الحساب"}</th>
                <th className="px-6 py-3.5">{locale === "en" ? "Type" : "التصنيف الرئيسي"}</th>
                <th className="px-6 py-3.5 text-right">{locale === "en" ? "Current Balance" : "الرصيد الدفتري الحالي"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {coa.map((acc) => (
                <tr key={acc.id} className="hover:bg-slate-850/50 transition">
                  <td className="px-6 py-4 font-mono font-bold text-emerald-400">{acc.code}</td>
                  <td className="px-6 py-4 text-white font-semibold">{acc.name}</td>
                  <td className="px-6 py-4 uppercase font-bold text-slate-400 text-[10px] tracking-wider">{acc.type}</td>
                  <td className="px-6 py-4 text-right font-mono text-white">
                    ${Number(acc.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : activeTab === "journal" ? (
        /* Double Entry Voucher Post form */
        <form onSubmit={handlePostJournalEntry} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {locale === "en" ? "Journal Voucher Memo / Narrative" : "شرح القيد اليومي / البيان"}
              </label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Adjusting entry for operating lease accruals"
                className="block w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-600 text-xs focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {locale === "en" ? "Transaction Value Date" : "تاريخ قيد المعاملة"}
              </label>
              <input
                type="date"
                value={journalDate}
                onChange={(e) => setJournalDate(e.target.value)}
                className="block w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 text-xs focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
          </div>

          <div className="space-y-3.5 border border-slate-800 bg-slate-950 p-4 rounded-xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-850">
              <span className="text-[10px] uppercase font-mono text-slate-400 tracking-wider">
                {locale === "en" ? "Double-Entry Ledger Lines" : "بنود الحسابات الثنائية (مدين / دائن)"}
              </span>
              <button
                type="button"
                onClick={handleAddJeLine}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
              >
                <Plus size={12} />
                <span>{locale === "en" ? "Add Ledger Line" : "إضافة سطر قيد"}</span>
              </button>
            </div>

            {jeLines.map((line, idx) => (
              <div key={idx} className="flex gap-3 items-center">
                <select
                  value={line.accountId}
                  onChange={(e) => updateJeLine(idx, "accountId", Number(e.target.value))}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-300 text-xs focus:outline-none focus:border-emerald-500"
                  required
                >
                  <option value={0}>{locale === "en" ? "-- Choose Account --" : "-- اختر الحساب --"}</option>
                  {coa.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.code} - {acc.name} ({acc.type})
                    </option>
                  ))}
                </select>

                <div className="w-28 flex items-center bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1">
                  <span className="text-slate-500 text-xs mr-1">$</span>
                  <input
                    type="number"
                    value={line.debit || ""}
                    onChange={(e) => updateJeLine(idx, "debit", Number(e.target.value))}
                    placeholder="Debit"
                    className="w-full bg-transparent text-slate-200 text-xs focus:outline-none text-right"
                    disabled={line.credit > 0}
                  />
                </div>

                <div className="w-28 flex items-center bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1">
                  <span className="text-slate-500 text-xs mr-1">$</span>
                  <input
                    type="number"
                    value={line.credit || ""}
                    onChange={(e) => updateJeLine(idx, "credit", Number(e.target.value))}
                    placeholder="Credit"
                    className="w-full bg-transparent text-slate-200 text-xs focus:outline-none text-right"
                    disabled={line.debit > 0}
                  />
                </div>

                {jeLines.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveJeLine(idx)}
                    className="text-slate-500 hover:text-red-400 p-1 cursor-pointer"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}

            <div className="border-t border-slate-850 pt-3 flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-400">{locale === "en" ? "TOTAL BALANCE" : "مجموع اتزان القيد"}</span>
              <div className="flex gap-4 font-mono font-black">
                <span className={isBalanced ? "text-emerald-400" : "text-amber-400"}>
                  Dr: ${totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span className={isBalanced ? "text-emerald-400" : "text-amber-400"}>
                  Cr: ${totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center border-t border-slate-800 pt-4">
            <div className="text-xs">
              {isBalanced ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle size={14} />
                  {locale === "en" ? "Balanced Voucher ready for posting" : "القيد متزن وجاهز للترحيل الفوري"}
                </span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1">
                  <AlertTriangle size={14} />
                  {locale === "en" ? "Voucher out of balance" : "القيد غير متزن"}
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !isBalanced}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs rounded-xl transition cursor-pointer"
            >
              {locale === "en" ? "POST JOURNAL ENTRY" : "ترحيل قيد اليومية"}
            </button>
          </div>
        </form>
      ) : activeTab === "trial" ? (
        /* Trial Balance grid list */
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">{locale === "en" ? "Account Code" : "رقم الحساب"}</th>
                <th className="px-6 py-3.5">{locale === "en" ? "Account Name" : "اسم الحساب"}</th>
                <th className="px-6 py-3.5 text-right">{locale === "en" ? "Debit Balance" : "الرصيد المدين"}</th>
                <th className="px-6 py-3.5 text-right">{locale === "en" ? "Credit Balance" : "الرصيد الدائن"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {trialBalance?.accounts?.map((row: any) => (
                <tr key={row.id} className="hover:bg-slate-850/50 transition">
                  <td className="px-6 py-4 font-mono font-semibold text-emerald-400">{row.code}</td>
                  <td className="px-6 py-4 text-white font-semibold">{row.name}</td>
                  <td className="px-6 py-4 text-right font-mono text-emerald-400">
                    {row.debit > 0 ? `$${Number(row.debit).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "-"}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-blue-400">
                    {row.credit > 0 ? `$${Number(row.credit).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "-"}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-950 font-bold border-t border-slate-700">
                <td colSpan={2} className="px-6 py-4 text-white uppercase text-[10px] tracking-wider">
                  {locale === "en" ? "TOTAL CONSOLIDATED TRIAL BALANCE" : "إجمالي الاتزان الموحد لميزان المراجعة"}
                </td>
                <td className="px-6 py-4 text-right font-mono text-white text-sm">
                  ${Number(trialBalance?.totalDebits || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="px-6 py-4 text-right font-mono text-white text-sm">
                  ${Number(trialBalance?.totalCredits || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        /* Period closing list */
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">{locale === "en" ? "Period Name" : "اسم الفترة"}</th>
                <th className="px-6 py-3.5">{locale === "en" ? "Fiscal Year" : "السنة المالية"}</th>
                <th className="px-6 py-3.5">{locale === "en" ? "Start Date" : "تاريخ البدء"}</th>
                <th className="px-6 py-3.5">{locale === "en" ? "End Date" : "تاريخ الانتهاء"}</th>
                <th className="px-6 py-3.5">{locale === "en" ? "Ledger Lock Status" : "حالة الدفاتر"}</th>
                <th className="px-6 py-3.5 text-right">{locale === "en" ? "Closing Actions" : "إجراءات الإقفال"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {periods.map((p) => {
                const isClosed = !!p.isClosed;
                return (
                  <tr key={p.id} className="hover:bg-slate-850/50 transition">
                    <td className="px-6 py-4 text-white font-bold">{p.name}</td>
                    <td className="px-6 py-4 font-mono text-slate-400">{p.fiscalYearId}</td>
                    <td className="px-6 py-4 font-mono text-[11px] text-slate-500">
                      {new Date(p.startDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 font-mono text-[11px] text-slate-500">
                      {new Date(p.endDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      {isClosed ? (
                        <span className="inline-flex items-center gap-1 bg-slate-950 text-slate-400 border border-slate-850 text-[10px] font-semibold px-2.5 py-0.5 rounded-full">
                          <Lock size={10} />
                          {locale === "en" ? "Locked & Audited" : "مغلقة ومؤمنة"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 text-[10px] font-semibold px-2.5 py-0.5 rounded-full font-mono">
                          {locale === "en" ? "Open Ledger" : "مفتوحة للترحيل"}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {!isClosed && (
                        <button
                          onClick={() => handleClosePeriod(p.id)}
                          className="bg-red-950 hover:bg-red-900 border border-red-900/40 text-red-300 text-[10px] font-bold px-2.5 py-1 rounded transition cursor-pointer ml-auto"
                        >
                          {locale === "en" ? "Close & Lock Period" : "إقفال وتأمين الفترة"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
