/**
 * Shared Type Definitions for Cloud MultiStore POS & ERP Platform
 */

export type Locale = "en" | "ar";
export type Theme = "light" | "dark";

export type ModuleId =
  | "dashboard"
  | "pos"
  | "inventory"
  | "purchasing"
  | "sales"
  | "accounting"
  | "banking"
  | "fixed_assets"
  | "reports"
  | "admin";

export interface User {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  roleId: number;
  companyId: number;
  storeId?: number;
  isActive: boolean;
}

export interface Session {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
}

// Translations dictionary type
export interface Dictionary {
  dashboard: string;
  pos: string;
  inventory: string;
  purchasing: string;
  sales: string;
  accounting: string;
  banking: string;
  fixedAssets: string;
  reports: string;
  admin: string;
  logout: string;
  login: string;
  welcome: string;
  search: string;
  loading: string;
  error: string;
  success: string;
  save: string;
  cancel: string;
  create: string;
  delete: string;
  edit: string;
  actions: string;
  status: string;
  date: string;
  amount: string;
  total: string;
  subtotal: string;
  tax: string;
  discount: string;
  customer: string;
  supplier: string;
  product: string;
  sku: string;
  qty: string;
  price: string;
  store: string;
  userManagement: string;
  settings: string;
  financialStatements: string;
  trialBalance: string;
  journalEntries: string;
  generalLedger: string;
  balanceSheet: string;
  profitLoss: string;
  cashFlow: string;
  depreciation: string;
  reconciliation: string;
  offlineMode: string;
  reconnect: string;
  printedReceipt: string;
  keyboardShortcuts: string;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  barcode?: string;
  costPrice: number;
  salePrice: number;
  qtyOnHand: number;
  categoryId?: number;
  storeId?: number;
}

export interface Category {
  id: number;
  name: string;
  code?: string;
}

export interface Store {
  id: number;
  name: string;
  code: string;
  location?: string;
  type: string; // "hq" | "branch"
  status: string;
}

export interface CartItem {
  product: Product;
  qty: number;
  discount: number; // Percentage
  taxRate: number; // Percentage
}

export interface Customer {
  id: number;
  name: string;
  mobileNumber: string;
  email?: string;
  balance: number;
  loyaltyPoints: number;
}
