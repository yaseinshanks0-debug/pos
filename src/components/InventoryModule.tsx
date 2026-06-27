import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Locale } from "../types";
import {
  Package,
  Plus,
  ArrowUpDown,
  History,
  AlertTriangle,
  RotateCcw,
  Sliders,
  DollarSign
} from "lucide-react";

interface InventoryModuleProps {
  locale: Locale;
}

export const InventoryModule: React.FC<InventoryModuleProps> = ({ locale }) => {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"products" | "movements">("products");
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<any>(null);
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchInventoryData = async () => {
    setLoading(true);
    setError(null);
    try {
      const prodData = await api.getCrudList("products");
      setProducts(prodData);

      const catData = await api.getCrudList("categories");
      setCategories(catData);

      const movData = await api.getInventoryMovements();
      setMovements(movData);
    } catch (err: any) {
      console.error(err);
      setError(locale === "en" ? "Failed to load inventory data" : "فشل تحميل بيانات المخزون");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventoryData();
  }, []);

  const handleAdjustStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustProduct || adjustQty === 0) return;

    setLoading(true);
    try {
      await api.adjustStock(
        adjustProduct.id,
        adjustProduct.storeId || 1,
        adjustQty,
        adjustReason || "Stock correction adjustments"
      );
      setShowAdjustModal(false);
      setAdjustProduct(null);
      setAdjustQty(0);
      setAdjustReason("");
      fetchInventoryData();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to adjust stock levels");
    } finally {
      setLoading(false);
    }
  };

  const getCategoryName = (catId: number) => {
    return categories.find((c) => c.id === catId)?.name || "Uncategorized";
  };

  return (
    <div className="space-y-6" dir={locale === "ar" ? "rtl" : "ltr"}>
      {/* Tab select bar */}
      <div className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("products")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "products"
                ? "bg-emerald-600 text-white"
                : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Package size={14} />
              {locale === "en" ? "Product Catalog" : "كتالوج المنتجات"}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("movements")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "movements"
                ? "bg-emerald-600 text-white"
                : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <History size={14} />
              {locale === "en" ? "Inventory Movements" : "حركات المخزون"}
            </span>
          </button>
        </div>

        <button
          onClick={fetchInventoryData}
          className="text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition cursor-pointer"
        >
          {locale === "en" ? "Refresh Data" : "تحديث البيانات"}
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-red-950/40 border border-red-800/60 text-red-200 text-xs rounded-xl">
          {error}
        </div>
      )}

      {loading && products.length === 0 ? (
        <div className="flex justify-center items-center h-64 bg-slate-900 rounded-xl border border-slate-800">
          <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : activeTab === "products" ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">{locale === "en" ? "Product SKU" : "رمز SKU"}</th>
                <th className="px-6 py-3.5">{locale === "en" ? "Name" : "الاسم"}</th>
                <th className="px-6 py-3.5">{locale === "en" ? "Category" : "الفئة"}</th>
                <th className="px-6 py-3.5 text-right">{locale === "en" ? "Cost" : "التكلفة"}</th>
                <th className="px-6 py-3.5 text-right">{locale === "en" ? "Price" : "السعر"}</th>
                <th className="px-6 py-3.5 text-right">{locale === "en" ? "Available Qty" : "الكمية المتوفرة"}</th>
                <th className="px-6 py-3.5 text-center">{locale === "en" ? "FIFO status" : "مستوى التوفر"}</th>
                <th className="px-6 py-3.5 text-right">{locale === "en" ? "Actions" : "إجراءات"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {products.map((p) => {
                const qty = Number(p.qtyOnHand || 0);
                const isLow = qty <= 5;
                return (
                  <tr key={p.id} className="hover:bg-slate-850/50 transition">
                    <td className="px-6 py-4 font-mono font-medium text-emerald-400">{p.sku}</td>
                    <td className="px-6 py-4 font-semibold text-white">{p.name}</td>
                    <td className="px-6 py-4 text-slate-400">{getCategoryName(p.categoryId)}</td>
                    <td className="px-6 py-4 text-right font-mono">${Number(p.costPrice || 0).toFixed(2)}</td>
                    <td className="px-6 py-4 text-right font-mono font-semibold text-emerald-400">${Number(p.salePrice ?? p.retailPrice ?? 0).toFixed(2)}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-mono font-bold ${isLow ? "text-amber-400" : "text-white"}`}>
                        {qty}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {isLow ? (
                        <span className="inline-flex items-center gap-1 bg-amber-950/40 text-amber-400 border border-amber-900/40 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                          <AlertTriangle size={10} />
                          {locale === "en" ? "Low Stock" : "مخزون منخفض"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                          {locale === "en" ? "Optimal" : "متوفر"}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => {
                          setAdjustProduct(p);
                          setShowAdjustModal(true);
                        }}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold px-2.5 py-1 rounded transition cursor-pointer"
                      >
                        {locale === "en" ? "Adjust Qty" : "تعديل الكمية"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">{locale === "en" ? "Movement Ref" : "مرجع الحركة"}</th>
                <th className="px-6 py-3.5">{locale === "en" ? "Product" : "المنتج"}</th>
                <th className="px-6 py-3.5">{locale === "en" ? "SKU" : "الرمز"}</th>
                <th className="px-6 py-3.5">{locale === "en" ? "Type" : "نوع الحركة"}</th>
                <th className="px-6 py-3.5 text-right">{locale === "en" ? "Quantity" : "الكمية"}</th>
                <th className="px-6 py-3.5">{locale === "en" ? "Reference" : "مرجع التدقيق"}</th>
                <th className="px-6 py-3.5">{locale === "en" ? "Date" : "التاريخ"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {movements.map((m) => (
                <tr key={m.id} className="hover:bg-slate-850/50 transition">
                  <td className="px-6 py-4 font-mono text-slate-400">#MOV-{m.id}</td>
                  <td className="px-6 py-4 font-semibold text-white">{m.productName || "Unknown Item"}</td>
                  <td className="px-6 py-4 font-mono text-slate-400">{m.sku || "N/A"}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        m.movementType?.toLowerCase() === "in" || m.movementType?.toLowerCase() === "purchase"
                          ? "bg-emerald-950/50 text-emerald-400 border border-emerald-900/40"
                          : "bg-red-950/50 text-red-400 border border-red-900/40"
                      }`}
                    >
                      {m.movementType || "Adjustment"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-white">
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </td>
                  <td className="px-6 py-4 font-mono text-[11px] text-slate-500">{m.reference || "N/A"}</td>
                  <td className="px-6 py-4 text-slate-500 font-mono text-[11px]">
                    {m.date ? new Date(m.date).toLocaleDateString() : "N/A"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Adjust Quantity Modal */}
      {showAdjustModal && adjustProduct && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleAdjustStockSubmit}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Sliders className="text-emerald-500" size={16} />
              {locale === "en" ? "Inventory Quantity Adjustment" : "تعديل كميات المخزون"}
            </h3>

            <div className="text-xs space-y-1 bg-slate-950 p-3 rounded-lg border border-slate-850">
              <p className="font-semibold text-white">{adjustProduct.name}</p>
              <p className="text-slate-500">SKU: {adjustProduct.sku}</p>
              <p className="text-slate-400">
                {locale === "en" ? "Current Balance:" : "الرصيد الحالي:"}{" "}
                <span className="font-bold text-white font-mono">{adjustProduct.qtyOnHand}</span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {locale === "en" ? "Adjustment Quantity (Delta)" : "كمية التعديل (دلتا)"}
              </label>
              <input
                type="number"
                value={adjustQty}
                onChange={(e) => setAdjustQty(Number(e.target.value))}
                placeholder="e.g. -5 or +10"
                className="block w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-600 text-xs focus:outline-none focus:border-emerald-500"
                required
              />
              <p className="text-[10px] text-slate-500 mt-1">
                {locale === "en"
                  ? "Enter a negative value to write-off/reduce, or a positive value to add."
                  : "أدخل قيمة سالبة للتخفيض/الشطب، أو موجبة للإضافة."}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {locale === "en" ? "Reason / Reference" : "السبب أو المرجع"}
              </label>
              <textarea
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Stocktake variance audit correction"
                className="block w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-600 text-xs focus:outline-none focus:border-emerald-500 h-20 resize-none"
                required
              />
            </div>

            <div className="flex gap-2 justify-end border-t border-slate-800/80 pt-3.5">
              <button
                type="button"
                onClick={() => {
                  setShowAdjustModal(false);
                  setAdjustProduct(null);
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
                {locale === "en" ? "Confirm Adjustment" : "تأكيد التعديل"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
