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
  const [departments, setDepartments] = useState<any[]>([]);
  const [vendorsList, setVendorsList] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"products" | "movements">("products");
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<any>(null);
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Modals for creating / editing products
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [modalTab, setModalTab] = useState<"general" | "advanced" | "subrelations" | "uom_custom">("general");

  const defaultFormValues = {
    name: "",
    sku: "",
    barcode: "",
    description: "",
    categoryId: "",
    departmentId: "",
    brand: "",
    costPrice: 0,
    retailPrice: 0,
    reorderPoint: 5,
    msrp: "",
    manufacturer: "",
    weight: "",
    taxCode: "",
    trackingType: "none",
    hasExpiration: false,
    commissionEligible: false,
    commissionRate: "0.00",
    rewardsEligible: false,
    rewardsPoints: 0,
    printTagTemplate: "",
    printTagDefaultQty: 1,
    customField1: "",
    customField2: "",
    customField3: "",
    customField4: "",
    customField5: "",
    additionalBarcodes: [] as { barcode: string; notes?: string }[],
    vendors: [] as { vendorId: number; vendorPartNumber?: string; vendorCost: number; isPrimary: boolean }[],
    pricingTiers: [] as { tierName: string; price: number }[],
    uoms: [] as { unitName: string; conversionFactor: number; barcode?: string; retailPrice?: number; costPrice?: number; isBaseUnit: boolean }[],
    attributes: [] as { name: string; value: string }[]
  };

  const [formValues, setFormValues] = useState(defaultFormValues);

  const fetchInventoryData = async () => {
    setLoading(true);
    setError(null);
    try {
      const prodData = await api.getCrudList("products");
      setProducts(prodData);

      const catData = await api.getCrudList("categories");
      setCategories(catData || []);

      const deptData = await api.getCrudList("departments");
      setDepartments(deptData || []);

      const vendData = await api.getCrudList("vendors");
      setVendorsList(vendData || []);

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

  const handleProductFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formValues,
        companyId: 1,
        categoryId: formValues.categoryId ? Number(formValues.categoryId) : undefined,
        departmentId: formValues.departmentId ? Number(formValues.departmentId) : undefined,
        costPrice: Number(formValues.costPrice),
        retailPrice: Number(formValues.retailPrice),
        reorderPoint: Number(formValues.reorderPoint),
        msrp: formValues.msrp ? String(formValues.msrp) : undefined,
        weight: formValues.weight ? String(formValues.weight) : undefined,
        commissionRate: formValues.commissionRate ? String(formValues.commissionRate) : undefined,
        rewardsPoints: Number(formValues.rewardsPoints),
        printTagDefaultQty: Number(formValues.printTagDefaultQty),
        vendors: formValues.vendors.map(v => ({ ...v, vendorId: Number(v.vendorId), vendorCost: Number(v.vendorCost) })),
        pricingTiers: formValues.pricingTiers.map(p => ({ ...p, price: Number(p.price) })),
        uoms: formValues.uoms.map(u => ({ ...u, conversionFactor: Number(u.conversionFactor), retailPrice: u.retailPrice ? Number(u.retailPrice) : undefined, costPrice: u.costPrice ? Number(u.costPrice) : undefined })),
        attributes: formValues.attributes.map(a => ({ ...a, value: String(a.value) }))
      };

      if (showEditModal && selectedProduct) {
        await api.updateCrudItem("products", selectedProduct.id, payload);
        setShowEditModal(false);
      } else {
        await api.createCrudItem("products", payload);
        setShowAddModal(false);
      }
      setFormValues(defaultFormValues);
      fetchInventoryData();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to save product");
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

        <div className="flex gap-2">
          <button
            onClick={() => {
              setFormValues(defaultFormValues);
              setModalTab("general");
              setShowAddModal(true);
            }}
            className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1"
          >
            <Plus size={14} />
            {locale === "en" ? "Add Product" : "إضافة منتج"}
          </button>
          <button
            onClick={fetchInventoryData}
            className="text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition cursor-pointer"
          >
            {locale === "en" ? "Refresh Data" : "تحديث البيانات"}
          </button>
        </div>
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
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs text-slate-300 min-w-[700px]">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="px-4 sm:px-6 py-3.5">{locale === "en" ? "Product SKU" : "رمز SKU"}</th>
                  <th className="px-4 sm:px-6 py-3.5">{locale === "en" ? "Name" : "الاسم"}</th>
                  <th className="px-4 sm:px-6 py-3.5">{locale === "en" ? "Category" : "الفئة"}</th>
                  <th className="px-4 sm:px-6 py-3.5 text-right">{locale === "en" ? "Cost" : "التكلفة"}</th>
                  <th className="px-4 sm:px-6 py-3.5 text-right">{locale === "en" ? "Price" : "السعر"}</th>
                  <th className="px-4 sm:px-6 py-3.5 text-right">{locale === "en" ? "Available Qty" : "الكمية المتوفرة"}</th>
                  <th className="px-4 sm:px-6 py-3.5 text-center">{locale === "en" ? "FIFO status" : "مستوى التوفر"}</th>
                  <th className="px-4 sm:px-6 py-3.5 text-right">{locale === "en" ? "Actions" : "إجراءات"}</th>
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
                    <td className="px-6 py-4 text-right flex gap-2 justify-end">
                      <button
                        onClick={() => {
                          setSelectedProduct(p);
                          setFormValues({
                            name: p.name || "",
                            sku: p.sku || "",
                            barcode: p.barcode || "",
                            description: p.description || "",
                            categoryId: p.categoryId ? String(p.categoryId) : "",
                            departmentId: p.departmentId ? String(p.departmentId) : "",
                            brand: p.brand || "",
                            costPrice: Number(p.costPrice || 0),
                            retailPrice: Number(p.retailPrice || p.salePrice || 0),
                            reorderPoint: p.reorderPoint !== undefined ? Number(p.reorderPoint) : 5,
                            msrp: p.msrp || "",
                            manufacturer: p.manufacturer || "",
                            weight: p.weight || "",
                            taxCode: p.taxCode || "",
                            trackingType: p.trackingType || "none",
                            hasExpiration: Boolean(p.hasExpiration),
                            commissionEligible: Boolean(p.commissionEligible),
                            commissionRate: p.commissionRate || "0.00",
                            rewardsEligible: Boolean(p.rewardsEligible),
                            rewardsPoints: Number(p.rewardsPoints || 0),
                            printTagTemplate: p.printTagTemplate || "",
                            printTagDefaultQty: Number(p.printTagDefaultQty || 1),
                            customField1: p.customField1 || "",
                            customField2: p.customField2 || "",
                            customField3: p.customField3 || "",
                            customField4: p.customField4 || "",
                            customField5: p.customField5 || "",
                            additionalBarcodes: p.additionalBarcodes || [],
                            vendors: p.vendors || [],
                            pricingTiers: p.pricingTiers || [],
                            uoms: p.uoms || [],
                            attributes: p.attributes || []
                          });
                          setModalTab("general");
                          setShowEditModal(true);
                        }}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold px-2 py-1 rounded transition cursor-pointer"
                      >
                        {locale === "en" ? "Edit" : "تعديل"}
                      </button>
                      <button
                        onClick={() => {
                          setAdjustProduct(p);
                          setShowAdjustModal(true);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded transition cursor-pointer"
                      >
                        {locale === "en" ? "Adjust" : "تعديل الكمية"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs text-slate-300 min-w-[700px]">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="px-4 sm:px-6 py-3.5">{locale === "en" ? "Movement Ref" : "مرجع الحركة"}</th>
                  <th className="px-4 sm:px-6 py-3.5">{locale === "en" ? "Product" : "المنتج"}</th>
                  <th className="px-4 sm:px-6 py-3.5">{locale === "en" ? "SKU" : "الرمز"}</th>
                  <th className="px-4 sm:px-6 py-3.5">{locale === "en" ? "Type" : "نوع الحركة"}</th>
                  <th className="px-4 sm:px-6 py-3.5 text-right">{locale === "en" ? "Quantity" : "الكمية"}</th>
                  <th className="px-4 sm:px-6 py-3.5">{locale === "en" ? "Reference" : "مرجع التدقيق"}</th>
                  <th className="px-4 sm:px-6 py-3.5">{locale === "en" ? "Date" : "التاريخ"}</th>
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

      {/* Add / Edit Product Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-slate-950/85 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <form
            onSubmit={handleProductFormSubmit}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl p-6 shadow-2xl space-y-4 my-8"
          >
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Package className="text-emerald-500" size={16} />
                {showEditModal
                  ? (locale === "en" ? `Edit Product: ${formValues.name}` : `تعديل منتج: ${formValues.name}`)
                  : (locale === "en" ? "Add New Advanced Product" : "إضافة منتج متقدم جديد")}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                }}
                className="text-slate-400 hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Tabs Header */}
            <div className="flex border-b border-slate-800/60 pb-1.5 gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setModalTab("general")}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                  modalTab === "general" ? "bg-slate-800 text-white border border-slate-700" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {locale === "en" ? "General & Pricing" : "عام والأسعار"}
              </button>
              <button
                type="button"
                onClick={() => setModalTab("advanced")}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                  modalTab === "advanced" ? "bg-slate-800 text-white border border-slate-700" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {locale === "en" ? "POS Specs & Rules" : "مواصفات نقاط البيع"}
              </button>
              <button
                type="button"
                onClick={() => setModalTab("subrelations")}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                  modalTab === "subrelations" ? "bg-slate-800 text-white border border-slate-700" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {locale === "en" ? "Barcodes, Vendors & Tiers" : "الباركود والشركاء والأسعار"}
              </button>
              <button
                type="button"
                onClick={() => setModalTab("uom_custom")}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                  modalTab === "uom_custom" ? "bg-slate-800 text-white border border-slate-700" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {locale === "en" ? "UOMs & Custom Fields" : "وحدات القياس وحقول مخصصة"}
              </button>
            </div>

            {/* Modal Tabs Content */}
            <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-4 text-xs">
              
              {/* TAB 1: GENERAL & PRICING */}
              {modalTab === "general" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Product Name *</label>
                    <input
                      type="text"
                      value={formValues.name}
                      onChange={(e) => setFormValues({ ...formValues, name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Product SKU *</label>
                    <input
                      type="text"
                      value={formValues.sku}
                      onChange={(e) => setFormValues({ ...formValues, sku: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-emerald-400 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Primary Barcode *</label>
                    <input
                      type="text"
                      value={formValues.barcode}
                      onChange={(e) => setFormValues({ ...formValues, barcode: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-amber-400 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Brand Name</label>
                    <input
                      type="text"
                      value={formValues.brand}
                      onChange={(e) => setFormValues({ ...formValues, brand: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Category *</label>
                    <select
                      value={formValues.categoryId}
                      onChange={(e) => setFormValues({ ...formValues, categoryId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
                      required
                    >
                      <option value="">-- Select Category --</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Department</label>
                    <select
                      value={formValues.departmentId}
                      onChange={(e) => setFormValues({ ...formValues, departmentId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
                    >
                      <option value="">-- Select Department --</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Cost Price ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formValues.costPrice}
                      onChange={(e) => setFormValues({ ...formValues, costPrice: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-red-400 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Retail Price ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formValues.retailPrice}
                      onChange={(e) => setFormValues({ ...formValues, retailPrice: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-emerald-400 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">MSRP ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formValues.msrp}
                      onChange={(e) => setFormValues({ ...formValues, msrp: e.target.value })}
                      placeholder="Manufacturer Suggested Retail Price"
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-slate-400 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Reorder Point</label>
                    <input
                      type="number"
                      value={formValues.reorderPoint}
                      onChange={(e) => setFormValues({ ...formValues, reorderPoint: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] text-slate-400 mb-1">Description</label>
                    <textarea
                      value={formValues.description}
                      onChange={(e) => setFormValues({ ...formValues, description: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 h-16 resize-none text-xs"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: ADVANCED SPECS & RULES */}
              {modalTab === "advanced" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Manufacturer</label>
                    <input
                      type="text"
                      value={formValues.manufacturer}
                      onChange={(e) => setFormValues({ ...formValues, manufacturer: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Weight (kg/lbs)</label>
                    <input
                      type="text"
                      value={formValues.weight}
                      onChange={(e) => setFormValues({ ...formValues, weight: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Tax Code</label>
                    <input
                      type="text"
                      value={formValues.taxCode}
                      onChange={(e) => setFormValues({ ...formValues, taxCode: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Tracking Type</label>
                    <select
                      value={formValues.trackingType}
                      onChange={(e) => setFormValues({ ...formValues, trackingType: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
                    >
                      <option value="none">None (Standard stock tracking)</option>
                      <option value="serial">Serial Number Tracking</option>
                      <option value="lot">Batch/Lot Number Tracking</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3 bg-slate-950/40 p-3 rounded-lg border border-slate-800">
                    <input
                      type="checkbox"
                      id="hasExpiration"
                      checked={formValues.hasExpiration}
                      onChange={(e) => setFormValues({ ...formValues, hasExpiration: e.target.checked })}
                      className="accent-emerald-500 h-4 w-4 cursor-pointer"
                    />
                    <label htmlFor="hasExpiration" className="font-semibold text-slate-300 cursor-pointer">
                      Product Expiration Date Required
                    </label>
                  </div>
                  <div className="flex items-center gap-3 bg-slate-950/40 p-3 rounded-lg border border-slate-800">
                    <input
                      type="checkbox"
                      id="commissionEligible"
                      checked={formValues.commissionEligible}
                      onChange={(e) => setFormValues({ ...formValues, commissionEligible: e.target.checked })}
                      className="accent-emerald-500 h-4 w-4 cursor-pointer"
                    />
                    <label htmlFor="commissionEligible" className="font-semibold text-slate-300 cursor-pointer">
                      Eligible for Sales Commission
                    </label>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Commission Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formValues.commissionRate}
                      disabled={!formValues.commissionEligible}
                      onChange={(e) => setFormValues({ ...formValues, commissionRate: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 disabled:opacity-50 font-mono text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-3 bg-slate-950/40 p-3 rounded-lg border border-slate-800">
                    <input
                      type="checkbox"
                      id="rewardsEligible"
                      checked={formValues.rewardsEligible}
                      onChange={(e) => setFormValues({ ...formValues, rewardsEligible: e.target.checked })}
                      className="accent-emerald-500 h-4 w-4 cursor-pointer"
                    />
                    <label htmlFor="rewardsEligible" className="font-semibold text-slate-300 cursor-pointer">
                      Eligible for Loyalty Rewards Points
                    </label>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Rewards Points Multiplier / Count</label>
                    <input
                      type="number"
                      value={formValues.rewardsPoints}
                      disabled={!formValues.rewardsEligible}
                      onChange={(e) => setFormValues({ ...formValues, rewardsPoints: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 disabled:opacity-50 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Print Tag Template</label>
                    <input
                      type="text"
                      value={formValues.printTagTemplate}
                      onChange={(e) => setFormValues({ ...formValues, printTagTemplate: e.target.value })}
                      placeholder="e.g. Standard Jewelry Tag, Thermal Barcode 2x1"
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Print Tag Default Qty</label>
                    <input
                      type="number"
                      value={formValues.printTagDefaultQty}
                      onChange={(e) => setFormValues({ ...formValues, printTagDefaultQty: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: RELATION SUB-LISTS (BARCODES, VENDORS, PRICING TIERS) */}
              {modalTab === "subrelations" && (
                <div className="space-y-6">
                  {/* MULTIPLE BARCODES */}
                  <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                      <span className="font-bold text-slate-200 text-xs">Multiple Auxiliary Barcodes</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFormValues({
                            ...formValues,
                            additionalBarcodes: [...formValues.additionalBarcodes, { barcode: "", notes: "" }]
                          });
                        }}
                        className="text-[10px] bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-400 font-bold px-2.5 py-1 rounded cursor-pointer transition"
                      >
                        + Add Barcode
                      </button>
                    </div>
                    {formValues.additionalBarcodes.length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic">No auxiliary barcodes added yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {formValues.additionalBarcodes.map((item, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={item.barcode}
                              placeholder="Barcode Value"
                              onChange={(e) => {
                                const copy = [...formValues.additionalBarcodes];
                                copy[idx].barcode = e.target.value;
                                setFormValues({ ...formValues, additionalBarcodes: copy });
                              }}
                              className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-emerald-400 focus:outline-none text-xs"
                              required
                            />
                            <input
                              type="text"
                              value={item.notes || ""}
                              placeholder="Notes (e.g. Case of 12 UPC)"
                              onChange={(e) => {
                                const copy = [...formValues.additionalBarcodes];
                                copy[idx].notes = e.target.value;
                                setFormValues({ ...formValues, additionalBarcodes: copy });
                              }}
                              className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 focus:outline-none text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const copy = formValues.additionalBarcodes.filter((_, i) => i !== idx);
                                setFormValues({ ...formValues, additionalBarcodes: copy });
                              }}
                              className="text-red-500 hover:text-red-400 font-bold px-2 py-1 cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* MULTIPLE VENDORS WITH VENDOR-SPECIFIC COSTS */}
                  <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                      <span className="font-bold text-slate-200 text-xs">Multiple Product Vendors & Vendor Costs</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFormValues({
                            ...formValues,
                            vendors: [...formValues.vendors, { vendorId: vendorsList[0]?.id || 0, vendorPartNumber: "", vendorCost: 0, isPrimary: false }]
                          });
                        }}
                        className="text-[10px] bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-400 font-bold px-2.5 py-1 rounded cursor-pointer transition"
                      >
                        + Add Vendor Link
                      </button>
                    </div>
                    {formValues.vendors.length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic">No vendor linkings established yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {formValues.vendors.map((item, idx) => (
                          <div key={idx} className="flex flex-wrap md:flex-nowrap gap-2 items-center bg-slate-950/60 p-2.5 border border-slate-850 rounded-lg">
                            <select
                              value={item.vendorId}
                              onChange={(e) => {
                                const copy = [...formValues.vendors];
                                copy[idx].vendorId = Number(e.target.value);
                                setFormValues({ ...formValues, vendors: copy });
                              }}
                              className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 focus:outline-none text-xs w-full md:w-1/3"
                              required
                            >
                              <option value="">-- Select Vendor --</option>
                              {vendorsList.map(v => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={item.vendorPartNumber || ""}
                              placeholder="Part Number"
                              onChange={(e) => {
                                const copy = [...formValues.vendors];
                                copy[idx].vendorPartNumber = e.target.value;
                                setFormValues({ ...formValues, vendors: copy });
                              }}
                              className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 focus:outline-none text-xs w-full md:w-1/4"
                            />
                            <input
                              type="number"
                              step="0.01"
                              value={item.vendorCost}
                              placeholder="Vendor-Specific Cost ($)"
                              onChange={(e) => {
                                const copy = [...formValues.vendors];
                                copy[idx].vendorCost = Number(e.target.value);
                                setFormValues({ ...formValues, vendors: copy });
                              }}
                              className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 focus:outline-none font-mono text-red-400 text-xs w-full md:w-1/4"
                              required
                            />
                            <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer min-w-[70px]">
                              <input
                                type="checkbox"
                                checked={item.isPrimary}
                                onChange={(e) => {
                                  const copy = [...formValues.vendors];
                                  if (e.target.checked) {
                                    // ensure only one is primary
                                    copy.forEach((v, i) => v.isPrimary = i === idx);
                                  } else {
                                    copy[idx].isPrimary = false;
                                  }
                                  setFormValues({ ...formValues, vendors: copy });
                                }}
                                className="accent-emerald-500"
                              />
                              Primary
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                const copy = formValues.vendors.filter((_, i) => i !== idx);
                                setFormValues({ ...formValues, vendors: copy });
                              }}
                              className="text-red-500 hover:text-red-400 font-bold px-2 py-1 cursor-pointer ml-auto"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* MULTIPLE PRICING LEVELS & CUSTOMER TIERS */}
                  <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                      <span className="font-bold text-slate-200 text-xs">Pricing Levels & Customer Tiers</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFormValues({
                            ...formValues,
                            pricingTiers: [...formValues.pricingTiers, { tierName: "", price: 0 }]
                          });
                        }}
                        className="text-[10px] bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-400 font-bold px-2.5 py-1 rounded cursor-pointer transition"
                      >
                        + Add Pricing Level
                      </button>
                    </div>
                    {formValues.pricingTiers.length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic">No custom pricing levels or tiers defined yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {formValues.pricingTiers.map((item, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={item.tierName}
                              placeholder="Tier/Pricing Level Name (e.g. VIP, Wholesale)"
                              onChange={(e) => {
                                const copy = [...formValues.pricingTiers];
                                copy[idx].tierName = e.target.value;
                                setFormValues({ ...formValues, pricingTiers: copy });
                              }}
                              className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 focus:outline-none text-xs font-semibold"
                              required
                            />
                            <input
                              type="number"
                              step="0.01"
                              value={item.price}
                              placeholder="Price ($)"
                              onChange={(e) => {
                                const copy = [...formValues.pricingTiers];
                                copy[idx].price = Number(e.target.value);
                                setFormValues({ ...formValues, pricingTiers: copy });
                              }}
                              className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 focus:outline-none font-mono text-emerald-400 text-xs"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const copy = formValues.pricingTiers.filter((_, i) => i !== idx);
                                setFormValues({ ...formValues, pricingTiers: copy });
                              }}
                              className="text-red-500 hover:text-red-400 font-bold px-2 py-1 cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: UNITS OF MEASURE & CUSTOM FIELDS */}
              {modalTab === "uom_custom" && (
                <div className="space-y-6">
                  {/* MULTIPLE UNITS OF MEASURE WITH CONVERSION FACTORS */}
                  <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                      <span className="font-bold text-slate-200 text-xs">Units of Measure (UOM) with Conversion factors</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFormValues({
                            ...formValues,
                            uoms: [...formValues.uoms, { unitName: "", conversionFactor: 1, barcode: "", retailPrice: undefined, costPrice: undefined, isBaseUnit: false }]
                          });
                        }}
                        className="text-[10px] bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-400 font-bold px-2.5 py-1 rounded cursor-pointer transition"
                      >
                        + Add UOM Unit
                      </button>
                    </div>
                    {formValues.uoms.length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic">No alternative units of measure created yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {formValues.uoms.map((item, idx) => (
                          <div key={idx} className="bg-slate-950/60 p-3 border border-slate-850 rounded-lg space-y-2">
                            <div className="flex gap-2 items-center">
                              <input
                                type="text"
                                value={item.unitName}
                                placeholder="Unit Name (e.g. Case, Box, Pack of 6)"
                                onChange={(e) => {
                                  const copy = [...formValues.uoms];
                                  copy[idx].unitName = e.target.value;
                                  setFormValues({ ...formValues, uoms: copy });
                                }}
                                className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 focus:outline-none text-xs font-semibold"
                                required
                              />
                              <input
                                type="number"
                                step="0.0001"
                                value={item.conversionFactor}
                                placeholder="Conversion Factor"
                                onChange={(e) => {
                                  const copy = [...formValues.uoms];
                                  copy[idx].conversionFactor = Number(e.target.value);
                                  setFormValues({ ...formValues, uoms: copy });
                                }}
                                className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 focus:outline-none text-xs font-mono"
                                required
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const copy = formValues.uoms.filter((_, i) => i !== idx);
                                  setFormValues({ ...formValues, uoms: copy });
                                }}
                                className="text-red-500 hover:text-red-400 font-bold px-2 py-1 cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-[11px]">
                              <div>
                                <label className="text-slate-400 block mb-0.5">Unit Barcode</label>
                                <input
                                  type="text"
                                  value={item.barcode || ""}
                                  placeholder="Specific UPC for unit"
                                  onChange={(e) => {
                                    const copy = [...formValues.uoms];
                                    copy[idx].barcode = e.target.value;
                                    setFormValues({ ...formValues, uoms: copy });
                                  }}
                                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none text-xs font-mono"
                                />
                              </div>
                              <div>
                                <label className="text-slate-400 block mb-0.5">Unit CostPrice ($)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={item.costPrice || ""}
                                  placeholder="Leave blank for auto-calc"
                                  onChange={(e) => {
                                    const copy = [...formValues.uoms];
                                    copy[idx].costPrice = e.target.value ? Number(e.target.value) : undefined;
                                    setFormValues({ ...formValues, uoms: copy });
                                  }}
                                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none text-xs font-mono"
                                />
                              </div>
                              <div>
                                <label className="text-slate-400 block mb-0.5">Unit Retail Price ($)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={item.retailPrice || ""}
                                  placeholder="Leave blank for auto-calc"
                                  onChange={(e) => {
                                    const copy = [...formValues.uoms];
                                    copy[idx].retailPrice = e.target.value ? Number(e.target.value) : undefined;
                                    setFormValues({ ...formValues, uoms: copy });
                                  }}
                                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none text-xs font-mono"
                                />
                              </div>
                              <div className="flex items-center gap-1 mt-4">
                                <input
                                  type="checkbox"
                                  id={`isBaseUnit-${idx}`}
                                  checked={item.isBaseUnit}
                                  onChange={(e) => {
                                    const copy = [...formValues.uoms];
                                    if (e.target.checked) {
                                      copy.forEach((u, i) => u.isBaseUnit = i === idx);
                                    } else {
                                      copy[idx].isBaseUnit = false;
                                    }
                                    setFormValues({ ...formValues, uoms: copy });
                                  }}
                                  className="accent-emerald-500 h-3 w-3 cursor-pointer"
                                />
                                <label htmlFor={`isBaseUnit-${idx}`} className="text-slate-300 cursor-pointer">Base Unit</label>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* FIVE CUSTOM FIELDS */}
                  <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 space-y-3">
                    <span className="font-bold text-slate-200 text-xs block border-b border-slate-800 pb-1.5">Custom Product Attributes</span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Custom Field 1</label>
                        <input
                          type="text"
                          value={formValues.customField1}
                          onChange={(e) => setFormValues({ ...formValues, customField1: e.target.value })}
                          placeholder="e.g. Vintage year"
                          className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Custom Field 2</label>
                        <input
                          type="text"
                          value={formValues.customField2}
                          onChange={(e) => setFormValues({ ...formValues, customField2: e.target.value })}
                          placeholder="e.g. Custom grouping code"
                          className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Custom Field 3</label>
                        <input
                          type="text"
                          value={formValues.customField3}
                          onChange={(e) => setFormValues({ ...formValues, customField3: e.target.value })}
                          placeholder="e.g. Care instructions"
                          className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Custom Field 4</label>
                        <input
                          type="text"
                          value={formValues.customField4}
                          onChange={(e) => setFormValues({ ...formValues, customField4: e.target.value })}
                          placeholder="e.g. Material blend"
                          className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[11px] text-slate-400 mb-1">Custom Field 5</label>
                        <input
                          type="text"
                          value={formValues.customField5}
                          onChange={(e) => setFormValues({ ...formValues, customField5: e.target.value })}
                          placeholder="e.g. Safety warning note"
                          className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            <div className="flex gap-2 justify-end border-t border-slate-800/80 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                {locale === "en" ? "Cancel" : "إلغاء"}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition cursor-pointer"
              >
                {locale === "en" ? "Save Catalog Item" : "حفظ الصنف في الكتالوج"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
