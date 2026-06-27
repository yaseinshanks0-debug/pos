import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Locale } from "../types";
import {
  Building2,
  Plus,
  RefreshCw,
  TrendingDown,
  Trash2,
  ShieldAlert,
  PlayCircle,
  FileText
} from "lucide-react";

interface FixedAssetsModuleProps {
  locale: Locale;
}

export const FixedAssetsModule: React.FC<FixedAssetsModuleProps> = ({ locale }) => {
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<any[]>([]);
  const [showAcquireModal, setShowAcquireModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Acquire asset form state
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [cost, setCost] = useState("");
  const [salvageValue, setSalvageValue] = useState("");
  const [usefulLifeMonths, setUsefulLifeMonths] = useState("60");

  const fetchFixedAssets = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listFixedAssets(1); // company ID 1
      setAssets(data);
    } catch (err: any) {
      console.error(err);
      setError(locale === "en" ? "Failed to load corporate Fixed Assets register" : "فشل تحميل سجل الأصول الثابتة");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFixedAssets();
  }, []);

  const handleAcquireAssetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code || !cost) return;

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await api.acquireAsset({
        companyId: 1,
        name,
        code,
        cost: Number(cost),
        salvageValue: Number(salvageValue || 0),
        usefulLifeMonths: Number(usefulLifeMonths)
      });
      setSuccess(locale === "en" ? "New Capital Fixed Asset capitalized!" : "تمت رسملة الأصل الرأسمالي الجديد بنجاح!");
      setShowAcquireModal(false);
      setName("");
      setCode("");
      setCost("");
      setSalvageValue("");
      setUsefulLifeMonths("60");
      fetchFixedAssets();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to capitalize fixed asset");
    } finally {
      setLoading(false);
    }
  };

  const handleRunDepreciation = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await api.runMonthlyDepreciation({
        companyId: 1,
        periodId: 1, // Seed period
        closedById: 1
      });
      setSuccess(locale === "en" ? "Depreciation schedule executed successfully with general ledger entries!" : "تم ترحيل قيد إهلاك الأصول وجدولته بنجاح!");
      fetchFixedAssets();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to post depreciation schedule");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Building2 className="text-emerald-500" size={16} />
            {locale === "en" ? "Corporate Fixed Assets register" : "سجل الأصول الرأسمالية الثابتة"}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunDepreciation}
            className="text-xs bg-red-950/40 hover:bg-red-900 text-red-300 font-bold border border-red-900/40 px-3.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1"
          >
            <PlayCircle size={14} />
            <span>{locale === "en" ? "Run Depreciation" : "ترحيل قسط الإهلاك"}</span>
          </button>

          <button
            onClick={() => setShowAcquireModal(true)}
            className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1"
          >
            <Plus size={14} />
            <span>{locale === "en" ? "Capitalize Asset" : "شراء/رسملة أصل"}</span>
          </button>

          <button
            onClick={fetchFixedAssets}
            className="text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 p-1.5 rounded-lg transition cursor-pointer"
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

      {success && (
        <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/60 text-emerald-200 text-xs rounded-xl">
          {success}
        </div>
      )}

      {loading && assets.length === 0 ? (
        <div className="flex justify-center items-center h-64 bg-slate-900 rounded-xl border border-slate-800">
          <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">{locale === "en" ? "Asset Code" : "رقم الأصل"}</th>
                <th className="px-6 py-3.5">{locale === "en" ? "Asset Name" : "اسم الأصل"}</th>
                <th className="px-6 py-3.5 text-right">{locale === "en" ? "Original Cost" : "التكلفة التاريخية"}</th>
                <th className="px-6 py-3.5 text-right">{locale === "en" ? "Salvage value" : "قيمة الخردة"}</th>
                <th className="px-6 py-3.5 text-center">{locale === "en" ? "Useful Life" : "العمر الإنتاجي"}</th>
                <th className="px-6 py-3.5 text-right">{locale === "en" ? "Depreciated Accum." : "مجمع الإهلاك"}</th>
                <th className="px-6 py-3.5 text-right">{locale === "en" ? "Book value" : "القيمة الدفترية"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {assets.map((asset) => {
                const costVal = Number(asset.cost || 0);
                const accumVal = Number(asset.accumulatedDepreciation || asset.totalAccumulatedDepreciation || 0);
                const bookValue = Math.max(Number(asset.salvageValue || 0), costVal - accumVal);
                return (
                  <tr key={asset.id} className="hover:bg-slate-850/50 transition">
                    <td className="px-6 py-4 font-mono font-bold text-emerald-400">{asset.code}</td>
                    <td className="px-6 py-4 font-semibold text-white">{asset.name}</td>
                    <td className="px-6 py-4 text-right font-mono">${costVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-6 py-4 text-right font-mono text-slate-400">${Number(asset.salvageValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-6 py-4 text-center font-mono">{asset.usefulLifeMonths} {locale === "en" ? "Months" : "شهر"}</td>
                    <td className="px-6 py-4 text-right font-mono text-red-400">
                      -${accumVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-emerald-400">
                      ${bookValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Capitalize Asset modal */}
      {showAcquireModal && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleAcquireAssetSubmit}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Plus className="text-emerald-500" size={16} />
              {locale === "en" ? "Capitalize Corporate Fixed Asset" : "شراء ورسملة أصل رأسمالي"}
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {locale === "en" ? "Asset Identification Code *" : "رقم معرف الأصل كود *"}
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="VEH-HQ-09"
                className="block w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-600 text-xs focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {locale === "en" ? "Asset Name *" : "اسم الأصل ووصفه *"}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="HQ Logistics Transport Van"
                className="block w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-600 text-xs focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {locale === "en" ? "Original Cost *" : "القيمة التاريخية الشراء *"}
                </label>
                <input
                  type="number"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="35000"
                  className="block w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-600 text-xs focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {locale === "en" ? "Salvage Value" : "القيمة المتبقية كخردة"}
                </label>
                <input
                  type="number"
                  value={salvageValue}
                  onChange={(e) => setSalvageValue(e.target.value)}
                  placeholder="5000"
                  className="block w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-600 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {locale === "en" ? "Useful Life (Months)" : "العمر الإنتاجي المقدر (بالشهور)"}
              </label>
              <input
                type="number"
                value={usefulLifeMonths}
                onChange={(e) => setUsefulLifeMonths(e.target.value)}
                placeholder="60"
                className="block w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div className="flex gap-2 justify-end border-t border-slate-800/80 pt-3.5">
              <button
                type="button"
                onClick={() => {
                  setShowAcquireModal(false);
                  setName("");
                  setCode("");
                  setCost("");
                  setSalvageValue("");
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
                {locale === "en" ? "Capitalize Fixed Asset" : "تأكيد ورسملة الأصل"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
