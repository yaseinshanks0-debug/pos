// src/backend/api/routes.ts

import { Router } from "express";
import { logger, uow } from "./context.ts";

import { TransferOrderService } from "../application/services/transfer-order.service.ts";
import { TransferOrderController } from "./controllers/transfer-order.controller.ts";

import { InventoryService } from "../application/services/inventory.service.ts";
import { InventoryController } from "./controllers/inventory.controller.ts";
import { InventoryCountService } from "../application/services/inventory-count.service.ts";
import { InventoryCountController } from "./controllers/inventory-count.controller.ts";
import { InventoryAdjustmentService } from "../application/services/inventory-adjustment.service.ts";
import { InventoryAdjustmentController } from "./controllers/inventory-adjustment.controller.ts";
import { PurchasingService } from "../application/services/purchasing.service.ts";
import { PurchasingController } from "./controllers/purchasing.controller.ts";

import { AuthService } from "../application/services/auth.service.ts";
import { AuthController } from "./controllers/auth.controller.ts";
import { UserService } from "../application/services/user.service.ts";
import { UserController } from "./controllers/user.controller.ts";
import { authenticateUser, requirePermission } from "./middlewares/auth.middleware.ts";

// POS, Shifts, Customer CRM and Return Modules Imports
import { PosService } from "../application/services/pos.service.ts";
import { PosController } from "./controllers/pos.controller.ts";
import { ShiftService } from "../application/services/shift.service.ts";
import { ShiftController } from "./controllers/shift.controller.ts";
import { CustomerService } from "../application/services/customer.service.ts";
import { CustomerController } from "./controllers/customer.controller.ts";
import { ReturnService } from "../application/services/return.service.ts";
import { ReturnController } from "./controllers/return.controller.ts";
import { SyncService } from "../application/services/sync.service.ts";
import { OfflineSyncService } from "../application/services/offline-sync.service.ts";
import { SyncController } from "./controllers/sync.controller.ts";
import { ReportingService } from "../application/services/reporting.service.ts";
import { ReportingController } from "./controllers/reporting.controller.ts";
import { AccountingService } from "../application/services/accounting.service.ts";
import { AccountingController } from "./controllers/accounting.controller.ts";
import { Stage5Service } from "../application/services/stage5.service.ts";
import { Stage5Controller } from "./controllers/stage5.controller.ts";
import { Stage5_2Service } from "../application/services/stage5_2.service.ts";
import { Stage5_2Controller } from "./controllers/stage5_2.controller.ts";
import { FixedAssetService } from "../application/services/fixed-asset.service.ts";
import { FixedAssetController } from "./controllers/fixed-asset.controller.ts";

import { BaseService } from "../application/services/base.service.ts";
import { BaseController } from "./controllers/base.controller.ts";
import { TableRegistry } from "../infrastructure/repositories/drizzle.repository.ts";
import { errorHandlerMiddleware } from "./middlewares/error-handler.middleware.ts";

const router = Router();

// ==========================================
// 1. Dependency Injection Configuration
// ==========================================

// Specialized workflows
const accountingService = new AccountingService(uow, logger);
const accountingController = new AccountingController(accountingService);
const stage5Service = new Stage5Service(uow, logger, accountingService);
const stage5Controller = new Stage5Controller(stage5Service);
const stage5_2Service = new Stage5_2Service(uow, logger, accountingService);
const stage5_2Controller = new Stage5_2Controller(stage5_2Service);
const fixedAssetService = new FixedAssetService(uow, logger, accountingService);
const fixedAssetController = new FixedAssetController(fixedAssetService);
const transferOrderService = new TransferOrderService(uow, logger);
const transferOrderController = new TransferOrderController(transferOrderService);

const inventoryService = new InventoryService(uow, logger);
const inventoryController = new InventoryController(inventoryService);

const inventoryCountService = new InventoryCountService(uow, logger);
const inventoryCountController = new InventoryCountController(inventoryCountService);

const inventoryAdjustmentService = new InventoryAdjustmentService(uow, logger);
const inventoryAdjustmentController = new InventoryAdjustmentController(inventoryAdjustmentService);

const purchasingService = new PurchasingService(uow, logger);
const purchasingController = new PurchasingController(purchasingService);

// Authentication & Users System
const authService = new AuthService(uow, logger);
const authController = new AuthController(authService);
const userService = new UserService(uow, logger);
const userController = new UserController(userService);

// POS Engine service layer setup
const posService = new PosService(uow, logger);
const posController = new PosController(posService);

const shiftService = new ShiftService(uow, logger);
const shiftController = new ShiftController(shiftService);

const customerService = new CustomerService(uow, logger);
const customerController = new CustomerController(customerService);

const returnService = new ReturnService(uow, logger);
const returnController = new ReturnController(returnService);

const syncService = new SyncService(uow, logger);
const offlineSyncService = new OfflineSyncService(uow, logger);
const syncController = new SyncController(syncService, offlineSyncService);

const reportingService = new ReportingService(uow, logger);
const reportingController = new ReportingController(reportingService);

// ==========================================
// 1.5 Register Authentication & RBAC User Endpoints
// ==========================================
logger.info("Registering authentication & role authorization endpoints...");

// Auth Endpoints
router.post("/auth/login", authController.login);
router.post("/auth/refresh", authController.refresh);
router.post("/auth/logout", authenticateUser, authController.logout);
router.post("/auth/reset-password-request", authController.requestPasswordReset);
router.post("/auth/reset-password", authController.resetPassword);

// User Management Endpoints (protected by JWT authentication and "manage_users" granular permission)
router.get("/users", authenticateUser, requirePermission("manage_users"), userController.getAllUsers);
router.get("/users/:id", authenticateUser, requirePermission("manage_users"), userController.getUserById);
router.post("/users", authenticateUser, requirePermission("manage_users"), userController.createUser);
router.put("/users/:id", authenticateUser, requirePermission("manage_users"), userController.updateUser);
router.delete("/users/:id", authenticateUser, requirePermission("manage_users"), userController.deleteUser);

// ==========================================
// 2. Register Specialized Custom Workflows
// ==========================================
logger.info("Registering specialized workflow routes for Transfer Orders, Inventory and Purchasing...");

// Transfer Orders Module
router.post("/transfer-orders/workflow", transferOrderController.create);
router.patch("/transfer-orders/workflow/:id/approve", transferOrderController.approve);
router.patch("/transfer-orders/workflow/:id/ship", transferOrderController.ship);
router.post("/transfer-orders/workflow/:id/receive", transferOrderController.receive);
router.patch("/transfer-orders/workflow/:id/cancel", transferOrderController.cancel);

// Inventory Module
router.post("/inventory/product", inventoryController.createProduct);
router.put("/inventory/product/:id", inventoryController.updateProduct);
router.delete("/inventory/product/:id", inventoryController.deleteProduct);
router.post("/inventory/variant", inventoryController.createVariant);
router.put("/inventory/variant/:id", inventoryController.updateVariant);
router.post("/inventory/category", inventoryController.createCategory);
router.post("/inventory/department", inventoryController.createDepartment);
router.post("/inventory/adjust", inventoryController.adjustStock);
router.get("/inventory/levels", inventoryController.getInventoryLevels);
router.get("/inventory/movements", inventoryController.getInventoryMovements);
router.get("/inventory/reorder-check", inventoryController.checkReorderPoints);
router.post("/inventory/snapshot", inventoryController.takeSnapshot);
router.get("/inventory/snapshots", inventoryController.getSnapshots);

// Count Sessions Routes
router.post("/inventory/counts/start", inventoryCountController.startCountSession);
router.post("/inventory/counts/:id/submit", inventoryCountController.submitCounts);
router.patch("/inventory/counts/:id/approve", inventoryCountController.approveCountSession);
router.patch("/inventory/counts/:id/cancel", inventoryCountController.cancelCountSession);

// Adjustments Routes
router.post("/inventory/adjustments/create", inventoryAdjustmentController.createAdjustment);
router.patch("/inventory/adjustments/:id/post", inventoryAdjustmentController.postAdjustment);
router.patch("/inventory/adjustments/:id/cancel", inventoryAdjustmentController.cancelAdjustment);

// Purchasing Module
router.post("/purchasing/vendor", purchasingController.createVendor);
router.put("/purchasing/vendor/:id", purchasingController.updateVendor);
router.get("/purchasing/vendor/:id", purchasingController.getVendor);
router.get("/purchasing/vendors", purchasingController.listVendors);
router.post("/purchasing/vendor/credit", purchasingController.recordVendorCredit);
router.post("/purchasing/po", purchasingController.createPurchaseOrder);
router.patch("/purchasing/po/:id/submit", purchasingController.submitPO);
router.patch("/purchasing/po/:id/approve", purchasingController.approvePO);
router.patch("/purchasing/po/:id/send", purchasingController.markSentPO);
router.post("/purchasing/po/:id/receive", purchasingController.receivePO);
router.get("/purchasing/po/:id", purchasingController.getPurchaseOrderDetails);
router.get("/purchasing/pos", purchasingController.listPurchaseOrders);

// ==========================================
// 2.5 POS Core & Checkout Routes
// ==========================================
// Product scanning & lookup
router.get("/pos/lookup/:barcodeOrSku", posController.productLookup);
router.get("/pos/search", posController.searchProducts);
// Estimate taxes / subtotals
router.post("/pos/calculate", posController.calculateCheckout);
// Submit Checkout sale
router.post("/pos/checkout", posController.checkout);

// ==========================================
// 2.6 Cash Drawer & Shifts Routes
// ==========================================
// Terminal registers status & list
router.get("/shifts/drawers", shiftController.listDrawers);
router.post("/shifts/drawers/create", shiftController.createDrawer);
router.get("/shifts/drawers/:id", shiftController.getDrawerStatus);
router.get("/shifts/drawers/:drawerId/active", shiftController.getActiveShiftForDrawer);
// Shift workflows
router.post("/shifts/open", shiftController.openShift);
router.post("/shifts/close/:id", shiftController.closeShift);

// ==========================================
// 2.7 Customer CRM & Loyalty Routes
// ==========================================
router.post("/customers/register", customerController.createCustomer);
router.get("/customers/lookup", customerController.lookupCustomer);
router.get("/customers/gift-cards/:cardNumber", customerController.lookupGiftCard);
router.get("/customers/:id", customerController.getCustomerById);
router.post("/customers/:id/adjust-store-credit", customerController.adjustStoreCredit);

// ==========================================
// 2.8 Sales Returns & Exchange Routes
// ==========================================
router.post("/returns/process", returnController.processReturn);
router.post("/returns/exchange", returnController.processExchange);

// ==========================================
// 2.9 Multi-Store Synchronization Routes
// ==========================================
router.post("/sync/store", syncController.syncStoreData);
router.get("/sync/store/:storeId/updates", syncController.fetchStoreUpdates);
router.get("/sync/conflicts", syncController.getPendingConflicts);
router.get("/sync/conflicts/:id", syncController.getConflictById);
router.post("/sync/conflicts/:id/resolve", syncController.resolveConflict);
router.get("/sync/health", syncController.getSyncHealthMetrics);
router.post("/sync/retry-worker", syncController.runRetryWorker);

// Stage 3 Specific Offline POS, Exchange Batches & Synchronization Audits
router.post("/sync/queue/enqueue", syncController.enqueueOfflineTransaction);
router.get("/sync/queue/:storeId", syncController.getOfflineQueue);
router.post("/sync/batches/create", syncController.createExchangeBatch);
router.post("/sync/batches/:id/process", syncController.processExchangeBatch);
router.post("/sync/:storeId/synchronize", syncController.synchronizeStore);
router.get("/sync/stage3/conflicts", syncController.getStage3Conflicts);
router.post("/sync/stage3/conflicts/resolve", syncController.resolveStage3Conflict);
router.post("/sync/:storeId/reconcile", syncController.reconcileMultiStoreState);

// ==========================================
// 2.10 Reporting & Analytics Engine Routes
// ==========================================
router.get("/reports/sales", reportingController.getSalesReport);
router.get("/reports/inventory", reportingController.getInventoryReport);
router.get("/reports/inventory/low-stock", reportingController.getLowStockReport);
router.get("/reports/inventory/dead-stock", reportingController.getDeadStockReport);
router.get("/reports/inventory/movements", reportingController.getInventoryMovements);
router.get("/reports/financials", reportingController.getFinancialReport);
router.get("/reports/customers", reportingController.getCustomerReportsSummary);
router.get("/reports/stores/comparison", reportingController.getHQBranchComparisonReport);
router.get("/reports/export/excel", reportingController.exportReportToExcel);
router.get("/reports/export/pdf", reportingController.exportReportToPDF);

// STAGE 6 - NEW Analytics API Endpoints
router.get("/reports/dashboard", reportingController.getDashboardData);
router.get("/reports/kpis", reportingController.getKpiReport);
router.get("/reports/financials/full", reportingController.getFullFinancialReports);
router.get("/reports/inventory/analytics", reportingController.getInventoryAnalytics);
router.get("/reports/sales/analytics", reportingController.getSalesAnalytics);
router.get("/reports/ar/analytics", reportingController.getArAnalytics);
router.get("/reports/ap/analytics", reportingController.getApAnalytics);
router.get("/reports/fixed-assets/analytics", reportingController.getFixedAssetAnalytics);

// Saved Reports Management Endpoints
router.post("/reports/saved", reportingController.createSavedReport);
router.get("/reports/saved", reportingController.listSavedReports);
router.get("/reports/saved/:id", reportingController.getSavedReport);
router.delete("/reports/saved/:id", reportingController.deleteSavedReport);

// ==========================================
// 2.11 Accounting Engine Routes
// ==========================================
router.post("/accounting/journal-entry", accountingController.postJournalEntry);
router.get("/accounting/chart-of-accounts", accountingController.getChartOfAccounts);
router.get("/accounting/trial-balance", accountingController.getTrialBalance);
router.get("/accounting/general-ledger", accountingController.getGeneralLedger);
router.get("/accounting/balance-sheet", accountingController.getBalanceSheet);
router.get("/accounting/profit-loss", accountingController.getProfitAndLoss);
router.get("/accounting/cash-flow", accountingController.getCashFlowStatement);

// Stage 4 Fiscal Calendars, Period Closures, & Auditing Endpoints
router.post("/accounting/fiscal-years", accountingController.createFiscalYear);
router.get("/accounting/fiscal-years", accountingController.getFiscalYears);
router.get("/accounting/periods", accountingController.getAccountingPeriods);
router.put("/accounting/periods/:id/status", accountingController.updatePeriodStatus);
router.post("/accounting/periods/:id/close", accountingController.closeAccountingPeriod);
router.post("/accounting/fiscal-years/:id/close", accountingController.closeFiscalYear);
router.get("/accounting/lock-audit-logs", accountingController.getPeriodLockAuditLogs);
router.get("/accounting/close-runs", accountingController.getFiscalCloseRuns);

// Stage 5 Accounts Payable, Accounts Receivable, and Bank Reconciliation Endpoints
router.post("/stage5/bank-accounts", stage5Controller.createBankAccount);
router.get("/stage5/bank-accounts", stage5Controller.listBankAccounts);
router.get("/stage5/bank-accounts/:id", stage5Controller.getBankAccount);

router.post("/stage5/vendor-invoices", stage5Controller.createVendorInvoice);
router.post("/stage5/vendor-invoices/:id/post", stage5Controller.postVendorInvoice);
router.post("/stage5/vendor-payments", stage5Controller.payVendorInvoice);
router.post("/stage5/vendor-payments/:id/reverse", stage5Controller.reverseVendorPayment);
router.get("/stage5/vendor-aging/:companyId", stage5Controller.getVendorAging);

router.post("/stage5/customer-invoices", stage5Controller.createCustomerInvoice);
router.post("/stage5/customer-invoices/:id/post", stage5Controller.postCustomerInvoice);
router.post("/stage5/customer-receipts", stage5Controller.receiveCustomerPayment);
router.post("/stage5/customer-receipts/:id/reverse", stage5Controller.reverseCustomerReceipt);
router.get("/stage5/customer-aging/:companyId", stage5Controller.getCustomerAging);

router.post("/stage5/credit-notes", stage5Controller.createCreditNote);
router.post("/stage5/credit-notes/:id/post", stage5Controller.postCreditNote);
router.post("/stage5/credit-notes/:id/apply", stage5Controller.applyCreditNote);

router.post("/stage5/bank-transactions/import", stage5Controller.importBankTransactions);
router.post("/stage5/bank-transactions/match", stage5Controller.matchBankTransaction);
router.post("/stage5/bank-transactions/adjust", stage5Controller.postReconciliationAdjustment);
router.post("/stage5/reconcile", stage5Controller.reconcileBankAccount);

// ==========================================
// STAGE 5.2 ADVANCED FINANCE ENDPOINTS
// ==========================================
router.post("/stage5_2/currencies", stage5_2Controller.createCurrency);
router.post("/stage5_2/exchange-rates", stage5_2Controller.setExchangeRate);
router.post("/stage5_2/revalue", stage5_2Controller.postUnrealizedRevaluation);

router.post("/stage5_2/cash-transfers", stage5_2Controller.transferCash);
router.post("/stage5_2/cash-transactions", stage5_2Controller.pettyCashTransaction);
router.get("/stage5_2/cash-position/:companyId", stage5_2Controller.getCashPosition);

router.post("/stage5_2/budgets", stage5_2Controller.createBudget);
router.post("/stage5_2/budgets/:id/revise", stage5_2Controller.reviseBudget);
router.get("/stage5_2/budgets/vs-actual", stage5_2Controller.getBudgetVsActual);

router.get("/stage5_2/reports/balance-sheet/:companyId", stage5_2Controller.getBalanceSheet);
router.get("/stage5_2/reports/income-statement/:companyId", stage5_2Controller.getIncomeStatement);
router.get("/stage5_2/reports/cash-flow/:companyId", stage5_2Controller.getCashFlowStatement);
router.get("/stage5_2/reports/general-ledger/:companyId", stage5_2Controller.getGeneralLedgerReport);
router.get("/stage5_2/reports/ap-aging/:companyId", stage5_2Controller.getApAgingReport);
router.get("/stage5_2/reports/ar-aging/:companyId", stage5_2Controller.getArAgingReport);


// ==========================================
// STAGE 5.3 FIXED ASSETS REGISTER ENDPOINTS
// ==========================================
router.post("/fixed-assets/categories", fixedAssetController.createCategory);
router.get("/fixed-assets/categories", fixedAssetController.getCategories);
router.post("/fixed-assets/acquire", fixedAssetController.acquireAsset);
router.post("/fixed-assets/depreciation", fixedAssetController.runMonthlyDepreciation);
router.post("/fixed-assets/dispose", fixedAssetController.disposeAsset);
router.post("/fixed-assets/transfer", fixedAssetController.transferAsset);
router.post("/fixed-assets/impair", fixedAssetController.impairAsset);
router.post("/fixed-assets/revalue", fixedAssetController.revalueAsset);

router.get("/fixed-assets/register/:companyId", fixedAssetController.getAssetRegister);
router.get("/fixed-assets/depreciation-schedule/:companyId", fixedAssetController.getDepreciationSchedule);
router.get("/fixed-assets/movements/:companyId", fixedAssetController.getAssetMovementReport);
router.get("/fixed-assets/disposals/:companyId", fixedAssetController.getAssetDisposalReport);
router.get("/fixed-assets/audit-trail/:companyId", fixedAssetController.getAssetAuditTrail);


// ==========================================
// 3. Register Generic CRUD for All 44 Entities
// ==========================================
logger.info("Dynamically mapping standard CRUD endpoints for all 44 entities...");

Object.keys(TableRegistry).forEach((entityName) => {
  // Translate camelCase key to URL-friendly hyphen/kebab-case or just lower-case
  // We can use lower-case representing exact entity keys. e.g. /api/crud/companies
  const routePath = `/crud/${entityName}`;

  const repository = uow.getRepository<any>(entityName);
  const service = new BaseService<any>(repository, logger, entityName);
  const controller = new BaseController<any>(service, entityName);

  // Bind Standard REST routes
  router.get(`${routePath}`, controller.getAll);
  router.get(`${routePath}/:id`, controller.getById);
  router.post(`${routePath}`, controller.create);
  router.put(`${routePath}/:id`, controller.update);
  router.delete(`${routePath}/:id`, controller.delete);

  logger.debug(`Mapped CRUD route: ${routePath} -> [GET, GET:id, POST, PUT, DELETE]`);
});

// ==========================================
// 4. API Health Check
// ==========================================
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "Healthy",
    message: "Enterprise Clean Architecture Backend is online and operations-ready.",
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// 5. Global Error Interceptor Boundary
// ==========================================
router.use(errorHandlerMiddleware);

export { router };
export { uow, logger, transferOrderService };
