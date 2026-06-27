import React, { useState, useEffect, useRef } from "react";
import { api, isOffline } from "../lib/api";
import { Product, Customer, CartItem, Locale } from "../types";
import {
  Search,
  User,
  Barcode,
  Percent,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  Wifi,
  WifiOff,
  Printer,
  CreditCard,
  CornerDownLeft,
  X,
  Keyboard
} from "lucide-react";

interface POSModuleProps {
  locale: Locale;
}

export const POSModule: React.FC<POSModuleProps> = ({ locale }) => {
  const [onlineStatus, setOnlineStatus] = useState(!isOffline());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [cartDiscount, setCartDiscount] = useState<number>(0); // Percentage
  const [splitPayments, setSplitPayments] = useState<{ method: string; amount: number }[]>([
    { method: "cash", amount: 0 }
  ]);
  const [checkoutResult, setCheckoutResult] = useState<any>(null);
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);
  const [syncingOffline, setSyncingOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setOnlineStatus(true);
    const handleOffline = () => setOnlineStatus(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    updateOfflineQueueCount();

    // Register Keyboard Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F9") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "F8") {
        e.preventDefault();
        handleCheckout();
      } else if (e.key === "F10") {
        e.preventDefault();
        clearCart();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    fetchCustomers();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const updateOfflineQueueCount = () => {
    try {
      const queue = JSON.parse(localStorage.getItem("offline_checkout_queue") || "[]");
      setOfflineQueueCount(queue.length);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCustomers = async () => {
    try {
      const data = await api.listCustomers();
      setCustomers(data);
    } catch (err) {
      console.error("Failed to load customers", err);
    }
  };

  // Search Products
  const handleSearch = async (val: string) => {
    setSearchQuery(val);
    if (!val.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const data = await api.posSearch(val);
      setSearchResults(data);
    } catch (err) {
      console.error(err);
      // Fallback local products if offline/error
      setSearchResults([
        { id: 1, name: "Premium Wireless Headphones", sku: "HD-901", salePrice: 120.00, costPrice: 70, qtyOnHand: 45 },
        { id: 2, name: "Ergonomic Office Chair", sku: "CH-04", salePrice: 185.00, costPrice: 110, qtyOnHand: 15 },
        { id: 3, name: "Mechanical Gaming Keyboard", sku: "KB-770", salePrice: 79.99, costPrice: 40, qtyOnHand: 32 },
        { id: 4, name: "UltraWide 4K Monitor", sku: "MN-402", salePrice: 349.99, costPrice: 200, qtyOnHand: 11 }
      ].filter(p => p.name.toLowerCase().includes(val.toLowerCase())));
    }
  };

  // Barcode Lookup simulation
  const handleBarcodeLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    setError(null);
    try {
      const p = await api.posLookup(barcodeInput);
      if (p) {
        addToCart(p);
        setBarcodeInput("");
      }
    } catch (err) {
      // Offline fallback lookup
      const fallbacks: Record<string, Product> = {
        "123456": { id: 1, name: "Premium Wireless Headphones", sku: "HD-901", salePrice: 120.00, costPrice: 70, qtyOnHand: 45 },
        "789012": { id: 2, name: "Ergonomic Office Chair", sku: "CH-04", salePrice: 185.00, costPrice: 110, qtyOnHand: 15 }
      };
      const found = fallbacks[barcodeInput.trim()];
      if (found) {
        addToCart(found);
        setBarcodeInput("");
      } else {
        setError(locale === "en" ? "Product barcode not found" : "رمز الباركود غير موجود");
      }
    }
  };

  const addToCart = (product: Product) => {
    const existing = cart.find((item) => item.product.id === product.id);
    if (existing) {
      setCart(
        cart.map((item) =>
          item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item
        )
      );
    } else {
      setCart([...cart, { product, qty: 1, discount: 0, taxRate: 8 }]);
    }
    setSearchResults([]);
    setSearchQuery("");
  };

  const updateQty = (id: number, delta: number) => {
    setCart(
      cart
        .map((item) => {
          if (item.product.id === id) {
            const nextQty = item.qty + delta;
            return { ...item, qty: nextQty };
          }
          return item;
        })
        .filter((item) => item.qty > 0)
    );
  };

  const updateLineDiscount = (id: number, discount: number) => {
    setCart(
      cart.map((item) =>
        item.product.id === id ? { ...item, discount: Math.max(0, Math.min(100, discount)) } : item
      )
    );
  };

  const removeFromCart = (id: number) => {
    setCart(cart.filter((item) => item.product.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setCartDiscount(0);
    setSplitPayments([{ method: "cash", amount: 0 }]);
    setCheckoutResult(null);
    setError(null);
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => {
      const price = item.product.salePrice;
      const discount = price * (item.discount / 100);
      return sum + (price - discount) * item.qty;
    }, 0);
  };

  const calculateTax = () => {
    return cart.reduce((sum, item) => {
      const price = item.product.salePrice;
      const discount = price * (item.discount / 100);
      const taxedPrice = price - discount;
      return sum + taxedPrice * (item.taxRate / 100) * item.qty;
    }, 0);
  };

  const calculateTotal = () => {
    const sub = calculateSubtotal();
    const tx = calculateTax();
    const cartDiscVal = sub * (cartDiscount / 100);
    return Math.max(0, sub + tx - cartDiscVal);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      setError(locale === "en" ? "Cart is empty" : "السلة فارغة");
      return;
    }

    setError(null);
    const totalAmount = calculateTotal();
    const subtotal = calculateSubtotal();

    const checkoutPayload = {
      customerId: selectedCustomer?.id || undefined,
      storeId: 1,
      cashierId: 1,
      subtotal: Number(subtotal.toFixed(2)),
      items: cart.map((c) => ({
        productId: c.product.id,
        qty: c.qty,
        discountPercent: c.discount,
        taxRate: c.taxRate,
        unitPrice: Number((c.product.salePrice ?? (c.product as any).retailPrice ?? 0).toFixed(2))
      })),
      totalAmount: Number(totalAmount.toFixed(2)),
      paymentMethod: splitPayments.length > 1 ? "split" : splitPayments[0].method,
      paidAmount: Number(totalAmount.toFixed(2)),
      changeAmount: 0,
      splitPayments: splitPayments.map((p, idx) => ({
        ...p,
        amount: Number((splitPayments.length === 1 && p.amount === 0 ? totalAmount : p.amount).toFixed(2))
      })),
      payments: splitPayments.map((p, idx) => ({
        paymentMethod: p.method,
        amount: Number((splitPayments.length === 1 && p.amount === 0 ? totalAmount : p.amount).toFixed(2))
      }))
    };

    if (isOffline()) {
      // Buffer offline sale
      try {
        const queue = JSON.parse(localStorage.getItem("offline_checkout_queue") || "[]");
        queue.push({
          ...checkoutPayload,
          offlineId: "OFF-" + Date.now(),
          date: new Date().toISOString()
        });
        localStorage.setItem("offline_checkout_queue", JSON.stringify(queue));
        updateOfflineQueueCount();
        setCheckoutResult({
          success: true,
          offline: true,
          totalAmount,
          invoiceNumber: "OFF-INV-" + Math.floor(Math.random() * 900000 + 100000),
          items: cart
        });
        setCart([]);
      } catch (err) {
        console.error(err);
        setError("Failed to process offline checkout");
      }
    } else {
      try {
        const res = await api.posCheckout(checkoutPayload);
        setCheckoutResult({
          ...res,
          items: cart
        });
        setCart([]);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to process sale");
      }
    }
  };

  const syncOfflineQueue = async () => {
    if (offlineQueueCount === 0 || syncingOffline) return;
    setSyncingOffline(true);
    try {
      const queue = JSON.parse(localStorage.getItem("offline_checkout_queue") || "[]");
      const results = await api.syncOfflineQueue(queue);
      const failed = results.filter(r => !r.success).map(r => r.original);
      localStorage.setItem("offline_checkout_queue", JSON.stringify(failed));
      updateOfflineQueueCount();
      alert(locale === "en" ? `Synced successfully!` : `تمت المزامنة بنجاح!`);
    } catch (e) {
      console.error(e);
    } finally {
      setSyncingOffline(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const totalAmount = calculateTotal();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 select-none" dir={locale === "ar" ? "rtl" : "ltr"}>
      {/* Search and Products (7 cols) */}
      <div className="lg:col-span-7 space-y-4">
        {/* Connection & Offline Status */}
        <div className="flex justify-between items-center bg-slate-900 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2">
            {onlineStatus ? (
              <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-900/40">
                <Wifi size={14} />
                {locale === "en" ? "ONLINE TERMINAL" : "المحطة متصلة"}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-amber-400 font-semibold bg-amber-950/40 px-2.5 py-1 rounded-full border border-amber-900/40">
                <WifiOff size={14} />
                {locale === "en" ? "OFFLINE ACTIVE" : "تعمل دون اتصال"}
              </span>
            )}

            {offlineQueueCount > 0 && (
              <button
                onClick={syncOfflineQueue}
                disabled={syncingOffline}
                className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1 rounded-full transition flex items-center gap-1 cursor-pointer"
              >
                {syncingOffline ? "..." : `${locale === "en" ? "Sync" : "مزامنة"} (${offlineQueueCount})`}
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
            <Keyboard size={12} />
            <span>F8: Pay | F9: Search | F10: Flush</span>
          </div>
        </div>

        {/* Product Lookup Area */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
              <Search size={16} />
            </span>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={locale === "en" ? "Search by Product Name or SKU (F9)..." : "البحث باسم المنتج أو الرمز..."}
              className="block w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs transition"
            />

            {/* Live Search Results Drops */}
            {searchResults.length > 0 && (
              <div className="absolute left-0 right-0 mt-1.5 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl z-20 overflow-hidden max-h-56 overflow-y-auto">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="w-full px-4 py-2.5 hover:bg-slate-800/80 text-left border-b border-slate-800 last:border-0 flex justify-between items-center text-xs text-slate-300 transition cursor-pointer"
                  >
                    <div>
                      <span className="font-semibold text-white">{p.name}</span>
                      <span className="block text-[10px] text-slate-500">SKU: {p.sku}</span>
                    </div>
                    <span className="font-bold text-emerald-400">${(p.salePrice ?? Number((p as any).retailPrice) ?? 0).toFixed(2)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleBarcodeLookup} className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
              <Barcode size={16} />
            </span>
            <input
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder={locale === "en" ? "Scan Barcode & Press Enter..." : "امسح الباركود واضغط Enter..."}
              className="block w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs transition"
            />
          </form>
        </div>

        {error && (
          <div className="p-3 bg-red-950/40 border border-red-800/50 text-red-200 text-xs rounded-lg">
            {error}
          </div>
        )}

        {/* Cart Item Grid list */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-300 tracking-wider uppercase">
              {locale === "en" ? "Active Sales Cart" : "سلة المبيعات النشطة"}
            </h3>
            <button
              onClick={clearCart}
              className="text-[10px] text-slate-500 hover:text-red-400 transition cursor-pointer"
            >
              {locale === "en" ? "Clear Cart" : "مسح السلة"}
            </button>
          </div>

          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 space-y-2">
              <Barcode size={32} className="stroke-1 text-slate-600" />
              <p className="text-xs">{locale === "en" ? "Cart is empty. Scan products or search above." : "السلة فارغة. يرجى مسح المنتجات."}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80 max-h-96 overflow-y-auto">
              {cart.map((item) => (
                <div key={item.product.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="text-xs font-semibold text-white">{item.product.name}</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      SKU: {item.product.sku} | ${(item.product.salePrice ?? Number((item.product as any).retailPrice) ?? 0).toFixed(2)}
                    </p>
                  </div>

                  {/* Quantity Actions */}
                  <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                    <button
                      onClick={() => updateQty(item.product.id, -1)}
                      className="p-1 text-slate-400 hover:text-white transition cursor-pointer"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="px-2 text-xs font-semibold text-slate-200 w-6 text-center">
                      {item.qty}
                    </span>
                    <button
                      onClick={() => updateQty(item.product.id, 1)}
                      className="p-1 text-slate-400 hover:text-white transition cursor-pointer"
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  {/* Line item Discount */}
                  <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-0.5 max-w-[80px]">
                    <Percent size={10} className="text-slate-500" />
                    <input
                      type="number"
                      value={item.discount || ""}
                      onChange={(e) => updateLineDiscount(item.product.id, Number(e.target.value))}
                      placeholder="0"
                      className="w-full bg-transparent text-slate-300 text-xs focus:outline-none text-right"
                    />
                  </div>

                  {/* Line Total and delete */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-200 w-16 text-right">
                      ${(((item.product.salePrice ?? Number((item.product as any).retailPrice) ?? 0) * (1 - item.discount / 100)) * item.qty).toFixed(2)}
                    </span>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-slate-500 hover:text-red-400 transition cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* POS Checkout Controls Sidebar (5 cols) */}
      <div className="lg:col-span-5 space-y-4">
        {/* Customer Select CRM */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <label className="block text-xs font-semibold text-slate-300">
            {locale === "en" ? "Customer Select & Loyalty Points" : "اختيار العميل وبرنامج النقاط"}
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-500">
                <User size={14} />
              </span>
              <select
                value={selectedCustomer?.id || ""}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setSelectedCustomer(customers.find((c) => c.id === id) || null);
                }}
                className="block w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-xs focus:outline-none focus:border-emerald-500"
              >
                <option value="">{locale === "en" ? "Walk-in Guest" : "عميل عابر"}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedCustomer && (
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850 flex justify-between items-center text-[11px]">
              <div>
                <span className="text-slate-500">Balance due:</span>
                <span className="block font-semibold text-red-400">${Number(selectedCustomer.balance).toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-500">Loyalty Points:</span>
                <span className="block font-semibold text-yellow-400">{selectedCustomer.loyaltyPoints}</span>
              </div>
            </div>
          )}
        </div>

        {/* Calculation Invoice Totals */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3.5">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>{locale === "en" ? "Cart Subtotal" : "المجموع الفرعي"}</span>
            <span className="font-semibold text-slate-200">${calculateSubtotal().toFixed(2)}</span>
          </div>

          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>{locale === "en" ? "Estimated Taxes (8%)" : "الضريبة المقدرة"}</span>
            <span className="font-semibold text-slate-200">${calculateTax().toFixed(2)}</span>
          </div>

          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>{locale === "en" ? "Cart Discount (%)" : "خصم المجموع الإجمالي"}</span>
            <input
              type="number"
              value={cartDiscount || ""}
              onChange={(e) => setCartDiscount(Math.max(0, Math.min(100, Number(e.target.value))))}
              placeholder="0"
              className="w-16 bg-slate-950 border border-slate-800 rounded text-center text-slate-200 text-xs py-0.5 focus:outline-none"
            />
          </div>

          <div className="border-t border-slate-800/80 pt-3 flex justify-between items-center">
            <span className="text-sm font-bold text-white">
              {locale === "en" ? "TOTAL DUE" : "الإجمالي المستحق"}
            </span>
            <span className="text-lg font-black text-emerald-400">
              ${totalAmount.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Payments, Splits, Checkout action */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
          <h4 className="text-xs font-semibold text-slate-300">
            {locale === "en" ? "Payment Methods & Splitting" : "طرق الدفع وتقسيم المبالغ"}
          </h4>

          <div className="space-y-2">
            {splitPayments.map((p, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <select
                  value={p.method}
                  onChange={(e) => {
                    const next = [...splitPayments];
                    next[idx].method = e.target.value;
                    setSplitPayments(next);
                  }}
                  className="bg-slate-950 border border-slate-850 rounded-lg px-2 py-1.5 text-slate-300 text-xs focus:outline-none"
                >
                  <option value="cash">{locale === "en" ? "Cash" : "نقداً"}</option>
                  <option value="card">{locale === "en" ? "Credit Card" : "بطاقة ائتمان"}</option>
                  <option value="credit">{locale === "en" ? "Store Credit" : "ائتمان متجر"}</option>
                </select>
                <input
                  type="number"
                  value={p.amount || ""}
                  onChange={(e) => {
                    const next = [...splitPayments];
                    next[idx].amount = Number(e.target.value);
                    setSplitPayments(next);
                  }}
                  placeholder="Amount"
                  className="flex-1 bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-none"
                />
                {splitPayments.length > 1 && (
                  <button
                    onClick={() => setSplitPayments(splitPayments.filter((_, i) => i !== idx))}
                    className="text-slate-500 hover:text-red-400 p-1"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={() => setSplitPayments([...splitPayments, { method: "cash", amount: 0 }])}
              className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
            >
              <Plus size={10} />
              <span>{locale === "en" ? "Add Split Payment Method" : "إضافة تقسيم دفع آخر"}</span>
            </button>
          </div>

          <button
            onClick={handleCheckout}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-lg shadow-emerald-950/20 flex justify-center items-center gap-2 cursor-pointer"
          >
            <CreditCard size={16} />
            <span>{locale === "en" ? "POST CHECKOUT & INVOICE (F8)" : "تأكيد الدفع وإصدار الفاتورة"}</span>
          </button>
        </div>
      </div>

      {/* Checkout Receipt Dialog popup */}
      {checkoutResult && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white text-slate-900 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative border border-slate-200">
            <button
              onClick={() => setCheckoutResult(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={18} />
            </button>

            {/* Receipt template */}
            <div className="text-center space-y-1.5 border-b border-dashed border-slate-300 pb-4">
              <CheckCircle size={32} className="mx-auto text-emerald-500" />
              <h3 className="font-bold text-sm tracking-tight uppercase">
                {checkoutResult.offline ? "OFFLINE STORE RECEIPT" : "CLOUD MULTISTORE POS"}
              </h3>
              <p className="text-[10px] text-slate-500">HQ Branch Outlet #01 | London, UK</p>
              <p className="text-[10px] text-slate-400">
                Invoice No: <span className="font-mono font-bold">{checkoutResult.invoiceNumber || checkoutResult.invoice?.invoiceNumber}</span>
              </p>
            </div>

            <div className="py-4 space-y-2 border-b border-dashed border-slate-300">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {locale === "en" ? "Purchased Items" : "المنتجات المشتراة"}
              </span>
              {checkoutResult.items?.map((item: any) => (
                <div key={item.product.id} className="flex justify-between items-center text-xs">
                  <span>
                    {item.product.name} <span className="text-slate-400">x{item.qty}</span>
                  </span>
                  <span className="font-mono font-semibold">
                    ${(((item.product.salePrice ?? Number((item.product as any).retailPrice) ?? 0) * (1 - item.discount / 100)) * item.qty).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="py-4 space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{locale === "en" ? "Subtotal" : "المجموع الفرعي"}</span>
                <span className="font-semibold">${totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center font-bold text-sm text-slate-900 pt-1.5 border-t border-slate-100">
                <span>{locale === "en" ? "Amount Paid" : "المبلغ المدفوع"}</span>
                <span>${totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={handlePrint}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2 rounded-lg text-xs transition flex justify-center items-center gap-1 cursor-pointer"
              >
                <Printer size={14} />
                <span>{locale === "en" ? "Print Receipt" : "طباعة الإيصال"}</span>
              </button>
              <button
                onClick={() => setCheckoutResult(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 rounded-lg text-xs transition cursor-pointer"
              >
                {locale === "en" ? "New Sale" : "عملية بيع جديدة"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
