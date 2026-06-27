/**
 * Enterprise API Integration Layer with Automatic Session Token Management,
 * Offline POS Buffer Queue, and Clean Handling.
 */

import { Session, User, Product, Customer, Store, Category } from "../types";

const BASE_URL = "/api";

// Helper to check if offline
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private user: User | null = null;

  constructor() {
    this.loadSession();
  }

  private loadSession() {
    try {
      const stored = localStorage.getItem("erp_session");
      if (stored) {
        const session: Session = JSON.parse(stored);
        this.accessToken = session.accessToken;
        this.refreshToken = session.refreshToken;
        this.user = session.user;
      }
    } catch (e) {
      console.error("Failed to restore session", e);
    }
  }

  public setSession(session: Session | null) {
    if (session) {
      this.accessToken = session.accessToken;
      this.refreshToken = session.refreshToken;
      this.user = session.user;
      localStorage.setItem("erp_session", JSON.stringify(session));
    } else {
      this.accessToken = null;
      this.refreshToken = null;
      this.user = null;
      localStorage.removeItem("erp_session");
    }
  }

  public getSessionUser(): User | null {
    return this.user;
  }

  public getAccessToken(): string | null {
    return this.accessToken;
  }

  public isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  // General Fetch wrapper with Bearer token injection and auto-refresh token rotate
  private async request(path: string, options: RequestInit = {}): Promise<any> {
    if (isOffline()) {
      // In offline mode, if it is a safe GET request we return fallback mock data,
      // and if it is POST checkout, we throw a specific error so the POS module buffers it.
      if (options.method === "POST" && path.includes("/pos/checkout")) {
        throw new Error("OFFLINE_CHECKOUT_REQUEST");
      }
      throw new Error("OFFLINE_NETWORK_DISCONNECTED");
    }

    const headers = new Headers(options.headers || {});
    if (this.accessToken) {
      headers.set("Authorization", `Bearer ${this.accessToken}`);
    }
    headers.set("Content-Type", "application/json");

    let response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
    });

    // If unauthorized, attempt token refresh once
    if (response.status === 401 && this.refreshToken) {
      try {
        const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: this.refreshToken }),
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          const newSession: Session = {
            user: refreshData.data.user || this.user,
            accessToken: refreshData.data.accessToken,
            refreshToken: refreshData.data.refreshToken,
            expiresAt: Date.now() + 3600 * 1000,
          };
          this.setSession(newSession);

          // Retry the original request
          headers.set("Authorization", `Bearer ${newSession.accessToken}`);
          response = await fetch(`${BASE_URL}${path}`, {
            ...options,
            headers,
          });
        } else {
          // Token is dead, clear session
          this.setSession(null);
          window.location.reload();
        }
      } catch (err) {
        console.error("Token refresh failed", err);
        this.setSession(null);
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // ==========================================
  // Auth Module
  // ==========================================
  public async login(email: string, password: string): Promise<User> {
    const res = await this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    const session: Session = {
      user: res.data.user,
      accessToken: res.data.accessToken,
      refreshToken: res.data.refreshToken,
      expiresAt: Date.now() + (res.data.expiresIn || 3600) * 1000,
    };
    this.setSession(session);
    return res.data.user;
  }

  public async logout(): Promise<void> {
    try {
      await this.request("/auth/logout", { method: "POST" });
    } catch (e) {
      console.warn("Logout request failed, clearing local state", e);
    } finally {
      this.setSession(null);
    }
  }

  // ==========================================
  // Reporting & Executive Dashboard
  // ==========================================
  public async getDashboardData(startDate?: string, endDate?: string, storeId?: number): Promise<any> {
    const query = new URLSearchParams();
    if (startDate) query.append("startDate", startDate);
    if (endDate) query.append("endDate", endDate);
    if (storeId) query.append("storeId", storeId.toString());
    const res = await this.request(`/reports/dashboard?${query.toString()}`);
    return res.data || res;
  }

  public async getKpiReport(startDate?: string, endDate?: string, storeId?: number): Promise<any> {
    const query = new URLSearchParams();
    if (startDate) query.append("startDate", startDate);
    if (endDate) query.append("endDate", endDate);
    if (storeId) query.append("storeId", storeId.toString());
    const res = await this.request(`/reports/kpis?${query.toString()}`);
    return res.data || res;
  }

  public async getFullFinancialReports(startDate?: string, endDate?: string): Promise<any> {
    const query = new URLSearchParams();
    if (startDate) query.append("startDate", startDate);
    if (endDate) query.append("endDate", endDate);
    const res = await this.request(`/reports/financials/full?${query.toString()}`);
    return res.data || res;
  }

  public async getSalesAnalytics(startDate?: string, endDate?: string, storeId?: number): Promise<any> {
    const query = new URLSearchParams();
    if (startDate) query.append("startDate", startDate);
    if (endDate) query.append("endDate", endDate);
    if (storeId) query.append("storeId", storeId.toString());
    const res = await this.request(`/reports/sales/analytics?${query.toString()}`);
    return res.data || res;
  }

  public async getInventoryAnalytics(startDate?: string, endDate?: string, storeId?: number): Promise<any> {
    const query = new URLSearchParams();
    if (startDate) query.append("startDate", startDate);
    if (endDate) query.append("endDate", endDate);
    if (storeId) query.append("storeId", storeId.toString());
    const res = await this.request(`/reports/inventory/analytics?${query.toString()}`);
    return res.data || res;
  }

  public async getArAnalytics(): Promise<any> {
    const res = await this.request("/reports/ar/analytics");
    return res.data || res;
  }

  public async getApAnalytics(): Promise<any> {
    const res = await this.request("/reports/ap/analytics");
    return res.data || res;
  }

  public async getFixedAssetsAnalytics(): Promise<any> {
    const res = await this.request("/reports/fixed-assets/analytics");
    return res.data || res;
  }

  public async getSavedReports(): Promise<any[]> {
    const res = await this.request("/reports/saved");
    return res.data || res || [];
  }

  public async saveReportLayout(reportName: string, reportType: string, filters: any, layoutConfig: any): Promise<any> {
    const res = await this.request("/reports/saved", {
      method: "POST",
      body: JSON.stringify({
        companyId: this.user?.companyId || 1,
        name: reportName,
        reportType,
        filters: JSON.stringify(filters),
        layoutConfig: JSON.stringify(layoutConfig),
      }),
    });
    return res.data || res;
  }

  public async deleteSavedReport(id: number): Promise<void> {
    await this.request(`/reports/saved/${id}`, { method: "DELETE" });
  }

  // ==========================================
  // Point of Sale (POS) Module
  // ==========================================
  public async posLookup(barcodeOrSku: string): Promise<Product> {
    const res = await this.request(`/pos/lookup/${barcodeOrSku}`);
    const data = res.data || res;
    if (data && data.retailPrice !== undefined && data.salePrice === undefined) {
      data.salePrice = Number(data.retailPrice);
    }
    return data;
  }

  public async posSearch(q: string): Promise<Product[]> {
    const res = await this.request(`/pos/search?q=${encodeURIComponent(q)}`);
    const data = res.data || res || [];
    return data.map((p: any) => ({
      ...p,
      salePrice: p.salePrice !== undefined ? p.salePrice : Number(p.retailPrice || p.salePrice || 0)
    }));
  }

  public async posCalculate(payload: {
    customerId?: number;
    storeId: number;
    items: { productId: number; qty: number; discountPercent?: number }[];
    splitPayments?: { method: string; amount: number }[];
  }): Promise<any> {
    const res = await this.request("/pos/calculate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return res.data || res;
  }

  public async posCheckout(payload: {
    customerId?: number;
    storeId: number;
    cashierId: number;
    items: { productId: number; qty: number; discountPercent?: number; taxRate?: number }[];
    totalAmount: number;
    paymentMethod: string;
    paidAmount: number;
    changeAmount: number;
    splitPayments?: { method: string; amount: number }[];
  }): Promise<any> {
    const res = await this.request("/pos/checkout", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return res.data || res;
  }

  // Offline POS synchronization helper
  public async syncOfflineQueue(offlineItems: any[]): Promise<any[]> {
    const results = [];
    for (const item of offlineItems) {
      try {
        const res = await this.posCheckout(item);
        results.push({ success: true, original: item, result: res });
      } catch (err) {
        console.error("Failed to sync offline item", item, err);
        results.push({ success: false, original: item, error: String(err) });
      }
    }
    return results;
  }

  // ==========================================
  // Inventory Module
  // ==========================================
  public async getCrudList(entity: string): Promise<any[]> {
    const res = await this.request(`/crud/${entity}`);
    const list = res.data || res || [];
    if (entity === "products") {
      return list.map((p: any) => ({
        ...p,
        salePrice: p.salePrice !== undefined ? p.salePrice : Number(p.retailPrice || p.salePrice || 0)
      }));
    }
    return list;
  }

  public async createCrudItem(entity: string, data: any): Promise<any> {
    const res = await this.request(`/crud/${entity}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.data || res;
  }

  public async updateCrudItem(entity: string, id: number, data: any): Promise<any> {
    const res = await this.request(`/crud/${entity}/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return res.data || res;
  }

  public async deleteCrudItem(entity: string, id: number): Promise<any> {
    const res = await this.request(`/crud/${entity}/${id}`, {
      method: "DELETE",
    });
    return res.data || res;
  }

  public async getInventoryLevels(): Promise<any[]> {
    const res = await this.request("/inventory/levels");
    return res.data || res || [];
  }

  public async getInventoryMovements(): Promise<any[]> {
    const res = await this.request("/inventory/movements");
    return res.data || res || [];
  }

  public async adjustStock(productId: number, storeId: number, qty: number, reason: string): Promise<any> {
    const res = await this.request("/inventory/adjust", {
      method: "POST",
      body: JSON.stringify({ productId, storeId, qty, reason }),
    });
    return res.data || res;
  }

  // ==========================================
  // Purchasing Module
  // ==========================================
  public async listVendors(): Promise<any[]> {
    const res = await this.request("/purchasing/vendors");
    return res.data || res || [];
  }

  public async createVendor(vendorData: any): Promise<any> {
    const res = await this.request("/purchasing/vendor", {
      method: "POST",
      body: JSON.stringify(vendorData),
    });
    return res.data || res;
  }

  public async listPurchaseOrders(): Promise<any[]> {
    const res = await this.request("/purchasing/pos");
    return res.data || res || [];
  }

  public async createPurchaseOrder(poData: any): Promise<any> {
    const res = await this.request("/purchasing/po", {
      method: "POST",
      body: JSON.stringify(poData),
    });
    return res.data || res;
  }

  public async approvePurchaseOrder(id: number): Promise<any> {
    const res = await this.request(`/purchasing/po/${id}/approve`, {
      method: "PATCH",
    });
    return res.data || res;
  }

  public async receivePurchaseOrder(id: number, receiptData: any): Promise<any> {
    const res = await this.request(`/purchasing/po/${id}/receive`, {
      method: "POST",
      body: JSON.stringify(receiptData),
    });
    return res.data || res;
  }

  // ==========================================
  // Sales Module
  // ==========================================
  public async listCustomers(): Promise<Customer[]> {
    return this.getCrudList("customers");
  }

  public async registerCustomer(customerData: any): Promise<Customer> {
    const res = await this.request("/customers/register", {
      method: "POST",
      body: JSON.stringify(customerData),
    });
    return res.data || res;
  }

  // ==========================================
  // Accounting Module
  // ==========================================
  public async getChartOfAccounts(): Promise<any[]> {
    const res = await this.request("/accounting/chart-of-accounts");
    return res.data || res || [];
  }

  public async postJournalEntry(entryData: any): Promise<any> {
    const res = await this.request("/accounting/journal-entry", {
      method: "POST",
      body: JSON.stringify(entryData),
    });
    return res.data || res;
  }

  public async getTrialBalance(): Promise<any> {
    const res = await this.request("/accounting/trial-balance");
    return res.data || res;
  }

  public async getGeneralLedger(): Promise<any[]> {
    const res = await this.request("/accounting/general-ledger");
    return res.data || res || [];
  }

  public async getBalanceSheet(): Promise<any> {
    const res = await this.request("/accounting/balance-sheet");
    return res.data || res;
  }

  public async getProfitLoss(): Promise<any> {
    const res = await this.request("/accounting/profit-loss");
    return res.data || res;
  }

  public async getCashFlow(): Promise<any> {
    const res = await this.request("/accounting/cash-flow");
    return res.data || res;
  }

  public async getAccountingPeriods(): Promise<any[]> {
    const res = await this.request("/accounting/periods");
    return res.data || res || [];
  }

  public async closeAccountingPeriod(id: number, closingData: any): Promise<any> {
    const res = await this.request(`/accounting/periods/${id}/close`, {
      method: "POST",
      body: JSON.stringify(closingData),
    });
    return res.data || res;
  }

  // ==========================================
  // Banking Module
  // ==========================================
  public async listBankAccounts(): Promise<any[]> {
    const res = await this.request("/stage5/bank-accounts");
    return res.data || res || [];
  }

  public async createBankAccount(accountData: any): Promise<any> {
    const res = await this.request("/stage5/bank-accounts", {
      method: "POST",
      body: JSON.stringify(accountData),
    });
    return res.data || res;
  }

  public async importBankTransactions(bankAccountId: number, transactions: any[]): Promise<any> {
    const res = await this.request("/stage5/bank-transactions/import", {
      method: "POST",
      body: JSON.stringify({ bankAccountId, transactions }),
    });
    return res.data || res;
  }

  public async matchBankTransaction(bankTransactionId: number, journalEntryId?: number, ledgerId?: number): Promise<any> {
    const res = await this.request("/stage5/bank-transactions/match", {
      method: "POST",
      body: JSON.stringify({ bankTransactionId, journalEntryId, ledgerId }),
    });
    return res.data || res;
  }

  // ==========================================
  // Fixed Assets Module
  // ==========================================
  public async listFixedAssets(companyId: number = 1): Promise<any[]> {
    const res = await this.request(`/fixed-assets/register/${companyId}`);
    return res.data || res || [];
  }

  public async acquireAsset(assetData: any): Promise<any> {
    const res = await this.request("/fixed-assets/acquire", {
      method: "POST",
      body: JSON.stringify(assetData),
    });
    return res.data || res;
  }

  public async runMonthlyDepreciation(params: any): Promise<any> {
    const res = await this.request("/fixed-assets/depreciation", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return res.data || res;
  }

  public async disposeAsset(disposeData: any): Promise<any> {
    const res = await this.request("/fixed-assets/dispose", {
      method: "POST",
      body: JSON.stringify(disposeData),
    });
    return res.data || res;
  }
}

export const api = new ApiClient();
