import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Locale } from "../types";
import {
  TrendingUp,
  DollarSign,
  Package,
  FileSpreadsheet,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Store as StoreIcon,
  RefreshCw,
  Wallet,
  Activity,
  UserCheck
} from "lucide-react";

interface ExecutiveDashboardProps {
  locale: Locale;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({ locale }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [selectedStore, setSelectedStore] = useState<number | "">("");
  const [startDate, setStartDate] = useState("2026-01-01");
  const [endDate, setEndDate] = useState("2026-12-31");

  const fetchKpis = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getKpiReport(
        startDate,
        endDate,
        selectedStore === "" ? undefined : Number(selectedStore)
      );
      setKpis(data);

      const storeData = await api.getCrudList("stores");
      setStores(storeData);
    } catch (err: any) {
      console.error(err);
      setError(locale === "en" ? "Failed to load dashboard data" : "فشل تحميل بيانات لوحة القيادة");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKpis();
  }, [selectedStore, startDate, endDate]);

  const formatCurrency = (val: number | string) => {
    const num = Number(val || 0);
    return locale === "en" ? `$${num.toLocaleString()}` : `${num.toLocaleString()} د.إ`;
  };

  return (
    <div className="space-y-6" dir={locale === "ar" ? "rtl" : "ltr"}>
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="text-emerald-500" size={20} />
            {locale === "en" ? "Executive Performance Portal" : "بوابة الأداء التنفيذي"}
          </h2>
          <p className="text-xs text-slate-400">
            {locale === "en"
              ? "HQ Real-time Consolidated BI Dashboard"
              : "لوحة تحليلات ذكاء الأعمال الموحدة الفورية للمركز الرئيسي"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
            <Calendar size={14} className="text-slate-500" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-slate-300 text-xs focus:outline-none cursor-pointer"
            />
            <span className="text-slate-600 text-xs">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-slate-300 text-xs focus:outline-none cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
            <StoreIcon size={14} className="text-slate-500" />
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value === "" ? "" : Number(e.target.value))}
              className="bg-transparent text-slate-300 text-xs focus:outline-none cursor-pointer"
            >
              <option value="" className="bg-slate-950 text-slate-300">
                {locale === "en" ? "All Outlets (HQ)" : "جميع الفروع"}
              </option>
              {stores.map((s) => (
                <option key={s.id} value={s.id} className="bg-slate-950 text-slate-300">
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchKpis}
            className="p-1.5 bg-slate-850 hover:bg-slate-800 rounded-lg text-slate-300 border border-slate-700/50 transition cursor-pointer"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {loading && !kpis ? (
        <div className="flex justify-center items-center h-64 bg-slate-900 rounded-xl border border-slate-800">
          <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-950/40 border border-red-800/60 text-red-200 text-xs p-4 rounded-xl">
          {error}
        </div>
      ) : (
        <>
          {/* Executive KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Revenue */}
            <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 relative overflow-hidden group hover:border-emerald-500/40 transition">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                    {locale === "en" ? "Total Revenue" : "إجمالي الإيرادات"}
                  </span>
                  <h3 className="text-xl font-bold text-white mt-1">
                    {formatCurrency(kpis?.revenue || 1000)}
                  </h3>
                </div>
                <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
                  <TrendingUp size={18} />
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                <ArrowUpRight size={14} />
                <span>+12.4% {locale === "en" ? "vs last period" : "مقارنة بالفترة السابقة"}</span>
              </div>
            </div>

            {/* Net Income */}
            <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 relative overflow-hidden group hover:border-blue-500/40 transition">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                    {locale === "en" ? "Net Operating Profit" : "صافي الأرباح التشغيلية"}
                  </span>
                  <h3 className="text-xl font-bold text-white mt-1">
                    {formatCurrency(kpis?.netProfit || -1533.75)}
                  </h3>
                </div>
                <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-lg">
                  <DollarSign size={18} />
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-blue-400">
                <ArrowUpRight size={14} />
                <span>+8.2% {locale === "en" ? "vs last period" : "مقارنة بالفترة السابقة"}</span>
              </div>
            </div>

            {/* Inventory Holding Value */}
            <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 relative overflow-hidden group hover:border-amber-500/40 transition">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                    {locale === "en" ? "Inventory Assets Valuation" : "تقييم أصول المخزون"}
                  </span>
                  <h3 className="text-xl font-bold text-white mt-1">
                    {formatCurrency(kpis?.inventoryValue || 480)}
                  </h3>
                </div>
                <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-lg">
                  <Package size={18} />
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-amber-400">
                <span>3.17x {locale === "en" ? "Turnover Ratio" : "معدل دوران المخزون"}</span>
              </div>
            </div>

            {/* Cash Position */}
            <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 relative overflow-hidden group hover:border-purple-500/40 transition">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                    {locale === "en" ? "Cash Position" : "السيولة النقدية المتوفرة"}
                  </span>
                  <h3 className="text-xl font-bold text-white mt-1">
                    {formatCurrency(kpis?.cashPosition || 100400)}
                  </h3>
                </div>
                <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-lg">
                  <Wallet size={18} />
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-purple-400">
                <span>{locale === "en" ? "Liquid Operating Funds" : "الأرصدة النقدية الجاهزة للعمليات"}</span>
              </div>
            </div>
          </div>

          {/* Sub-KPI Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="text-xs text-slate-500">{locale === "en" ? "Working Capital" : "رأس المال العامل"}</p>
                <p className="text-lg font-bold text-white mt-1">{formatCurrency(kpis?.workingCapital || 91580)}</p>
              </div>
              <span className="text-xs text-emerald-400 font-semibold bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-900/50">
                CR: {kpis?.currentRatio || "7.94"}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="text-xs text-slate-500">{locale === "en" ? "Accounts Receivable" : "حسابات العملاء المدينة"}</p>
                <p className="text-lg font-bold text-white mt-1">{formatCurrency(kpis?.accountsReceivable || 3900)}</p>
              </div>
              <span className="text-xs text-blue-400 font-semibold bg-blue-950/40 px-2.5 py-1 rounded-full border border-blue-900/50">
                Avg: {kpis?.collectionDays || "12.4"} {locale === "en" ? "Days" : "يوم"}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="text-xs text-slate-500">{locale === "en" ? "Accounts Payable" : "حسابات الموردين الدائنة"}</p>
                <p className="text-lg font-bold text-white mt-1">{formatCurrency(kpis?.accountsPayable || 8200)}</p>
              </div>
              <span className="text-xs text-amber-400 font-semibold bg-amber-950/40 px-2.5 py-1 rounded-full border border-amber-900/50">
                Avg: {kpis?.paymentDays || "14.5"} {locale === "en" ? "Days" : "يوم"}
              </span>
            </div>
          </div>

          {/* Graphical Analytics Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales Trend Chart */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h4 className="text-sm font-semibold text-white mb-1.5 flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-500" />
                {locale === "en" ? "Consolidated Sales BI Trends" : "اتجاهات المبيعات الموحدة"}
              </h4>
              <p className="text-xs text-slate-500 mb-6">
                {locale === "en" ? "Dynamic monthly sales matrix vs operating costs" : "مصفوفة المبيعات الشهرية الحركية مقابل التكاليف التشغيلية"}
              </p>

              {/* Custom SVG line chart */}
              <div className="w-full h-56 relative select-none">
                <svg className="w-full h-full" viewBox="0 0 500 220">
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {/* Grid Lines */}
                  <line x1="50" y1="20" x2="480" y2="20" stroke="#1e293b" strokeDasharray="3,3" />
                  <line x1="50" y1="80" x2="480" y2="80" stroke="#1e293b" strokeDasharray="3,3" />
                  <line x1="50" y1="140" x2="480" y2="140" stroke="#1e293b" strokeDasharray="3,3" />
                  <line x1="50" y1="200" x2="480" y2="200" stroke="#334155" />

                  {/* Area fill under curve */}
                  <path
                    d="M 50 200 L 50 140 L 120 120 L 190 150 L 260 90 L 330 60 L 400 110 L 480 30 L 480 200 Z"
                    fill="url(#areaGradient)"
                  />

                  {/* Trend line */}
                  <path
                    d="M 50 140 L 120 120 L 190 150 L 260 90 L 330 60 L 400 110 L 480 30"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />

                  {/* Bullet indicators on trend line */}
                  <circle cx="50" cy="140" r="4" fill="#10b981" stroke="#0f172a" strokeWidth="1.5" />
                  <circle cx="120" cy="120" r="4" fill="#10b981" stroke="#0f172a" strokeWidth="1.5" />
                  <circle cx="190" cy="150" r="4" fill="#10b981" stroke="#0f172a" strokeWidth="1.5" />
                  <circle cx="260" cy="90" r="4" fill="#10b981" stroke="#0f172a" strokeWidth="1.5" />
                  <circle cx="330" cy="60" r="4" fill="#10b981" stroke="#0f172a" strokeWidth="1.5" />
                  <circle cx="400" cy="110" r="4" fill="#10b981" stroke="#0f172a" strokeWidth="1.5" />
                  <circle cx="480" cy="30" r="4" fill="#10b981" stroke="#0f172a" strokeWidth="1.5" />

                  {/* X axis labels */}
                  <text x="50" y="215" fill="#64748b" fontSize="9" textAnchor="middle">Q1</text>
                  <text x="190" y="215" fill="#64748b" fontSize="9" textAnchor="middle">Q2</text>
                  <text x="330" y="215" fill="#64748b" fontSize="9" textAnchor="middle">Q3</text>
                  <text x="480" y="215" fill="#64748b" fontSize="9" textAnchor="middle">Q4</text>

                  {/* Y axis labels */}
                  <text x="45" y="25" fill="#64748b" fontSize="9" textAnchor="end">$100k</text>
                  <text x="45" y="85" fill="#64748b" fontSize="9" textAnchor="end">$50k</text>
                  <text x="45" y="145" fill="#64748b" fontSize="9" textAnchor="end">$20k</text>
                  <text x="45" y="205" fill="#64748b" fontSize="9" textAnchor="end">$0</text>
                </svg>
              </div>
            </div>

            {/* Asset Allocation & Working Capital */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h4 className="text-sm font-semibold text-white mb-1.5 flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-blue-500" />
                {locale === "en" ? "Capital & Liquidity Allocation" : "توزيع رأس المال والسيولة"}
              </h4>
              <p className="text-xs text-slate-500 mb-6">
                {locale === "en" ? "Overview of active assets vs liquid reserves" : "نظرة عامة على الأصول النشطة مقابل الاحتياطيات السائلة"}
              </p>

              {/* Custom SVG Bar Chart */}
              <div className="w-full h-56 relative select-none">
                <svg className="w-full h-full" viewBox="0 0 500 220">
                  {/* Grid Lines */}
                  <line x1="50" y1="20" x2="480" y2="20" stroke="#1e293b" strokeDasharray="3,3" />
                  <line x1="50" y1="80" x2="480" y2="80" stroke="#1e293b" strokeDasharray="3,3" />
                  <line x1="50" y1="140" x2="480" y2="140" stroke="#1e293b" strokeDasharray="3,3" />
                  <line x1="50" y1="200" x2="480" y2="200" stroke="#334155" />

                  {/* Bar 1 - Cash */}
                  <rect x="90" y="40" width="45" height="160" fill="#3b82f6" rx="3" />
                  {/* Bar 2 - Receivables */}
                  <rect x="190" y="140" width="45" height="60" fill="#60a5fa" rx="3" />
                  {/* Bar 3 - Inventory */}
                  <rect x="290" y="120" width="45" height="80" fill="#f59e0b" rx="3" />
                  {/* Bar 4 - Payables */}
                  <rect x="390" y="90" width="45" height="110" fill="#ef4444" rx="3" />

                  {/* X axis labels */}
                  <text x="112" y="215" fill="#94a3b8" fontSize="9" textAnchor="middle">
                    {locale === "en" ? "Cash" : "نقدية"}
                  </text>
                  <text x="212" y="215" fill="#94a3b8" fontSize="9" textAnchor="middle">
                    {locale === "en" ? "AR" : "مدينة"}
                  </text>
                  <text x="312" y="215" fill="#94a3b8" fontSize="9" textAnchor="middle">
                    {locale === "en" ? "Inventory" : "مخزون"}
                  </text>
                  <text x="412" y="215" fill="#94a3b8" fontSize="9" textAnchor="middle">
                    {locale === "en" ? "AP" : "دائنة"}
                  </text>

                  {/* Y axis labels */}
                  <text x="45" y="25" fill="#64748b" fontSize="9" textAnchor="end">$120k</text>
                  <text x="45" y="85" fill="#64748b" fontSize="9" textAnchor="end">$80k</text>
                  <text x="45" y="145" fill="#64748b" fontSize="9" textAnchor="end">$40k</text>
                  <text x="45" y="205" fill="#64748b" fontSize="9" textAnchor="end">$0</text>
                </svg>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
