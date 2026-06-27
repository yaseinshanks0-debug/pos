import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Locale } from "../types";
import {
  FileText,
  Plus,
  Users,
  CheckCircle,
  Clock,
  Briefcase,
  AlertCircle,
  Truck,
  ArrowRight
} from "lucide-react";

interface PurchasingModuleProps {
  locale: Locale;
}

export const PurchasingModule: React.FC<PurchasingModuleProps> = ({ locale }) => {
  const [loading, setLoading] = useState(false);
  const [vendors, setVendors] = useState<any[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"pos" | "vendors">("pos");
  const [showCreatePoModal, setShowCreatePoModal] = useState(false);
  const [products, setProducts] = useState<any[]>([]);

  // Create PO form state
  const [selectedVendorId, setSelectedVendorId] = useState<number | "">("");
  const [poItems, setPoItems] = useState<{ productId: number; qty: number; unitCost: number }[]>([
    { productId: 0, qty: 1, unitCost: 0 }
  ]);
  const [error, setError] = useState<string | null>(null);

  const fetchPurchasingData = async () => {
    setLoading(true);
    setError(null);
    try {
      const vendorList = await api.listVendors();
      setVendors(vendorList);

      const poList = await api.listPurchaseOrders();
      setPos(poList);

      const prodList = await api.getCrudList("products");
      setProducts(prodList);
    } catch (err: any) {
      console.error(err);
      setError(locale === "en" ? "Failed to load purchasing data" : "فشل تحميل بيانات المشتريات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchasingData();
  }, []);

  const handleCreatePoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendorId) return;

    setLoading(true);
    setError(null);

    const filteredItems = poItems.filter((item) => item.productId > 0 && item.qty > 0);
    if (filteredItems.length === 0) {
      setError(locale === "en" ? "Please add at least one valid item" : "يرجى إضافة بند واحد صحيح على الأقل");
      setLoading(false);
      return;
    }

    try {
      await api.createPurchaseOrder({
        vendorId: Number(selectedVendorId),
        storeId: 1,
        items: filteredItems
      });
      setShowCreatePoModal(false);
      setSelectedVendorId("");
      setPoItems([{ productId: 0, qty: 1, unitCost: 0 }]);
      fetchPurchasingData();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to create Purchase Order");
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePo = async (id: number) => {
    setLoading(true);
    try {
      await api.approvePurchaseOrder(id);
      // Wait a moment and record Goods Receipt as fully received
      await api.receivePurchaseOrder(id, {
        items: [] // Receive all
      });
      fetchPurchasingData();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to approve or receive PO");
    } finally {
      setLoading(false);
    }
  };

  const getVendorName = (vId: number) => {
    return vendors.find((v) => v.id === vId)?.name || `Vendor #${vId}`;
  };

  return (
    <div className="space-y-6" dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("pos")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "pos"
                ? "bg-emerald-600 text-white"
                : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <FileText size={14} />
              {locale === "en" ? "Purchase Orders" : "طلبات الشراء PO"}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("vendors")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "vendors"
                ? "bg-emerald-600 text-white"
                : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Users size={14} />
              {locale === "en" ? "Vendor Accounts" : "الموردون والدائنون"}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "pos" && (
            <button
              onClick={() => setShowCreatePoModal(true)}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1"
            >
              <Plus size={14} />
              <span>{locale === "en" ? "Create PO" : "إنشاء طلب PO"}</span>
            </button>
          )}
          <button
            onClick={fetchPurchasingData}
            className="text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition cursor-pointer"
          >
            {locale === "en" ? "Refresh" : "تحديث"}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-red-950/40 border border-red-800/60 text-red-200 text-xs rounded-xl">
          {error}
        </div>
      )}

      {loading && pos.length === 0 ? (
        <div className="flex justify-center items-center h-64 bg-slate-900 rounded-xl border border-slate-800">
          <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : activeTab === "pos" ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">{locale === "en" ? "PO Number" : "رقم الطلب"}</th>
                <th className="px-6 py-3.5">{locale === "en" ? "Vendor / Supplier" : "المورد"}</th>
                <th className="px-6 py-3.5">{locale === "en" ? "Status" : "الحالة"}</th>
                <th className="px-6 py-3.5 text-right">{locale === "en" ? "Total amount" : "المبلغ الإجمالي"}</th>
                <th className="px-6 py-3.5 text-right">{locale === "en" ? "Actions" : "إجراءات"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {pos.map((po) => {
                const isDraft = po.status?.toLowerCase() === "draft" || po.status?.toLowerCase() === "submitted";
                return (
                  <tr key={po.id} className="hover:bg-slate-850/50 transition">
                    <td className="px-6 py-4 font-mono font-medium text-emerald-400">PO-{po.poNumber || po.id}</td>
                    <td className="px-6 py-4 font-semibold text-white">{getVendorName(po.vendorId)}</td>
                    <td className="px-6 py-4">
                      {isDraft ? (
                        <span className="inline-flex items-center gap-1 bg-amber-950/40 text-amber-400 border border-amber-900/40 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                          <Clock size={10} />
                          {po.status || "Pending Approval"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                          <CheckCircle size={10} />
                          {po.status || "Received & Closed"}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-semibold text-white">
                      ${Number(po.totalAmount || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isDraft && (
                        <button
                          onClick={() => handleApprovePo(po.id)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded transition cursor-pointer flex items-center gap-1 ml-auto"
                        >
                          <Truck size={10} />
                          <span>{locale === "en" ? "Approve & Receive" : "الموافقة والاستلام"}</span>
                        </button>
                      )}
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
                <th className="px-6 py-3.5">{locale === "en" ? "Supplier Name" : "اسم المورد"}</th>
                <th className="px-6 py-3.5">{locale === "en" ? "Contact Email" : "البريد الإلكتروني"}</th>
                <th className="px-6 py-3.5">{locale === "en" ? "Phone" : "الهاتف"}</th>
                <th className="px-6 py-3.5 text-right">{locale === "en" ? "Outstanding AP Balance" : "الرصيد الدائن المتبقي"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {vendors.map((v) => (
                <tr key={v.id} className="hover:bg-slate-850/50 transition">
                  <td className="px-6 py-4 font-semibold text-white">{v.name}</td>
                  <td className="px-6 py-4 text-slate-400">{v.email || "N/A"}</td>
                  <td className="px-6 py-4 font-mono text-slate-400">{v.phone || "N/A"}</td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-red-400">
                    ${Number(v.balance || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create PO Modal */}
      {showCreatePoModal && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <form
            onSubmit={handleCreatePoSubmit}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Plus className="text-emerald-500" size={16} />
              {locale === "en" ? "Create New Purchase Order (HQ)" : "إنشاء طلب توريد جديد"}
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {locale === "en" ? "Select Vendor / Supplier" : "اختر المورد أو المصنع"}
              </label>
              <select
                value={selectedVendorId}
                onChange={(e) => setSelectedVendorId(e.target.value === "" ? "" : Number(e.target.value))}
                className="block w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 text-xs focus:outline-none focus:border-emerald-500"
                required
              >
                <option value="">{locale === "en" ? "-- Choose Vendor --" : "-- اختر موردًا --"}</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            {/* PO Line Items */}
            <div className="space-y-2 border border-slate-800 p-3 rounded-lg bg-slate-950">
              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                {locale === "en" ? "Purchase Line Items" : "بنود المشتريات والكميات"}
              </span>

              {poItems.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select
                    value={item.productId}
                    onChange={(e) => {
                      const next = [...poItems];
                      next[idx].productId = Number(e.target.value);
                      // Pre-fill cost price
                      const prod = products.find((p) => p.id === next[idx].productId);
                      next[idx].unitCost = prod ? Number(prod.costPrice || 0) : 0;
                      setPoItems(next);
                    }}
                    className="flex-1 bg-slate-900 border border-slate-850 rounded-lg px-2 py-1.5 text-slate-300 text-xs focus:outline-none"
                    required
                  >
                    <option value={0}>{locale === "en" ? "-- Product SKU --" : "-- اختر منتجًا --"}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    value={item.qty || ""}
                    onChange={(e) => {
                      const next = [...poItems];
                      next[idx].qty = Number(e.target.value);
                      setPoItems(next);
                    }}
                    placeholder="Qty"
                    className="w-16 bg-slate-900 border border-slate-850 rounded-lg px-2 py-1 text-slate-200 text-xs text-center focus:outline-none"
                    required
                  />

                  <input
                    type="number"
                    value={item.unitCost || ""}
                    onChange={(e) => {
                      const next = [...poItems];
                      next[idx].unitCost = Number(e.target.value);
                      setPoItems(next);
                    }}
                    placeholder="Cost"
                    className="w-20 bg-slate-900 border border-slate-850 rounded-lg px-2 py-1 text-slate-200 text-xs text-right focus:outline-none"
                    required
                  />

                  {poItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setPoItems(poItems.filter((_, i) => i !== idx))}
                      className="text-slate-500 hover:text-red-400 p-1 cursor-pointer"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={() => setPoItems([...poItems, { productId: 0, qty: 1, unitCost: 0 }])}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer mt-2"
              >
                <Plus size={10} />
                <span>{locale === "en" ? "Add Purchase Line Item" : "إضافة بند توريد آخر"}</span>
              </button>
            </div>

            <div className="flex gap-2 justify-end border-t border-slate-800/80 pt-3.5">
              <button
                type="button"
                onClick={() => {
                  setShowCreatePoModal(false);
                  setSelectedVendorId("");
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
                {locale === "en" ? "Issue Purchase Order" : "تأكيد وإصدار طلب PO"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
