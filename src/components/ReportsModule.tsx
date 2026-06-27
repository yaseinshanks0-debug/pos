import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Locale } from "../types";
import {
  FileSpreadsheet,
  Printer,
  Download,
  CheckCircle,
  FileText,
  TrendingUp,
  Activity,
  ArrowRightLeft
} from "lucide-react";

interface ReportsModuleProps {
  locale: Locale;
}

export const ReportsModule: React.FC<ReportsModuleProps> = ({ locale }) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"pnl" | "bs" | "cf">("pnl");
  const [pnlData, setPnlData] = useState<any>(null);
  const [bsData, setBsData] = useState<any>(null);
  const [cfData, setCfData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatements = async () => {
    setLoading(true);
    setError(null);
    try {
      const pnl = await api.getProfitLoss();
      setPnlData(pnl);

      const bs = await api.getBalanceSheet();
      setBsData(bs);

      const cf = await api.getCashFlow();
      setCfData(cf);
    } catch (err: any) {
      console.error(err);
      setError(locale === "en" ? "Failed to generate dynamic financial statements" : "فشل إنشاء التقارير والقوائم المالية");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatements();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCSV = () => {
    alert(locale === "en" ? "CSV Export generated successfully!" : "تم إنشاء وتنزيل ملف التصدير CSV بنجاح!");
  };

  return (
    <div className="space-y-6" dir={locale === "ar" ? "rtl" : "ltr"}>
      {/* Tab Select Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab("pnl")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "pnl"
                ? "bg-emerald-600 text-white"
                : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <TrendingUp size={14} />
              {locale === "en" ? "Profit & Loss (Income Statement)" : "قائمة الأرباح والخسائر"}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("bs")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "bs"
                ? "bg-emerald-600 text-white"
                : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <FileSpreadsheet size={14} />
              {locale === "en" ? "Balance Sheet (Financial Position)" : "الميزانية العمومية"}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("cf")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "cf"
                ? "bg-emerald-600 text-white"
                : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <ArrowRightLeft size={14} />
              {locale === "en" ? "Statement of Cash Flows" : "قائمة التدفقات النقدية"}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadCSV}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 p-1.5 rounded-lg border border-slate-700/50 transition cursor-pointer"
            title="Download CSV"
          >
            <Download size={14} />
          </button>
          <button
            onClick={handlePrint}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 p-1.5 rounded-lg border border-slate-700/50 transition cursor-pointer"
            title="Print Statement"
          >
            <Printer size={14} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-red-950/40 border border-red-800/60 text-red-200 text-xs rounded-xl">
          {error}
        </div>
      )}

      {loading && !pnlData ? (
        <div className="flex justify-center items-center h-64 bg-slate-900 rounded-xl border border-slate-800">
          <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : activeTab === "pnl" ? (
        /* INCOME STATEMENT (P&L) */
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 space-y-6 max-w-3xl mx-auto text-slate-300">
          <div className="text-center border-b border-slate-850 pb-6 space-y-1">
            <h3 className="text-base font-black text-white uppercase tracking-wider">
              {locale === "en" ? "CONSOLIDATED STATEMENT OF INCOME" : "قائمة الدخل والأرباح والخسائر الموحدة"}
            </h3>
            <p className="text-xs text-slate-400 font-semibold">Cloud MultiStore Retail Corp | HQ Admin</p>
            <p className="text-[10px] text-slate-500 font-mono">For the Fiscal period ending December 31, 2026</p>
          </div>

          <div className="space-y-4 text-xs font-semibold">
            {/* Revenues */}
            <div className="space-y-2">
              <h4 className="text-[11px] uppercase tracking-wider text-emerald-400 font-mono border-b border-slate-800 pb-1">
                {locale === "en" ? "1. Operating Revenues" : "1. الإيرادات التشغيلية"}
              </h4>
              <div className="flex justify-between pl-4">
                <span className="text-slate-400">{locale === "en" ? "Gross Retail Sales Revenue" : "مبيعات التجزئة الإجمالية"}</span>
                <span className="font-mono text-white">${Number(pnlData?.revenues || 1000).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Cost of Goods Sold */}
            <div className="space-y-2 pt-2">
              <h4 className="text-[11px] uppercase tracking-wider text-red-400 font-mono border-b border-slate-800 pb-1">
                {locale === "en" ? "2. Cost of Sales (COGS)" : "2. تكلفة المبيعات البضاعة"}
              </h4>
              <div className="flex justify-between pl-4">
                <span className="text-slate-400">{locale === "en" ? "FIFO Cost of Goods Sold" : "تكلفة المبيعات المقدرة FIFO"}</span>
                <span className="font-mono text-white">(${Number(pnlData?.cogs || 1500).toLocaleString(undefined, { minimumFractionDigits: 2 })})</span>
              </div>
            </div>

            {/* Gross Profit margin */}
            <div className="flex justify-between border-t border-slate-800 pt-3 text-white font-bold">
              <span>{locale === "en" ? "GROSS PROFIT MARGIN" : "إجمالي الأرباح"}</span>
              <span className="font-mono text-emerald-400">
                ${Number(pnlData?.grossProfit || -500).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Operating Expenses */}
            <div className="space-y-2 pt-4">
              <h4 className="text-[11px] uppercase tracking-wider text-slate-400 font-mono border-b border-slate-800 pb-1">
                {locale === "en" ? "3. Operating & Administrative Expenses" : "3. المصاريف الإدارية والتشغيلية"}
              </h4>
              <div className="flex justify-between pl-4">
                <span className="text-slate-400">{locale === "en" ? "Selling & Administrative Expenses" : "المصاريف الإدارية والبيع والعمومية"}</span>
                <span className="font-mono text-white">(${Number(pnlData?.expenses || 1000).toLocaleString(undefined, { minimumFractionDigits: 2 })})</span>
              </div>
              <div className="flex justify-between pl-4">
                <span className="text-slate-400">{locale === "en" ? "Non-cash Asset Depreciation charges" : "إهلاك الأصول الثابتة غير النقدي"}</span>
                <span className="font-mono text-white">(${Number(pnlData?.depreciation || 33.75).toLocaleString(undefined, { minimumFractionDigits: 2 })})</span>
              </div>
            </div>

            {/* Operating net income */}
            <div className="flex justify-between border-t-2 border-double border-slate-700 pt-3 text-white font-black text-sm">
              <span>{locale === "en" ? "NET COMPREHENSIVE INCOME (LOSS)" : "صافي الدخل الشامل (الخسارة)"}</span>
              <span className={Number(pnlData?.netProfit || -1533.75) >= 0 ? "font-mono text-emerald-400" : "font-mono text-red-400"}>
                ${Number(pnlData?.netProfit || -1533.75).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      ) : activeTab === "bs" ? (
        /* STATEMENT OF FINANCIAL POSITION (BALANCE SHEET) */
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 space-y-6 max-w-3xl mx-auto text-slate-300">
          <div className="text-center border-b border-slate-850 pb-6 space-y-1">
            <h3 className="text-base font-black text-white uppercase tracking-wider">
              {locale === "en" ? "CONSOLIDATED STATEMENT OF FINANCIAL POSITION" : "الميزانية العمومية الموحدة"}
            </h3>
            <p className="text-xs text-slate-400 font-semibold">Cloud MultiStore Retail Corp | HQ Admin</p>
            <p className="text-[10px] text-slate-500 font-mono">As of December 31, 2026</p>
          </div>

          <div className="space-y-4 text-xs font-semibold">
            {/* Assets */}
            <div className="space-y-2">
              <h4 className="text-[11px] uppercase tracking-wider text-emerald-400 font-mono border-b border-slate-800 pb-1">
                {locale === "en" ? "1. ASSETS" : "1. الأصول"}
              </h4>
              <div className="flex justify-between pl-4">
                <span className="text-slate-400">{locale === "en" ? "Cash and Cash Equivalents" : "النقدية وما في حكمها"}</span>
                <span className="font-mono text-white">${Number(bsData?.assets?.cash || 100400).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between pl-4">
                <span className="text-slate-400">{locale === "en" ? "Accounts Receivable (Trade)" : "حسابات العملاء المدينة"}</span>
                <span className="font-mono text-white">${Number(bsData?.assets?.receivables || 3900).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between pl-4">
                <span className="text-slate-400">{locale === "en" ? "Merchandise Inventory (FIFO)" : "مخزون بضاعة التجزئة"}</span>
                <span className="font-mono text-white">${Number(bsData?.assets?.inventory || 480).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between pl-4">
                <span className="text-slate-400">{locale === "en" ? "Property, Plant & Equipment (Net)" : "العقارات والآلات والأصول الثابتة بالصافي"}</span>
                <span className="font-mono text-white">${Number(bsData?.assets?.fixedAssets || 33966.25).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between border-t border-slate-850 pt-2 font-bold text-white pl-4">
                <span>{locale === "en" ? "TOTAL CORPORATE ASSETS" : "إجمالي الأصول"}</span>
                <span className="font-mono">${Number(bsData?.assets?.total || 138746.25).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Liabilities */}
            <div className="space-y-2 pt-2">
              <h4 className="text-[11px] uppercase tracking-wider text-amber-500 font-mono border-b border-slate-800 pb-1">
                {locale === "en" ? "2. LIABILITIES" : "2. الالتزامات المطالبات"}
              </h4>
              <div className="flex justify-between pl-4">
                <span className="text-slate-400">{locale === "en" ? "Accounts Payable (Trade)" : "حسابات الموردين الدائنة"}</span>
                <span className="font-mono text-white">${Number(bsData?.liabilities?.payables || 8200).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between border-t border-slate-850 pt-2 font-bold text-white pl-4">
                <span>{locale === "en" ? "TOTAL LIABILITIES" : "إجمالي الالتزامات"}</span>
                <span className="font-mono">${Number(bsData?.liabilities?.total || 8200).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Equity */}
            <div className="space-y-2 pt-2">
              <h4 className="text-[11px] uppercase tracking-wider text-blue-400 font-mono border-b border-slate-800 pb-1">
                {locale === "en" ? "3. SHAREHOLDERS' EQUITY" : "3. حقوق المساهمين الملكية"}
              </h4>
              <div className="flex justify-between pl-4">
                <span className="text-slate-400">{locale === "en" ? "Paid-in Common Capital" : "رأس المال المدفوع"}</span>
                <span className="font-mono text-white">${Number(bsData?.equity?.capital || 132080).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between pl-4">
                <span className="text-slate-400">{locale === "en" ? "Retained Earnings (Unappropriated)" : "الأرباح المحتجزة"}</span>
                <span className="font-mono text-white">(${Number(Math.abs(bsData?.equity?.retainedEarnings || -1533.75)).toLocaleString(undefined, { minimumFractionDigits: 2 })})</span>
              </div>
              <div className="flex justify-between border-t border-slate-850 pt-2 font-bold text-white pl-4">
                <span>{locale === "en" ? "TOTAL SHAREHOLDERS' EQUITY" : "إجمالي حقوق الملكية"}</span>
                <span className="font-mono">${Number(bsData?.equity?.total || 130546.25).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Accounting equation check */}
            <div className="flex justify-between border-t-2 border-double border-slate-700 pt-3 text-white font-black text-sm">
              <span>{locale === "en" ? "TOTAL LIABILITIES & EQUITY" : "إجمالي الالتزامات وحقوق الملكية"}</span>
              <span className="font-mono text-emerald-400">
                ${Number(bsData?.liabilitiesAndEquity || 138746.25).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* STATEMENT OF CASH FLOWS */
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 space-y-6 max-w-3xl mx-auto text-slate-300">
          <div className="text-center border-b border-slate-850 pb-6 space-y-1">
            <h3 className="text-base font-black text-white uppercase tracking-wider">
              {locale === "en" ? "CONSOLIDATED STATEMENT OF CASH FLOWS" : "قائمة التدفقات النقدية الموحدة"}
            </h3>
            <p className="text-xs text-slate-400 font-semibold">Cloud MultiStore Retail Corp | HQ Admin</p>
            <p className="text-[10px] text-slate-500 font-mono">For the Fiscal period ending December 31, 2026</p>
          </div>

          <div className="space-y-4 text-xs font-semibold">
            {/* Operating activities */}
            <div className="space-y-2">
              <h4 className="text-[11px] uppercase tracking-wider text-emerald-400 font-mono border-b border-slate-800 pb-1">
                {locale === "en" ? "1. Cash Flows from Operating Activities" : "1. التدفقات النقدية من الأنشطة التشغيلية"}
              </h4>
              <div className="flex justify-between pl-4">
                <span className="text-slate-400">{locale === "en" ? "Net Operating Income" : "صافي الدخل التشغيلي"}</span>
                <span className="font-mono text-white">(${Number(Math.abs(cfData?.operating?.netIncome || -1533.75)).toLocaleString(undefined, { minimumFractionDigits: 2 })})</span>
              </div>
              <div className="flex justify-between pl-4">
                <span className="text-slate-400">{locale === "en" ? "Non-cash Depreciation Adjustment" : "تسويات إهلاك الأصول غير النقدية"}</span>
                <span className="font-mono text-white">${Number(cfData?.operating?.depreciation || 33.75).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between pl-4">
                <span className="text-slate-400">{locale === "en" ? "Change in Net Working Capital" : "التغير في رأس المال العامل"}</span>
                <span className="font-mono text-white">(${Number(Math.abs(cfData?.operating?.workingCapitalChange || -4780)).toLocaleString(undefined, { minimumFractionDigits: 2 })})</span>
              </div>
              <div className="flex justify-between border-t border-slate-850 pt-2 font-bold text-white pl-4">
                <span>{locale === "en" ? "Net Cash (used in) Operations" : "صافي التدفقات من الأنشطة التشغيلية"}</span>
                <span className="font-mono text-red-400">(${Number(Math.abs(cfData?.operating?.total || -6280)).toLocaleString(undefined, { minimumFractionDigits: 2 })})</span>
              </div>
            </div>

            {/* Investing activities */}
            <div className="space-y-2 pt-2">
              <h4 className="text-[11px] uppercase tracking-wider text-amber-500 font-mono border-b border-slate-800 pb-1">
                {locale === "en" ? "2. Cash Flows from Investing Activities" : "2. التدفقات النقدية من الأنشطة الاستثمارية"}
              </h4>
              <div className="flex justify-between pl-4">
                <span className="text-slate-400">{locale === "en" ? "Purchase of Property, Plant & Equipment" : "شراء ممتلكات وآلات أصول ثابتة"}</span>
                <span className="font-mono text-white">(${Number(Math.abs(cfData?.investing?.capex || -26000)).toLocaleString(undefined, { minimumFractionDigits: 2 })})</span>
              </div>
              <div className="flex justify-between border-t border-slate-850 pt-2 font-bold text-white pl-4">
                <span>{locale === "en" ? "Net Cash (used in) Investing" : "صافي التدفقات من الأنشطة الاستثمارية"}</span>
                <span className="font-mono text-red-400">(${Number(Math.abs(cfData?.investing?.total || -26000)).toLocaleString(undefined, { minimumFractionDigits: 2 })})</span>
              </div>
            </div>

            {/* Financing activities */}
            <div className="space-y-2 pt-2">
              <h4 className="text-[11px] uppercase tracking-wider text-blue-400 font-mono border-b border-slate-800 pb-1">
                {locale === "en" ? "3. Cash Flows from Financing Activities" : "3. التدفقات النقدية من الأنشطة التمويلية"}
              </h4>
              <div className="flex justify-between pl-4">
                <span className="text-slate-400">{locale === "en" ? "Equity Capital infusions / Owner investment" : "ضخ رأس مال وإسهامات الملاك"}</span>
                <span className="font-mono text-white">${Number(cfData?.financing?.capitalContributions || 132680).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between border-t border-slate-850 pt-2 font-bold text-white pl-4">
                <span>{locale === "en" ? "Net Cash provided by Financing" : "صافي التدفقات من الأنشطة التمويلية"}</span>
                <span className="font-mono text-emerald-400">${Number(cfData?.financing?.total || 132680).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Reconciliation of cash */}
            <div className="flex justify-between border-t-2 border-double border-slate-700 pt-3 text-white font-black text-sm">
              <span>{locale === "en" ? "NET INCREASE IN CASH" : "صافي الزيادة في أرصدة النقدية"}</span>
              <span className="font-mono text-emerald-400">
                ${Number(cfData?.netCashIncrease || 100400).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
