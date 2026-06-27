/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { User, Locale, ModuleId } from "./types";
import { api } from "./lib/api";
import { en, ar } from "./lib/dictionary";
import { LoginScreen } from "./components/LoginScreen";
import { ExecutiveDashboard } from "./components/ExecutiveDashboard";
import { POSModule } from "./components/POSModule";
import { InventoryModule } from "./components/InventoryModule";
import { PurchasingModule } from "./components/PurchasingModule";
import { SalesModule } from "./components/SalesModule";
import { AccountingModule } from "./components/AccountingModule";
import { BankingModule } from "./components/BankingModule";
import { FixedAssetsModule } from "./components/FixedAssetsModule";
import { ReportsModule } from "./components/ReportsModule";
import { AdminModule } from "./components/AdminModule";

import {
  TrendingUp,
  CreditCard,
  Package,
  FileText,
  Users,
  BookOpen,
  ArrowRightLeft,
  Building2,
  FileSpreadsheet,
  Settings,
  LogOut,
  Globe,
  Clock,
  Menu,
  X
} from "lucide-react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleId>("dashboard");
  const [locale, setLocale] = useState<Locale>("en");
  const [currentTime, setCurrentTime] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Load active session and start clock
  useEffect(() => {
    const sessionUser = api.getSessionUser();
    if (sessionUser) {
      setUser(sessionUser);
    }

    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toUTCString().replace("GMT", "UTC"));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
  };

  const dict = locale === "en" ? en : ar;

  if (!user) {
    return (
      <LoginScreen
        locale={locale}
        setLocale={setLocale}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  // Sidebar navigation options
  const navItems = [
    { id: "dashboard" as ModuleId, label: dict.dashboard, icon: TrendingUp },
    { id: "pos" as ModuleId, label: dict.pos, icon: CreditCard, accent: true },
    { id: "inventory" as ModuleId, label: dict.inventory, icon: Package },
    { id: "purchasing" as ModuleId, label: dict.purchasing, icon: FileText },
    { id: "sales" as ModuleId, label: dict.sales, icon: Users },
    { id: "accounting" as ModuleId, label: dict.accounting, icon: BookOpen },
    { id: "banking" as ModuleId, label: dict.banking, icon: ArrowRightLeft },
    { id: "fixed_assets" as ModuleId, label: dict.fixedAssets, icon: Building2 },
    { id: "reports" as ModuleId, label: dict.reports, icon: FileSpreadsheet },
    { id: "admin" as ModuleId, label: dict.admin, icon: Settings }
  ];

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100 flex font-sans overflow-hidden select-none"
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-slate-950/80 z-40 lg:hidden transition"
        />
      )}

      {/* Corporate Left Sidebar navigation drawer */}
      <aside
        className={`fixed inset-y-0 lg:static z-50 flex flex-col w-64 bg-slate-900 border-slate-800 transition-all duration-300 ${
          locale === "ar"
            ? "right-0 border-l lg:border-l-0"
            : "left-0 border-r lg:border-r-0"
        } ${
          sidebarOpen
            ? "translate-x-0"
            : locale === "ar"
            ? "translate-x-full lg:translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand Banner */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
              <Building2 size={18} />
            </div>
            <div className="text-left" dir="ltr">
              <span className="block text-xs font-black tracking-widest text-emerald-400 font-mono">MULTISTORE</span>
              <span className="block text-[9px] text-slate-500 font-bold uppercase tracking-wider">Enterprise ERP v4.1</span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-500 hover:text-slate-300"
          >
            <X size={18} />
          </button>
        </div>

        {/* Sidebar Nav items */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1.5 scrollbar-thin">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveModule(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  isActive
                    ? item.accent
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-950/40"
                      : "bg-slate-800 text-white"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-850"
                }`}
              >
                <Icon size={16} className={isActive ? "text-white" : "text-slate-500"} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User context footer card */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
            <div className="truncate">
              <span className="block text-xs font-bold text-white truncate">{user.fullName}</span>
              <span className="block text-[9px] text-slate-500 font-mono truncate">{user.email}</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 bg-slate-800 hover:bg-red-950/30 text-slate-400 hover:text-red-400 rounded-lg border border-slate-700/50 transition cursor-pointer"
              title={dict.logout}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Container panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Master Top Header bar */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-900/40 backdrop-blur-md relative z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1 bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition"
            >
              <Menu size={18} />
            </button>

            {/* Current Active outlet indicator */}
            <div className="flex items-center gap-2 text-xs font-bold bg-slate-950 px-3.5 py-1.5 rounded-full border border-slate-800 text-slate-300">
              <Building2 size={14} className="text-emerald-500" />
              <span>{locale === "en" ? "HQ Branch #01" : "الفرع الرئيسي #01"}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Real-time ticker clock */}
            <div className="hidden md:flex items-center gap-1.5 text-[10px] text-slate-500 font-mono bg-slate-950/50 px-3 py-1.5 rounded-full border border-slate-850">
              <Clock size={12} />
              <span>{currentTime || "Loading Date-Time Ticker..."}</span>
            </div>

            {/* English/Arabic Locale toggle */}
            <button
              onClick={() => setLocale(locale === "en" ? "ar" : "en")}
              className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition text-xs bg-slate-800/60 hover:bg-slate-800 px-3.5 py-1.5 rounded-full border border-slate-700/40 cursor-pointer"
            >
              <Globe size={14} />
              <span className="font-semibold">{locale === "en" ? "العربية" : "English"}</span>
            </button>
          </div>
        </header>

        {/* Dynamic Screen viewport */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          {activeModule === "dashboard" && <ExecutiveDashboard locale={locale} />}
          {activeModule === "pos" && <POSModule locale={locale} />}
          {activeModule === "inventory" && <InventoryModule locale={locale} />}
          {activeModule === "purchasing" && <PurchasingModule locale={locale} />}
          {activeModule === "sales" && <SalesModule locale={locale} />}
          {activeModule === "accounting" && <AccountingModule locale={locale} />}
          {activeModule === "banking" && <BankingModule locale={locale} />}
          {activeModule === "fixed_assets" && <FixedAssetsModule locale={locale} />}
          {activeModule === "reports" && <ReportsModule locale={locale} />}
          {activeModule === "admin" && <AdminModule locale={locale} />}
        </main>
      </div>
    </div>
  );
}

