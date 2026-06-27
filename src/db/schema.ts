import { integer, pgTable, serial, text, timestamp, numeric, boolean, primaryKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// 1. Companies (Multi-Tenant Root)
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  domain: text("domain"),
  status: text("status").notNull().default("active"), // active, suspended, closed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 2. Stores (HQ or Branches)
export const stores = pgTable("stores", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(), // e.g., 'ST001', 'HQ'
  type: text("type").notNull().default("branch"), // 'hq', 'branch'
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 3. Warehouses (Storage areas linked to Stores)
export const warehouses = pgTable("warehouses", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id")
    .references(() => stores.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(), // e.g., 'WH001'
  address: text("address"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 4. Roles (System-wide roles)
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // 'super_admin', 'hq_admin', 'store_manager', 'cashier'
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 5. Permissions (System-wide access controls)
export const permissions = pgTable("permissions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // 'manage_inventory', 'process_sales', 'view_costs'
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 6. Role Permissions (Join Table for many-to-many relationship)
export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: integer("role_id")
      .references(() => roles.id, { onDelete: "cascade" })
      .notNull(),
    permissionId: integer("permission_id")
      .references(() => permissions.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.roleId, t.permissionId] }),
  ]
);

// 7. Users (Firebase authenticated profiles linked to stores & tenants)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(), // Firebase Auth standard UID
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  passwordHash: text("password_hash"), // Local login password-hash Support
  failedLoginAttempts: integer("failed_login_attempts").default(0).notNull(), // Lockout protective auditing
  lockoutUntil: timestamp("lockout_until"), // Lockout duration timestamp
  passwordResetToken: text("password_reset_token"), // Password reset token flow
  passwordResetExpires: timestamp("password_reset_expires"), // Token expiration timestamp
  roleId: integer("role_id")
    .references(() => roles.id)
    .notNull(),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  storeId: integer("store_id") // HQ Admins / Super Admins can have Null storeId to represent central oversight
    .references(() => stores.id),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 8. Employees (Staff detailed ledger for Shifts & Commissions)
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "set null" }), // Connection to app user if they log in
  storeId: integer("store_id")
    .references(() => stores.id, { onDelete: "cascade" })
    .notNull(),
  employeeCode: text("employee_code").notNull().unique(),
  name: text("name").notNull(),
  contactNo: text("contact_no"),
  address: text("address"),
  role: text("role").notNull(), // text label replica for cashier/manager
  commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }).default("0.00").notNull(), // Percentage rate
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 9. Customer Groups (VIP, Wholesale, Retail, etc.)
export const customerGroups = pgTable("customer_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  discountPercentage: numeric("discount_percentage", { precision: 5, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 10. Customers (Retail database & balances)
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  mobileNumber: text("mobile_number").notNull().unique(),
  email: text("email"),
  address: text("address"),
  birthDate: timestamp("birth_date"),
  customerGroupId: integer("customer_group_id")
    .references(() => customerGroups.id),
  loyaltyPoints: integer("loyalty_points").default(0).notNull(),
  balance: numeric("balance", { precision: 12, scale: 2 }).default("0.00").notNull(), // Outstanding accounts receivable
  storeCredit: numeric("store_credit", { precision: 12, scale: 2 }).default("0.00").notNull(), // Dynamic refunds credits
  creditLimit: numeric("credit_limit", { precision: 12, scale: 2 }).default("0.00").notNull(),
  creditHold: boolean("credit_hold").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 11. Vendors (Supplier Profiles with payment terms)
export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  paymentTerms: text("payment_terms").notNull().default("cash"), // cash, net30, net60 etc.
  creditLimit: numeric("credit_limit", { precision: 12, scale: 2 }).default("0.00").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 12. Categories (Product catalog categories)
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  parentId: integer("parent_id"), // Self reference for nesting
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 13. Departments (Business division categories)
export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 14. Tax Rules / Categories
export const taxRules = pgTable("tax_rules", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  rate: numeric("rate", { precision: 5, scale: 2 }).notNull(), // e.g. 20.00 for VAT
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 15. Products (Product Master listing)
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  sku: text("sku").notNull().unique(),
  barcode: text("barcode").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  categoryId: integer("category_id")
    .references(() => categories.id, { onDelete: "set null" }),
  departmentId: integer("department_id")
    .references(() => departments.id, { onDelete: "set null" }),
  brand: text("brand"),
  costPrice: numeric("cost_price", { precision: 12, scale: 2 }).notNull(),
  retailPrice: numeric("retail_price", { precision: 12, scale: 2 }).notNull(),
  taxCategoryId: integer("tax_category_id")
    .references(() => taxRules.id),
  reorderPoint: integer("reorder_point").default(5).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 16. Product Variants (Matrix elements for colors, sizes, etc.)
export const productVariants = pgTable("product_variants", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  sku: text("sku").notNull().unique(),
  barcode: text("barcode").notNull().unique(),
  variantName: text("variant_name").notNull(), // e.g., 'Red / M'
  size: text("size"),
  color: text("color"),
  material: text("material"),
  costPrice: numeric("cost_price", { precision: 12, scale: 2 }), // overrides base cost if present
  retailPrice: numeric("retail_price", { precision: 12, scale: 2 }), // overrides base retail if present
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 17. Inventory (Stock levels per warehouse, mapped to products/variants)
export const inventory = pgTable("inventory", {
  id: serial("id").primaryKey(),
  warehouseId: integer("warehouse_id")
    .references(() => warehouses.id, { onDelete: "cascade" })
    .notNull(),
  productId: integer("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  variantId: integer("variant_id")
    .references(() => productVariants.id, { onDelete: "cascade" }), // nullable if product has no variants
  quantity: integer("quantity").default(0).notNull(),
  reorderLevel: integer("reorder_level").default(5).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 18. Inventory Movements (Audit logs & ledgers for variations)
export const inventoryMovements = pgTable("inventory_movements", {
  id: serial("id").primaryKey(),
  inventoryId: integer("inventory_id")
    .references(() => inventory.id, { onDelete: "cascade" })
    .notNull(),
  type: text("type").notNull(), // 'in', 'out', 'transfer_in', 'transfer_out', 'adjustment', 'sale', 'receiving'
  quantity: integer("quantity").notNull(), // can be negative for reductions, or positive for gains
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull(),
  reasonCode: text("reason_code"), // 'damaged', 'theft', 'audit_discrepancy'
  referenceType: text("reference_type"), // 'sale', 'purchase_order', 'transfer_order', 'manual_adjustment'
  referenceId: integer("reference_id"), // links to specific table rows based on referenceType
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "set null" }), // Cashier or stock officer in charge
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 19. Purchase Orders (PO Master - HQ / Branch replenishment workflow)
export const purchaseOrders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  poNumber: text("po_number").notNull().unique(), // e.g. PO-00042
  vendorId: integer("vendor_id")
    .references(() => vendors.id, { onDelete: "restrict" })
    .notNull(),
  storeId: integer("store_id") // Receiving branch store
    .references(() => stores.id, { onDelete: "cascade" })
    .notNull(),
  status: text("status").notNull().default("draft"), // 'draft', 'submitted', 'approved', 'sent', 'received', 'closed'
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 20. Purchase Order Items (Quantities ordered versus received)
export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: serial("id").primaryKey(),
  purchaseOrderId: integer("purchase_order_id")
    .references(() => purchaseOrders.id, { onDelete: "cascade" })
    .notNull(),
  productId: integer("product_id")
    .references(() => products.id)
    .notNull(),
  variantId: integer("variant_id")
    .references(() => productVariants.id),
  orderedQty: integer("ordered_qty").notNull(),
  receivedQty: integer("received_qty").default(0).notNull(),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull(),
});

// 21. Transfer Orders (Replenishing other branch stores)
export const transferOrders = pgTable("transfer_orders", {
  id: serial("id").primaryKey(),
  transferNumber: text("transfer_number").notNull().unique(), // e.g. TR-1002
  sourceStoreId: integer("source_store_id")
    .references(() => stores.id)
    .notNull(),
  sourceWarehouseId: integer("source_warehouse_id")
    .references(() => warehouses.id)
    .notNull(),
  destinationStoreId: integer("destination_store_id")
    .references(() => stores.id)
    .notNull(),
  destinationWarehouseId: integer("destination_warehouse_id")
    .references(() => warehouses.id)
    .notNull(),
  status: text("status").notNull().default("draft"), // 'draft', 'approved', 'in_transit', 'partially_received', 'received', 'cancelled'
  notes: text("notes"),
  
  // Audit Trail
  createdByUserId: integer("created_by_user_id")
    .references(() => users.id),
  approvedByUserId: integer("approved_by_user_id")
    .references(() => users.id),
  receivedByUserId: integer("received_by_user_id")
    .references(() => users.id),

  // Workflow Timestamps
  approvedAt: timestamp("approved_at"),
  shippedAt: timestamp("shipped_at"),
  receivedAt: timestamp("received_at"),

  // Offline Sync
  version: integer("version").default(1).notNull(),
  syncVersion: integer("sync_version").default(1).notNull(),

  // External Integrations
  externalReference: text("external_reference"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 22. Transfer Order Items (Quantities shipped versus received)
export const transferOrderItems = pgTable("transfer_order_items", {
  id: serial("id").primaryKey(),
  transferOrderId: integer("transfer_order_id")
    .references(() => transferOrders.id, { onDelete: "cascade" })
    .notNull(),
  productId: integer("product_id")
    .references(() => products.id)
    .notNull(),
  variantId: integer("variant_id")
    .references(() => productVariants.id),
  shippedQty: integer("shipped_qty").notNull(),
  receivedQty: integer("received_qty").default(0).notNull(),
});

// 23. Cash Drawers (Terminal physical setups)
export const cashDrawers = pgTable("cash_drawers", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id")
    .references(() => stores.id, { onDelete: "cascade" })
    .notNull(),
  drawerName: text("drawer_name").notNull(), // Register 1, POS A
  status: text("status").notNull().default("closed"), // 'open', 'closed'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 24. Shifts (Register workflows with variance reports)
export const shifts = pgTable("shifts", {
  id: serial("id").primaryKey(),
  cashDrawerId: integer("cash_drawer_id")
    .references(() => cashDrawers.id, { onDelete: "cascade" })
    .notNull(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  openingTime: timestamp("opening_time").defaultNow().notNull(),
  closingTime: timestamp("closing_time"),
  openingCash: numeric("opening_cash", { precision: 12, scale: 2 }).notNull(),
  expectedCash: numeric("expected_cash", { precision: 12, scale: 2 }).default("0.00").notNull(),
  actualCash: numeric("actual_cash", { precision: 12, scale: 2 }),
  variance: numeric("variance", { precision: 12, scale: 2 }),
  status: text("status").notNull().default("open"), // 'open', 'closed'
});

// 25. Sales (checkout transactions)
export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(), // e.g., INV-POS-00382
  storeId: integer("store_id")
    .references(() => stores.id, { onDelete: "cascade" })
    .notNull(),
  customerId: integer("customer_id")
    .references(() => customers.id),
  cashierId: integer("cashier_id") // links to users.id
    .references(() => users.id)
    .notNull(),
  shiftId: integer("shift_id")
    .references(() => shifts.id),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  paymentStatus: text("payment_status").notNull().default("paid"), // 'paid', 'refunded', 'partial', 'unpaid'
  syncStatus: text("sync_status").notNull().default("synced"), // 'synced', 'pending' (offline sales)
  offlineCreatedAt: timestamp("offline_created_at"), // set if created when offline, to keep physical stamp correct
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 26. Sale Items (Transaction details)
export const saleItems = pgTable("sale_items", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id")
    .references(() => sales.id, { onDelete: "cascade" })
    .notNull(),
  productId: integer("product_id")
    .references(() => products.id)
    .notNull(),
  variantId: integer("variant_id")
    .references(() => productVariants.id),
  qty: integer("qty").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  costPrice: numeric("cost_price", { precision: 12, scale: 2 }).notNull(), // keeps historical record for margins
  discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).default("0.00").notNull(),
});

// 27. Payments (Tracking checkout payment splits)
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id")
    .references(() => sales.id, { onDelete: "cascade" }), // nullable if payment is generic (e.g. advance, vendor credit)
  paymentMethod: text("payment_method").notNull(), // 'cash', 'credit_card', 'debit_card', 'mobile_wallet', 'store_credit'
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  transactionRef: text("transaction_ref"), // e.g. terminal auth code, check number
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 28. Invoices (Billing entries, generated alongside sale or vendor transaction)
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id")
    .references(() => sales.id, { onDelete: "cascade" }),
  invoiceNumber: text("invoice_number").notNull().unique(),
  dueDate: timestamp("due_date"),
  status: text("status").notNull().default("unpaid"), // 'unpaid', 'paid', 'overdue', 'cancelled'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 29. Receipts (Printed / Dynamic distribution details)
export const receipts = pgTable("receipts", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id")
    .references(() => sales.id, { onDelete: "cascade" })
    .notNull(),
  receiptNumber: text("receipt_number").notNull().unique(),
  type: text("type").notNull().default("print"), // 'print', 'email', 'sms', 'whatsapp'
  sentTo: text("sent_to"), // Email address or cell phone number
  status: text("status").notNull().default("pending"), // 'pending', 'sent', 'failed'
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 30. Loyalty Transactions (Sub-balances records for program)
export const loyaltyTransactions = pgTable("loyalty_transactions", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id")
    .references(() => customers.id, { onDelete: "cascade" })
    .notNull(),
  saleId: integer("sale_id")
    .references(() => sales.id, { onDelete: "set null" }),
  pointsEarned: integer("points_earned").default(0).notNull(),
  pointsRedeemed: integer("points_redeemed").default(0).notNull(),
  transactionType: text("transaction_type").notNull(), // 'earn', 'redeem', 'refund'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 31. Store Exchange Logs (Synchronizing branch/HQ state queues)
export const storeExchangeLogs = pgTable("store_exchange_logs", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id")
    .references(() => stores.id, { onDelete: "cascade" })
    .notNull(),
  entityType: text("entity_type").notNull(), // 'product', 'sale', 'transfer', 'customer'
  entityId: integer("entity_id").notNull(), // ID inside the respective table
  actionType: text("action_type").notNull(), // 'create', 'update', 'delete'
  syncStatus: text("sync_status").notNull().default("pending"), // 'pending', 'success', 'failed'
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// 32. Audit Logs (Enterprise operation stampings)
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "set null" }),
  device: text("device"), // User agent or mobile MAC address details
  action: text("action").notNull(), // e.g. SALES_REFUNDED, CODES_MODIFIED, PO_APPROVED
  tableName: text("table_name").notNull(),
  recordId: integer("record_id").notNull(),
  beforeValue: text("before_value"), // serialized JSON representation
  afterValue: text("after_value"), // serialized JSON representation
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// 33. Notifications (Dynamic alerts for low levels/PO reviews)
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" }), // Specific targeted staff, or Null for public broadcast
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull().default("info"), // 'info', 'warning', 'error', 'success'
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 34. Settings (Store-wise business preferences)
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id") // If Null, represents global tenant settings
    .references(() => stores.id, { onDelete: "cascade" }),
  key: text("key").notNull(), // e.g. 'loyalty_rule_points', 'ticket_footer'
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 35. General Ledger Entries (Traditional Accounting compliance ledger)
export const generalLedgerEntries = pgTable("general_ledger_entries", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  storeId: integer("store_id")
    .references(() => stores.id),
  accountType: text("account_type").notNull(), // 'assets', 'liabilities', 'equity', 'revenue', 'expenses'
  accountCode: text("account_code").default("").notNull(), // e.g., '1010' for cash
  accountName: text("account_name").default("").notNull(), // e.g., 'Cash'
  description: text("description"), // detail of the transaction
  debit: numeric("debit", { precision: 12, scale: 2 }).default("0.00").notNull(),
  credit: numeric("credit", { precision: 12, scale: 2 }).default("0.00").notNull(),
  referenceType: text("reference_type"), // 'sale', 'receiving', 'payout', 'return', 'inventory_adjustment', 'store_credit', 'gift_card', 'transfer'
  referenceId: integer("reference_id"),
  currencyCode: text("currency_code").default("USD").notNull(),
  exchangeRate: numeric("exchange_rate", { precision: 12, scale: 6 }).default("1.000000").notNull(),
  currencyAmount: numeric("currency_amount", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 36. Attachments (Reference receipts, supplier contract files)
export const attachments = pgTable("attachments", {
  id: serial("id").primaryKey(),
  referenceType: text("reference_type").notNull(), // 'purchase_order', 'sales', 'vendors'
  referenceId: integer("reference_id").notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 37. Returns (or Sales Returns)
export const salesReturns = pgTable("sales_returns", {
  id: serial("id").primaryKey(),
  returnNumber: text("return_number").notNull().unique(), // e.g. RET-0001
  saleId: integer("sale_id")
    .references(() => sales.id, { onDelete: "set null" }),
  storeId: integer("store_id")
    .references(() => stores.id, { onDelete: "cascade" })
    .notNull(),
  customerId: integer("customer_id")
    .references(() => customers.id, { onDelete: "set null" }),
  cashierId: integer("cashier_id")
    .references(() => users.id)
    .notNull(),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  refundAmount: numeric("refund_amount", { precision: 12, scale: 2 }).notNull(),
  refundMethod: text("refund_method").notNull(), // 'cash', 'credit_card', 'store_credit', 'gift_card'
  status: text("status").notNull().default("completed"), // 'draft', 'completed', 'cancelled'
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 38. Return Items
export const returnItems = pgTable("return_items", {
  id: serial("id").primaryKey(),
  returnId: integer("return_id")
    .references(() => salesReturns.id, { onDelete: "cascade" })
    .notNull(),
  saleItemId: integer("sale_item_id")
    .references(() => saleItems.id, { onDelete: "set null" }),
  productId: integer("product_id")
    .references(() => products.id)
    .notNull(),
  variantId: integer("variant_id")
    .references(() => productVariants.id),
  qty: integer("qty").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  refundAmount: numeric("refund_amount", { precision: 12, scale: 2 }).notNull(),
  restocked: boolean("restocked").default(false).notNull(),
  reasonCode: text("reason_code"), // 'damaged', 'defective', 'customer_dislike', 'wrong_item'
});

// 39. Exchanges
export const exchanges = pgTable("exchanges", {
  id: serial("id").primaryKey(),
  exchangeNumber: text("exchange_number").notNull().unique(), // e.g. EX-0001
  storeId: integer("store_id")
    .references(() => stores.id, { onDelete: "cascade" })
    .notNull(),
  customerId: integer("customer_id")
    .references(() => customers.id, { onDelete: "set null" }),
  cashierId: integer("cashier_id")
    .references(() => users.id)
    .notNull(),
  returnId: integer("return_id")
    .references(() => salesReturns.id)
    .notNull(),
  newSaleId: integer("new_sale_id")
    .references(() => sales.id)
    .notNull(),
  differenceAmount: numeric("difference_amount", { precision: 12, scale: 2 }).notNull(), // positive if customer paid more, negative if refunded/store credited
  paymentStatus: text("payment_status").notNull().default("even_exchange"), // 'paid', 'refunded', 'even_exchange'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 40. Store Credit Transactions (detailed ledger for audit and sync of store_credit values)
export const storeCreditTransactions = pgTable("store_credit_transactions", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id")
    .references(() => customers.id, { onDelete: "cascade" })
    .notNull(),
  type: text("type").notNull(), // 'issuance', 'redemption', 'adjustment'
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(), // positive for additions, negative for spent
  balanceAfter: numeric("balance_after", { precision: 12, scale: 2 }).notNull(),
  referenceType: text("reference_type"), // 'return', 'sale', 'manual'
  referenceId: integer("reference_id"),
  createdByUserId: integer("created_by_user_id")
    .references(() => users.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 41. Gift Cards
export const giftCards = pgTable("gift_cards", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  cardNumber: text("card_number").notNull().unique(), // unique code/barcode
  initialBalance: numeric("initial_balance", { precision: 12, scale: 2 }).notNull(),
  currentBalance: numeric("current_balance", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("active"), // 'active', 'inactive', 'expired', 'disabled'
  expiryDate: timestamp("expiry_date"),
  customerId: integer("customer_id")
    .references(() => customers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 42. Gift Card Transactions
export const giftCardTransactions = pgTable("gift_card_transactions", {
  id: serial("id").primaryKey(),
  giftCardId: integer("gift_card_id")
    .references(() => giftCards.id, { onDelete: "cascade" })
    .notNull(),
  type: text("type").notNull(), // 'issue', 'redeem', 'refund_to_card', 'top_up', 'void'
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(), // positive for issue/topup/refund, negative for redeem
  balanceAfter: numeric("balance_after", { precision: 12, scale: 2 }).notNull(),
  referenceType: text("reference_type"), // 'sale', 'return', 'manual'
  referenceId: integer("reference_id"),
  createdByUserId: integer("created_by_user_id")
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 43. Offline Sync Conflicts
export const offlineSyncConflicts = pgTable("offline_sync_conflicts", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id")
    .references(() => stores.id, { onDelete: "cascade" })
    .notNull(),
  entityType: text("entity_type").notNull(), // 'product', 'sale', 'customer', 'inventory'
  entityId: integer("entity_id").notNull(),
  localVersion: integer("local_version").notNull(),
  serverVersion: integer("server_version").notNull(),
  conflictData: text("conflict_data").notNull(), // serialized client JSON state
  resolutionStatus: text("resolution_status").notNull().default("pending"), // 'pending', 'resolved_client_wins', 'resolved_server_wins', 'resolved_manual'
  resolvedByUserId: integer("resolved_by_user_id")
    .references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 44. Inventory Snapshots (for Historical Reporting & EOD/EOM Valuations)
export const inventorySnapshots = pgTable("inventory_snapshots", {
  id: serial("id").primaryKey(),
  warehouseId: integer("warehouse_id")
    .references(() => warehouses.id, { onDelete: "cascade" })
    .notNull(),
  productId: integer("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  variantId: integer("variant_id")
    .references(() => productVariants.id, { onDelete: "cascade" }),
  snapshotDate: timestamp("snapshot_date").notNull(),
  quantityCounted: integer("quantity_counted").notNull(),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull(),
  unitRetail: numeric("unit_retail", { precision: 12, scale: 2 }).notNull(),
  valuationCost: numeric("valuation_cost", { precision: 12, scale: 2 }).notNull(),
  valuationRetail: numeric("valuation_retail", { precision: 12, scale: 2 }).notNull(),
  snapshotType: text("snapshot_type").notNull().default("daily"), // 'daily', 'weekly', 'monthly', 'audit'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 45. Inventory Cost Layers (FIFO Tracking)
export const inventoryCostLayers = pgTable("inventory_cost_layers", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  storeId: integer("store_id")
    .references(() => stores.id, { onDelete: "cascade" })
    .notNull(),
  variantId: integer("variant_id")
    .references(() => productVariants.id, { onDelete: "cascade" })
    .notNull(),
  receivedDate: timestamp("received_date").defaultNow().notNull(),
  referenceType: text("reference_type").notNull(), // 'receiving', 'returns', 'manual'
  referenceId: integer("reference_id"), // PO ID or sale return ID
  quantityReceived: numeric("quantity_received", { precision: 12, scale: 2 }).notNull(),
  quantityRemaining: numeric("quantity_remaining", { precision: 12, scale: 2 }).notNull(),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 46. Inventory Cost Layer Consumptions (Sales COGS Mapping)
export const inventoryCostLayerConsumptions = pgTable("inventory_cost_layer_consumptions", {
  id: serial("id").primaryKey(),
  costLayerId: integer("cost_layer_id")
    .references(() => inventoryCostLayers.id, { onDelete: "cascade" })
    .notNull(),
  saleItemId: integer("sale_item_id")
    .references(() => saleItems.id, { onDelete: "cascade" }), // nullable if from other adjustment/movement
  movementId: integer("movement_id")
    .references(() => inventoryMovements.id, { onDelete: "cascade" })
    .notNull(),
  quantityConsumed: numeric("quantity_consumed", { precision: 12, scale: 2 }).notNull(),
  cogsPosted: numeric("cogs_posted", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 47. Store Prices (Overriding base pricing per branch store node)
export const storePrices = pgTable("store_prices", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id")
    .references(() => stores.id, { onDelete: "cascade" })
    .notNull(),
  variantId: integer("variant_id")
    .references(() => productVariants.id, { onDelete: "cascade" })
    .notNull(),
  overridePrice: numeric("override_price", { precision: 12, scale: 2 }).notNull(),
  msrpOverride: numeric("msrp_override", { precision: 12, scale: 2 }),
  isPromo: boolean("is_promo").default(false).notNull(),
  promoStart: timestamp("promo_start"),
  promoEnd: timestamp("promo_end"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 49. Inventory Count Sessions
export const inventoryCountSessions = pgTable("inventory_count_sessions", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  storeId: integer("store_id")
    .references(() => stores.id, { onDelete: "cascade" })
    .notNull(),
  warehouseId: integer("warehouse_id")
    .references(() => warehouses.id, { onDelete: "cascade" })
    .notNull(),
  status: text("status").notNull().default("draft"), // 'draft', 'counting', 'completed', 'approved', 'cancelled'
  type: text("type").notNull().default("cycle"), // 'cycle', 'full'
  notes: text("notes"),
  createdByUserId: integer("created_by_user_id")
    .references(() => users.id),
  approvedByUserId: integer("approved_by_user_id")
    .references(() => users.id),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 50. Inventory Count Items
export const inventoryCountItems = pgTable("inventory_count_items", {
  id: serial("id").primaryKey(),
  countSessionId: integer("count_session_id")
    .references(() => inventoryCountSessions.id, { onDelete: "cascade" })
    .notNull(),
  productId: integer("product_id")
    .references(() => products.id)
    .notNull(),
  variantId: integer("variant_id")
    .references(() => productVariants.id),
  snapshotQuantity: integer("snapshot_quantity").notNull(), 
  countedQuantity: integer("counted_quantity"), 
  variance: integer("variance"), 
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull(),
  reconciled: boolean("reconciled").default(false).notNull(),
  reasonCode: text("reason_code"), 
});

// 51. Inventory Adjustments
export const inventoryAdjustments = pgTable("inventory_adjustments", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  storeId: integer("store_id")
    .references(() => stores.id, { onDelete: "cascade" })
    .notNull(),
  warehouseId: integer("warehouse_id")
    .references(() => warehouses.id, { onDelete: "cascade" })
    .notNull(),
  adjustmentNumber: text("adjustment_number").notNull().unique(), // e.g. ADJ-2005
  type: text("type").notNull().default("manual"), // 'shrinkage', 'damage', 'expiration', 'theft', 'manual'
  status: text("status").notNull().default("draft"), // 'draft', 'posted', 'cancelled'
  notes: text("notes"),
  createdByUserId: integer("created_by_user_id")
    .references(() => users.id),
  approvedByUserId: integer("approved_by_user_id")
    .references(() => users.id),
  postedAt: timestamp("posted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 52. Inventory Adjustment Items
export const inventoryAdjustmentItems = pgTable("inventory_adjustment_items", {
  id: serial("id").primaryKey(),
  inventoryAdjustmentId: integer("inventory_adjustment_id")
    .references(() => inventoryAdjustments.id, { onDelete: "cascade" })
    .notNull(),
  productId: integer("product_id")
    .references(() => products.id)
    .notNull(),
  variantId: integer("variant_id")
    .references(() => productVariants.id),
  quantityAdjusted: integer("quantity_adjusted").notNull(), 
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull(),
  reasonCode: text("reason_code").notNull(), 
});

// --- ENTITY RELATIONSHIPS DECLARATIONS ---

export const companiesRelations = relations(companies, ({ many }) => ({
  stores: many(stores),
  users: many(users),
  vendors: many(vendors),
  categories: many(categories),
  departments: many(departments),
  taxRules: many(taxRules),
  products: many(products),
  purchaseOrders: many(purchaseOrders),
  generalLedgerEntries: many(generalLedgerEntries),
  giftCards: many(giftCards),
}));

export const storesRelations = relations(stores, ({ one, many }) => ({
  company: one(companies, {
    fields: [stores.companyId],
    references: [companies.id],
  }),
  warehouses: many(warehouses),
  users: many(users),
  employees: many(employees),
  purchaseOrders: many(purchaseOrders),
  cashDrawers: many(cashDrawers),
  sales: many(sales),
  storeExchangeLogs: many(storeExchangeLogs),
  settings: many(settings),
  generalLedgerEntries: many(generalLedgerEntries),
  sourceTransfers: many(transferOrders, { relationName: "sourceTransfers" }),
  destinationTransfers: many(transferOrders, { relationName: "destinationTransfers" }),
  salesReturns: many(salesReturns),
  exchanges: many(exchanges),
  offlineSyncConflicts: many(offlineSyncConflicts),
}));

export const warehousesRelations = relations(warehouses, ({ one, many }) => ({
  store: one(stores, {
    fields: [warehouses.storeId],
    references: [stores.id],
  }),
  inventory: many(inventory),
  sourceWarehouseTransfers: many(transferOrders, { relationName: "sourceWarehouseTransfers" }),
  destinationWarehouseTransfers: many(transferOrders, { relationName: "destinationWarehouseTransfers" }),
  snapshots: many(inventorySnapshots),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(users),
  rolePermissions: many(rolePermissions),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  role: one(roles, {
    fields: [users.roleId],
    references: [roles.id],
  }),
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
  }),
  store: one(stores, {
    fields: [users.storeId],
    references: [stores.id],
  }),
  employees: many(employees),
  shifts: many(shifts),
  sales: many(sales),
  auditLogs: many(auditLogs),
  inventoryMovements: many(inventoryMovements),
  notifications: many(notifications),
  createdTransfers: many(transferOrders, { relationName: "createdTransfers" }),
  approvedTransfers: many(transferOrders, { relationName: "approvedTransfers" }),
  receivedTransfers: many(transferOrders, { relationName: "receivedTransfers" }),
  createdReturns: many(salesReturns),
  createdExchanges: many(exchanges),
  resolvedSyncConflicts: many(offlineSyncConflicts),
  storeCreditTx: many(storeCreditTransactions),
  giftCardTx: many(giftCardTransactions),
}));

export const employeesRelations = relations(employees, ({ one }) => ({
  user: one(users, {
    fields: [employees.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [employees.storeId],
    references: [stores.id],
  }),
}));

export const customerGroupsRelations = relations(customerGroups, ({ many }) => ({
  customers: many(customers),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  group: one(customerGroups, {
    fields: [customers.customerGroupId],
    references: [customerGroups.id],
  }),
  sales: many(sales),
  loyaltyTransactions: many(loyaltyTransactions),
  returns: many(salesReturns),
  exchanges: many(exchanges),
  storeCreditTransactions: many(storeCreditTransactions),
  giftCards: many(giftCards),
}));

export const vendorsRelations = relations(vendors, ({ one, many }) => ({
  company: one(companies, {
    fields: [vendors.companyId],
    references: [companies.id],
  }),
  purchaseOrders: many(purchaseOrders),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  company: one(companies, {
    fields: [categories.companyId],
    references: [companies.id],
  }),
  parentCategory: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "nestedCategories",
  }),
  subCategories: many(categories, {
    relationName: "nestedCategories",
  }),
  products: many(products),
}));

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  company: one(companies, {
    fields: [departments.companyId],
    references: [companies.id],
  }),
  products: many(products),
}));

export const taxRulesRelations = relations(taxRules, ({ one, many }) => ({
  company: one(companies, {
    fields: [taxRules.companyId],
    references: [companies.id],
  }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  department: one(departments, {
    fields: [products.departmentId],
    references: [departments.id],
  }),
  taxRule: one(taxRules, {
    fields: [products.taxCategoryId],
    references: [taxRules.id],
  }),
  variants: many(productVariants),
  inventory: many(inventory),
  purchaseOrderItems: many(purchaseOrderItems),
  transferOrderItems: many(transferOrderItems),
  saleItems: many(saleItems),
}));

export const productVariantsRelations = relations(productVariants, ({ one, many }) => ({
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
  inventory: many(inventory),
  purchaseOrderItems: many(purchaseOrderItems),
  transferOrderItems: many(transferOrderItems),
  saleItems: many(saleItems),
}));

export const inventoryRelations = relations(inventory, ({ one, many }) => ({
  warehouse: one(warehouses, {
    fields: [inventory.warehouseId],
    references: [warehouses.id],
  }),
  product: one(products, {
    fields: [inventory.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [inventory.variantId],
    references: [productVariants.id],
  }),
  movements: many(inventoryMovements),
}));

export const inventoryMovementsRelations = relations(inventoryMovements, ({ one }) => ({
  inventory: one(inventory, {
    fields: [inventoryMovements.inventoryId],
    references: [inventory.id],
  }),
  user: one(users, {
    fields: [inventoryMovements.userId],
    references: [users.id],
  }),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  company: one(companies, {
    fields: [purchaseOrders.companyId],
    references: [companies.id],
  }),
  vendor: one(vendors, {
    fields: [purchaseOrders.vendorId],
    references: [vendors.id],
  }),
  store: one(stores, {
    fields: [purchaseOrders.storeId],
    references: [stores.id],
  }),
  items: many(purchaseOrderItems),
}));

export const purchaseOrderItemsRelations = relations(purchaseOrderItems, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderItems.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  product: one(products, {
    fields: [purchaseOrderItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [purchaseOrderItems.variantId],
    references: [productVariants.id],
  }),
}));

export const transferOrdersRelations = relations(transferOrders, ({ one, many }) => ({
  sourceStore: one(stores, {
    fields: [transferOrders.sourceStoreId],
    references: [stores.id],
    relationName: "sourceTransfers",
  }),
  sourceWarehouse: one(warehouses, {
    fields: [transferOrders.sourceWarehouseId],
    references: [warehouses.id],
    relationName: "sourceWarehouseTransfers",
  }),
  destinationStore: one(stores, {
    fields: [transferOrders.destinationStoreId],
    references: [stores.id],
    relationName: "destinationTransfers",
  }),
  destinationWarehouse: one(warehouses, {
    fields: [transferOrders.destinationWarehouseId],
    references: [warehouses.id],
    relationName: "destinationWarehouseTransfers",
  }),
  createdBy: one(users, {
    fields: [transferOrders.createdByUserId],
    references: [users.id],
    relationName: "createdTransfers",
  }),
  approvedBy: one(users, {
    fields: [transferOrders.approvedByUserId],
    references: [users.id],
    relationName: "approvedTransfers",
  }),
  receivedBy: one(users, {
    fields: [transferOrders.receivedByUserId],
    references: [users.id],
    relationName: "receivedTransfers",
  }),
  items: many(transferOrderItems),
}));

export const transferOrderItemsRelations = relations(transferOrderItems, ({ one }) => ({
  transferOrder: one(transferOrders, {
    fields: [transferOrderItems.transferOrderId],
    references: [transferOrders.id],
  }),
  product: one(products, {
    fields: [transferOrderItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [transferOrderItems.variantId],
    references: [productVariants.id],
  }),
}));

export const cashDrawersRelations = relations(cashDrawers, ({ one, many }) => ({
  store: one(stores, {
    fields: [cashDrawers.storeId],
    references: [stores.id],
  }),
  shifts: many(shifts),
}));

export const shiftsRelations = relations(shifts, ({ one, many }) => ({
  cashDrawer: one(cashDrawers, {
    fields: [shifts.cashDrawerId],
    references: [cashDrawers.id],
  }),
  user: one(users, {
    fields: [shifts.userId],
    references: [users.id],
  }),
  sales: many(sales),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
  store: one(stores, {
    fields: [sales.storeId],
    references: [stores.id],
  }),
  customer: one(customers, {
    fields: [sales.customerId],
    references: [customers.id],
  }),
  cashier: one(users, {
    fields: [sales.cashierId],
    references: [users.id],
  }),
  shift: one(shifts, {
    fields: [sales.shiftId],
    references: [shifts.id],
  }),
  items: many(saleItems),
  payments: many(payments),
  invoices: many(invoices),
  receipts: many(receipts),
  loyaltyTransactions: many(loyaltyTransactions),
  returns: many(salesReturns),
  exchanges: many(exchanges),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, {
    fields: [saleItems.saleId],
    references: [sales.id],
  }),
  product: one(products, {
    fields: [saleItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [saleItems.variantId],
    references: [productVariants.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  sale: one(sales, {
    fields: [payments.saleId],
    references: [sales.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  sale: one(sales, {
    fields: [invoices.saleId],
    references: [sales.id],
  }),
}));

export const receiptsRelations = relations(receipts, ({ one }) => ({
  sale: one(sales, {
    fields: [receipts.saleId],
    references: [sales.id],
  }),
}));

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  customer: one(customers, {
    fields: [loyaltyTransactions.customerId],
    references: [customers.id],
  }),
  sale: one(sales, {
    fields: [loyaltyTransactions.saleId],
    references: [sales.id],
  }),
}));

export const storeExchangeLogsRelations = relations(storeExchangeLogs, ({ one }) => ({
  store: one(stores, {
    fields: [storeExchangeLogs.storeId],
    references: [stores.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const settingsRelations = relations(settings, ({ one }) => ({
  store: one(stores, {
    fields: [settings.storeId],
    references: [stores.id],
  }),
}));

export const generalLedgerEntriesRelations = relations(generalLedgerEntries, ({ one }) => ({
  company: one(companies, {
    fields: [generalLedgerEntries.companyId],
    references: [companies.id],
  }),
  store: one(stores, {
    fields: [generalLedgerEntries.storeId],
    references: [stores.id],
  }),
}));

export const salesReturnsRelations = relations(salesReturns, ({ one, many }) => ({
  sale: one(sales, {
    fields: [salesReturns.saleId],
    references: [sales.id],
  }),
  store: one(stores, {
    fields: [salesReturns.storeId],
    references: [stores.id],
  }),
  customer: one(customers, {
    fields: [salesReturns.customerId],
    references: [customers.id],
  }),
  cashier: one(users, {
    fields: [salesReturns.cashierId],
    references: [users.id],
  }),
  items: many(returnItems),
  exchanges: many(exchanges),
}));

export const returnItemsRelations = relations(returnItems, ({ one }) => ({
  returnOrder: one(salesReturns, {
    fields: [returnItems.returnId],
    references: [salesReturns.id],
  }),
  saleItem: one(saleItems, {
    fields: [returnItems.saleItemId],
    references: [saleItems.id],
  }),
  product: one(products, {
    fields: [returnItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [returnItems.variantId],
    references: [productVariants.id],
  }),
}));

export const exchangesRelations = relations(exchanges, ({ one }) => ({
  store: one(stores, {
    fields: [exchanges.storeId],
    references: [stores.id],
  }),
  customer: one(customers, {
    fields: [exchanges.customerId],
    references: [customers.id],
  }),
  cashier: one(users, {
    fields: [exchanges.cashierId],
    references: [users.id],
  }),
  returnOrder: one(salesReturns, {
    fields: [exchanges.returnId],
    references: [salesReturns.id],
  }),
  newSale: one(sales, {
    fields: [exchanges.newSaleId],
    references: [sales.id],
  }),
}));

export const storeCreditTransactionsRelations = relations(storeCreditTransactions, ({ one }) => ({
  customer: one(customers, {
    fields: [storeCreditTransactions.customerId],
    references: [customers.id],
  }),
  createdByUser: one(users, {
    fields: [storeCreditTransactions.createdByUserId],
    references: [users.id],
  }),
}));

export const giftCardsRelations = relations(giftCards, ({ one, many }) => ({
  company: one(companies, {
    fields: [giftCards.companyId],
    references: [companies.id],
  }),
  customer: one(customers, {
    fields: [giftCards.customerId],
    references: [customers.id],
  }),
  transactions: many(giftCardTransactions),
}));

export const giftCardTransactionsRelations = relations(giftCardTransactions, ({ one }) => ({
  giftCard: one(giftCards, {
    fields: [giftCardTransactions.giftCardId],
    references: [giftCards.id],
  }),
  createdByUser: one(users, {
    fields: [giftCardTransactions.createdByUserId],
    references: [users.id],
  }),
}));

export const offlineSyncConflictsRelations = relations(offlineSyncConflicts, ({ one }) => ({
  store: one(stores, {
    fields: [offlineSyncConflicts.storeId],
    references: [stores.id],
  }),
  resolvedByUser: one(users, {
    fields: [offlineSyncConflicts.resolvedByUserId],
    references: [users.id],
  }),
}));

export const inventorySnapshotsRelations = relations(inventorySnapshots, ({ one }) => ({
  warehouse: one(warehouses, {
    fields: [inventorySnapshots.warehouseId],
    references: [warehouses.id],
  }),
  product: one(products, {
    fields: [inventorySnapshots.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [inventorySnapshots.variantId],
    references: [productVariants.id],
  }),
}));

export const inventoryCountSessionsRelations = relations(inventoryCountSessions, ({ one, many }) => ({
  company: one(companies, {
    fields: [inventoryCountSessions.companyId],
    references: [companies.id],
  }),
  store: one(stores, {
    fields: [inventoryCountSessions.storeId],
    references: [stores.id],
  }),
  warehouse: one(warehouses, {
    fields: [inventoryCountSessions.warehouseId],
    references: [warehouses.id],
  }),
  items: many(inventoryCountItems),
}));

export const inventoryCountItemsRelations = relations(inventoryCountItems, ({ one }) => ({
  session: one(inventoryCountSessions, {
    fields: [inventoryCountItems.countSessionId],
    references: [inventoryCountSessions.id],
  }),
  product: one(products, {
    fields: [inventoryCountItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [inventoryCountItems.variantId],
    references: [productVariants.id],
  }),
}));

export const inventoryAdjustmentsRelations = relations(inventoryAdjustments, ({ one, many }) => ({
  company: one(companies, {
    fields: [inventoryAdjustments.companyId],
    references: [companies.id],
  }),
  store: one(stores, {
    fields: [inventoryAdjustments.storeId],
    references: [stores.id],
  }),
  warehouse: one(warehouses, {
    fields: [inventoryAdjustments.warehouseId],
    references: [warehouses.id],
  }),
  items: many(inventoryAdjustmentItems),
}));

export const inventoryAdjustmentItemsRelations = relations(inventoryAdjustmentItems, ({ one }) => ({
  adjustment: one(inventoryAdjustments, {
    fields: [inventoryAdjustmentItems.inventoryAdjustmentId],
    references: [inventoryAdjustments.id],
  }),
  product: one(products, {
    fields: [inventoryAdjustmentItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [inventoryAdjustmentItems.variantId],
    references: [productVariants.id],
  }),
}));

// 53. Store Exchange Batches
export const storeExchangeBatches = pgTable("store_exchange_batches", {
  id: serial("id").primaryKey(),
  batchNumber: text("batch_number").notNull().unique(), // e.g. BATCH-0001
  sourceStoreId: integer("source_store_id")
    .references(() => stores.id, { onDelete: "cascade" })
    .notNull(),
  destinationStoreId: integer("destination_store_id")
    .references(() => stores.id, { onDelete: "cascade" }), // Null means HQ
  status: text("status").notNull().default("draft"), // 'draft', 'pending', 'processed', 'failed'
  itemCount: integer("item_count").default(0).notNull(),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 54. Store Exchange Batch Items
export const storeExchangeBatchItems = pgTable("store_exchange_batch_items", {
  id: serial("id").primaryKey(),
  batchId: integer("batch_id")
    .references(() => storeExchangeBatches.id, { onDelete: "cascade" })
    .notNull(),
  entityType: text("entity_type").notNull(), // 'sale', 'return', 'adjustment', 'customer'
  entityId: text("entity_id").notNull(), // Client-side temp ID or Server ID
  actionType: text("action_type").notNull(), // 'create', 'update'
  payload: text("payload").notNull(), // Serialized JSON representation of structural data
  sequenceNumber: integer("sequence_number").notNull(), // For sequential replay
  syncStatus: text("sync_status").notNull().default("pending"), // 'pending', 'applied', 'failed', 'ignored'
  errorMessage: text("error_message"),
});

// 55. Sync Checkpoints
export const syncCheckpoints = pgTable("sync_checkpoints", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id")
    .references(() => stores.id, { onDelete: "cascade" })
    .notNull().unique(),
  lastSyncedId: integer("last_synced_id").default(0).notNull(), // Point of sequence
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 56. Sync Conflicts
export const syncConflicts = pgTable("sync_conflicts", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id")
    .references(() => stores.id, { onDelete: "cascade" })
    .notNull(),
  entityType: text("entity_type").notNull(), // 'sale', 'return', 'adjustment', 'customer'
  entityId: text("entity_id").notNull(),
  conflictType: text("conflict_type").notNull(), // 'version_mismatch', 'duplicate'
  localData: text("local_data").notNull(), // Client representation
  serverData: text("server_data").notNull(), // Server representation
  resolution: text("resolution").notNull().default("pending"), // 'pending', 'client_wins', 'server_wins', 'manual'
  resolvedAt: timestamp("resolved_at"),
  resolvedByUserId: integer("resolved_by_user_id")
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 57. Offline Transaction Queue
export const offlineTransactionQueue = pgTable("offline_transaction_queue", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id")
    .references(() => stores.id, { onDelete: "cascade" })
    .notNull(),
  transactionHash: text("transaction_hash").notNull().unique(), // For idempotent protection
  entityType: text("entity_type").notNull(), // 'sale', 'return', 'adjustment', 'customer'
  payload: text("payload").notNull(), // Serialized details of transaction
  status: text("status").notNull().default("pending"), // 'pending', 'synced', 'failed', 'conflict'
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  syncedAt: timestamp("synced_at"),
});

// 58. Synchronization Audit Logs
export const synchronizationAuditLogs = pgTable("synchronization_audit_logs", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id")
    .references(() => stores.id, { onDelete: "cascade" }),
  batchId: integer("batch_id")
    .references(() => storeExchangeBatches.id, { onDelete: "set null" }),
  direction: text("direction").notNull(), // 'upload', 'download'
  status: text("status").notNull(), // 'success', 'failed', 'partial'
  recordsProcessed: integer("records_processed").default(0).notNull(),
  recordsFailed: integer("records_failed").default(0).notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// --- RELATION DEFS FOR NEW ENTITIES ---

export const storeExchangeBatchesRelations = relations(storeExchangeBatches, ({ one, many }) => ({
  sourceStore: one(stores, {
    fields: [storeExchangeBatches.sourceStoreId],
    references: [stores.id],
  }),
  items: many(storeExchangeBatchItems),
  auditLogs: many(synchronizationAuditLogs),
}));

export const storeExchangeBatchItemsRelations = relations(storeExchangeBatchItems, ({ one }) => ({
  batch: one(storeExchangeBatches, {
    fields: [storeExchangeBatchItems.batchId],
    references: [storeExchangeBatches.id],
  }),
}));

export const syncCheckpointsRelations = relations(syncCheckpoints, ({ one }) => ({
  store: one(stores, {
    fields: [syncCheckpoints.storeId],
    references: [stores.id],
  }),
}));

export const syncConflictsRelations = relations(syncConflicts, ({ one }) => ({
  store: one(stores, {
    fields: [syncConflicts.storeId],
    references: [stores.id],
  }),
  resolvedBy: one(users, {
    fields: [syncConflicts.resolvedByUserId],
    references: [users.id],
  }),
}));

export const offlineTransactionQueueRelations = relations(offlineTransactionQueue, ({ one }) => ({
  store: one(stores, {
    fields: [offlineTransactionQueue.storeId],
    references: [stores.id],
  }),
}));

export const synchronizationAuditLogsRelations = relations(synchronizationAuditLogs, ({ one }) => ({
  store: one(stores, {
    fields: [synchronizationAuditLogs.storeId],
    references: [stores.id],
  }),
  batch: one(storeExchangeBatches, {
    fields: [synchronizationAuditLogs.batchId],
    references: [storeExchangeBatches.id],
  }),
}));

// --- STAGE 4 SYSTEM TABLES ---

// 59. Fiscal Years
export const fiscalYears = pgTable("fiscal_years", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull().unique(), // e.g. 2026
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: text("status").notNull().default("open"), // 'open', 'closed'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 60. Accounting Periods
export const accountingPeriods = pgTable("accounting_periods", {
  id: serial("id").primaryKey(),
  fiscalYearId: integer("fiscal_year_id")
    .references(() => fiscalYears.id, { onDelete: "cascade" })
    .notNull(),
  periodNumber: integer("period_number").notNull(), // 1 to 12
  name: text("name").notNull(), // e.g. "January 2026"
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: text("status").notNull().default("open"), // 'open', 'soft_closed', 'closed', 'archived'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 61. Fiscal Close Runs
export const fiscalCloseRuns = pgTable("fiscal_close_runs", {
  id: serial("id").primaryKey(),
  periodId: integer("period_id")
    .references(() => accountingPeriods.id, { onDelete: "cascade" }), // Null for Year-End close runs
  fiscalYearId: integer("fiscal_year_id")
    .references(() => fiscalYears.id, { onDelete: "cascade" })
    .notNull(),
  runType: text("run_type").notNull(), // 'month_end', 'year_end'
  status: text("status").notNull(), // 'success', 'failed'
  runDate: timestamp("run_date").defaultNow().notNull(),
  performedByUserId: integer("performed_by_user_id")
    .references(() => users.id)
    .notNull(),
  retainedEarningsEntryId: integer("retained_earnings_entry_id"), // Refers to the generated retained earnings general_ledger_entries.id
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 62. Accounting Lock Audit Logs
export const accountingLockAuditLogs = pgTable("accounting_lock_audit_logs", {
  id: serial("id").primaryKey(),
  periodId: integer("period_id")
    .references(() => accountingPeriods.id, { onDelete: "cascade" })
    .notNull(),
  action: text("action").notNull(), // 'lock', 'unlock', 'reopen', 'soft_close'
  performedByUserId: integer("performed_by_user_id")
    .references(() => users.id)
    .notNull(),
  reason: text("reason").notNull(),
  metadata: text("metadata"), // JSON stringified extra details
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// --- RELATION DEFS FOR STAGE 4 ENTITIES ---

export const fiscalYearsRelations = relations(fiscalYears, ({ many }) => ({
  periods: many(accountingPeriods),
  closeRuns: many(fiscalCloseRuns),
}));

export const accountingPeriodsRelations = relations(accountingPeriods, ({ one, many }) => ({
  fiscalYear: one(fiscalYears, {
    fields: [accountingPeriods.fiscalYearId],
    references: [fiscalYears.id],
  }),
  closeRuns: many(fiscalCloseRuns),
  lockAuditLogs: many(accountingLockAuditLogs),
}));

export const fiscalCloseRunsRelations = relations(fiscalCloseRuns, ({ one }) => ({
  period: one(accountingPeriods, {
    fields: [fiscalCloseRuns.periodId],
    references: [accountingPeriods.id],
  }),
  fiscalYear: one(fiscalYears, {
    fields: [fiscalCloseRuns.fiscalYearId],
    references: [fiscalYears.id],
  }),
  performedBy: one(users, {
    fields: [fiscalCloseRuns.performedByUserId],
    references: [users.id],
  }),
}));

export const accountingLockAuditLogsRelations = relations(accountingLockAuditLogs, ({ one }) => ({
  period: one(accountingPeriods, {
    fields: [accountingLockAuditLogs.periodId],
    references: [accountingPeriods.id],
  }),
  performedBy: one(users, {
    fields: [accountingLockAuditLogs.performedByUserId],
    references: [users.id],
  }),
}));

// ==========================================
// Stage 5 Entities: AP, AR, payments, bank reconciliation, credit control
// ==========================================

export const bankAccounts = pgTable("bank_accounts", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  accountNumber: text("account_number").notNull().unique(),
  routingNumber: text("routing_number"),
  bankName: text("bank_name"),
  currency: text("currency").default("USD").notNull(),
  ledgerAccountCode: text("ledger_account_code").notNull(), // associated cash/bank asset account
  balance: numeric("balance", { precision: 12, scale: 2 }).default("0.00").notNull(),
  status: text("status").notNull().default("active"), // active, inactive
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const vendorInvoices = pgTable("vendor_invoices", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  vendorId: integer("vendor_id")
    .references(() => vendors.id)
    .notNull(),
  invoiceNumber: text("invoice_number").notNull(), // Vendor-supplied reference
  invoiceDate: timestamp("invoice_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  status: text("status").notNull().default("draft"), // draft, posted, paid, partially_paid, void
  apControlAccountCode: text("ap_control_account_code").notNull().default("2010"), // Accounts Payable control account code
  currencyCode: text("currency_code").default("USD").notNull(),
  exchangeRate: numeric("exchange_rate", { precision: 12, scale: 6 }).default("1.000000").notNull(),
  currencyAmount: numeric("currency_amount", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const vendorInvoiceItems = pgTable("vendor_invoice_items", {
  id: serial("id").primaryKey(),
  vendorInvoiceId: integer("vendor_invoice_id")
    .references(() => vendorInvoices.id, { onDelete: "cascade" })
    .notNull(),
  accountCode: text("account_code").notNull(), // Expense or inventory account
  description: text("description"),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).default("1.00").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const vendorPayments = pgTable("vendor_payments", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  vendorId: integer("vendor_id")
    .references(() => vendors.id)
    .notNull(),
  vendorInvoiceId: integer("vendor_invoice_id") // Optional. If null, it represents an unapplied advance/deposit
    .references(() => vendorInvoices.id),
  bankAccountId: integer("bank_account_id")
    .references(() => bankAccounts.id)
    .notNull(),
  paymentDate: timestamp("payment_date").notNull(),
  paymentMethod: text("payment_method").notNull(), // bank, cash, cheque
  referenceNumber: text("reference_number"), // cheque number or wire ID
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  reversalDate: timestamp("reversal_date"), // filled if reversed
  reversalReason: text("reversal_reason"),
  currencyCode: text("currency_code").default("USD").notNull(),
  exchangeRate: numeric("exchange_rate", { precision: 12, scale: 6 }).default("1.000000").notNull(),
  currencyAmount: numeric("currency_amount", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const customerInvoices = pgTable("customer_invoices", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  customerId: integer("customer_id")
    .references(() => customers.id)
    .notNull(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  invoiceDate: timestamp("invoice_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  status: text("status").notNull().default("draft"), // draft, posted, paid, partially_paid, void
  arControlAccountCode: text("ar_control_account_code").notNull().default("1200"), // Accounts Receivable control account code
  currencyCode: text("currency_code").default("USD").notNull(),
  exchangeRate: numeric("exchange_rate", { precision: 12, scale: 6 }).default("1.000000").notNull(),
  currencyAmount: numeric("currency_amount", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const customerInvoiceItems = pgTable("customer_invoice_items", {
  id: serial("id").primaryKey(),
  customerInvoiceId: integer("customer_invoice_id")
    .references(() => customerInvoices.id, { onDelete: "cascade" })
    .notNull(),
  accountCode: text("account_code").notNull(), // Revenue account, usually
  description: text("description"),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).default("1.00").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const customerReceipts = pgTable("customer_receipts", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  customerId: integer("customer_id")
    .references(() => customers.id)
    .notNull(),
  customerInvoiceId: integer("customer_invoice_id") // Optional for advance payment
    .references(() => customerInvoices.id),
  bankAccountId: integer("bank_account_id")
    .references(() => bankAccounts.id)
    .notNull(),
  receiptDate: timestamp("receipt_date").notNull(),
  paymentMethod: text("payment_method").notNull(), // bank, cash, cheque
  referenceNumber: text("reference_number"), // receipt wire trans reference or cheque number
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  reversalDate: timestamp("reversal_date"), // filled if reversed
  reversalReason: text("reversal_reason"),
  currencyCode: text("currency_code").default("USD").notNull(),
  exchangeRate: numeric("exchange_rate", { precision: 12, scale: 6 }).default("1.000000").notNull(),
  currencyAmount: numeric("currency_amount", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bankReconciliations = pgTable("bank_reconciliations", {
  id: serial("id").primaryKey(),
  bankAccountId: integer("bank_account_id")
    .references(() => bankAccounts.id)
    .notNull(),
  statementEndDate: timestamp("statement_end_date").notNull(),
  statementEndingBalance: numeric("statement_ending_balance", { precision: 12, scale: 2 }).notNull(),
  ledgerEndingBalance: numeric("ledger_ending_balance", { precision: 12, scale: 2 }).notNull(),
  reconciledAt: timestamp("reconciled_at"),
  performedByUserId: integer("performed_by_user_id")
    .references(() => users.id),
  status: text("status").notNull().default("draft"), // draft, approved
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const bankTransactions = pgTable("bank_transactions", {
  id: serial("id").primaryKey(),
  bankAccountId: integer("bank_account_id")
    .references(() => bankAccounts.id)
    .notNull(),
  transactionDate: timestamp("transaction_date").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(), // Positive is deposit, negative is withdrawal
  referenceNumber: text("reference_number"),
  runningBalance: numeric("running_balance", { precision: 12, scale: 2 }),
  status: text("status").notNull().default("unmatched"), // unmatched, matched, adjustments_posted
  matchedType: text("matched_type"), // 'payment', 'receipt', 'charge', 'interest'
  matchedReferenceId: integer("matched_reference_id"), // vendor_payment.id or customer_receipt.id etc.
  bankReconciliationId: integer("bank_reconciliation_id")
    .references(() => bankReconciliations.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const creditNotes = pgTable("credit_notes", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  type: text("type").notNull(), // 'vendor' or 'customer'
  entityId: integer("entity_id").notNull(), // customer_id or vendor_id depending on type
  referenceInvoiceId: integer("reference_invoice_id"), // customer_invoice_id or vendor_invoice_id (nullable)
  creditNoteNumber: text("credit_note_number").notNull().unique(),
  creditNoteDate: timestamp("credit_note_date").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  remainingAmount: numeric("remaining_amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("draft"), // draft, posted, applied, void
  notes: text("notes"),
  currencyCode: text("currency_code").default("USD").notNull(),
  exchangeRate: numeric("exchange_rate", { precision: 12, scale: 6 }).default("1.000000").notNull(),
  currencyAmount: numeric("currency_amount", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const currencies = pgTable("currencies", {
  code: text("code").primaryKey(), // e.g. "USD", "EUR", "GBP"
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  isBase: boolean("is_base").default(false).notNull(),
  decimals: integer("decimals").default(2).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const exchangeRates = pgTable("exchange_rates", {
  id: serial("id").primaryKey(),
  fromCurrency: text("from_currency").references(() => currencies.code).notNull(),
  toCurrency: text("to_currency").references(() => currencies.code).notNull(),
  rate: numeric("rate", { precision: 12, scale: 6 }).notNull(),
  rateDate: timestamp("rate_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const budgets = pgTable("budgets", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  fiscalYearId: integer("fiscal_year_id")
    .references(() => fiscalYears.id)
    .notNull(),
  departmentId: integer("department_id")
    .references(() => departments.id),
  storeId: integer("store_id")
    .references(() => stores.id),
  accountCode: text("account_code").notNull(),
  name: text("name").notNull(),
  annualAmount: numeric("annual_amount", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const budgetPeriods = pgTable("budget_periods", {
  id: serial("id").primaryKey(),
  budgetId: integer("budget_id")
    .references(() => budgets.id, { onDelete: "cascade" })
    .notNull(),
  periodId: integer("period_id")
    .references(() => accountingPeriods.id)
    .notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const budgetRevisions = pgTable("budget_revisions", {
  id: serial("id").primaryKey(),
  budgetId: integer("budget_id")
    .references(() => budgets.id, { onDelete: "cascade" })
    .notNull(),
  revisionDate: timestamp("revision_date").notNull(),
  revisedAmount: numeric("revised_amount", { precision: 12, scale: 2 }).notNull(),
  reason: text("reason"),
  revisedByUserId: integer("revised_by_user_id")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cashTransfers = pgTable("cash_transfers", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  sourceBankAccountId: integer("source_bank_account_id")
    .references(() => bankAccounts.id)
    .notNull(),
  destinationBankAccountId: integer("destination_bank_account_id")
    .references(() => bankAccounts.id)
    .notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  transferDate: timestamp("transfer_date").notNull(),
  referenceNumber: text("reference_number"),
  status: text("status").notNull().default("completed"), // completed, reversed
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const cashTransactions = pgTable("cash_transactions", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  bankAccountId: integer("bank_account_id")
    .references(() => bankAccounts.id)
    .notNull(),
  type: text("type").notNull(), // cash_in, cash_out
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  transactionDate: timestamp("transaction_date").notNull(),
  referenceNumber: text("reference_number"),
  description: text("description").notNull(),
  ledgerAccountCode: text("ledger_account_code").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations

export const bankAccountsRelations = relations(bankAccounts, ({ one, many }) => ({
  company: one(companies, {
    fields: [bankAccounts.companyId],
    references: [companies.id],
  }),
  payments: many(vendorPayments),
  receipts: many(customerReceipts),
  reconciliations: many(bankReconciliations),
  transactions: many(bankTransactions),
}));

export const vendorInvoicesRelations = relations(vendorInvoices, ({ one, many }) => ({
  company: one(companies, {
    fields: [vendorInvoices.companyId],
    references: [companies.id],
  }),
  vendor: one(vendors, {
    fields: [vendorInvoices.vendorId],
    references: [vendors.id],
  }),
  items: many(vendorInvoiceItems),
  payments: many(vendorPayments),
}));

export const vendorInvoiceItemsRelations = relations(vendorInvoiceItems, ({ one }) => ({
  vendorInvoice: one(vendorInvoices, {
    fields: [vendorInvoiceItems.vendorInvoiceId],
    references: [vendorInvoices.id],
  }),
}));

export const vendorPaymentsRelations = relations(vendorPayments, ({ one }) => ({
  company: one(companies, {
    fields: [vendorPayments.companyId],
    references: [companies.id],
  }),
  vendor: one(vendors, {
    fields: [vendorPayments.vendorId],
    references: [vendors.id],
  }),
  vendorInvoice: one(vendorInvoices, {
    fields: [vendorPayments.vendorInvoiceId],
    references: [vendorInvoices.id],
  }),
  bankAccount: one(bankAccounts, {
    fields: [vendorPayments.bankAccountId],
    references: [bankAccounts.id],
  }),
}));

export const customerInvoicesRelations = relations(customerInvoices, ({ one, many }) => ({
  company: one(companies, {
    fields: [customerInvoices.companyId],
    references: [companies.id],
  }),
  customer: one(customers, {
    fields: [customerInvoices.customerId],
    references: [customers.id],
  }),
  items: many(customerInvoiceItems),
  receipts: many(customerReceipts),
}));

export const customerInvoiceItemsRelations = relations(customerInvoiceItems, ({ one }) => ({
  customerInvoice: one(customerInvoices, {
    fields: [customerInvoiceItems.customerInvoiceId],
    references: [customerInvoices.id],
  }),
}));

export const customerReceiptsRelations = relations(customerReceipts, ({ one }) => ({
  company: one(companies, {
    fields: [customerReceipts.companyId],
    references: [companies.id],
  }),
  customer: one(customers, {
    fields: [customerReceipts.customerId],
    references: [customers.id],
  }),
  customerInvoice: one(customerInvoices, {
    fields: [customerReceipts.customerInvoiceId],
    references: [customerInvoices.id],
  }),
  bankAccount: one(bankAccounts, {
    fields: [customerReceipts.bankAccountId],
    references: [bankAccounts.id],
  }),
}));

export const bankReconciliationsRelations = relations(bankReconciliations, ({ one, many }) => ({
  bankAccount: one(bankAccounts, {
    fields: [bankReconciliations.bankAccountId],
    references: [bankAccounts.id],
  }),
  performedBy: one(users, {
    fields: [bankReconciliations.performedByUserId],
    references: [users.id],
  }),
  transactions: many(bankTransactions),
}));

export const bankTransactionsRelations = relations(bankTransactions, ({ one }) => ({
  bankAccount: one(bankAccounts, {
    fields: [bankTransactions.bankAccountId],
    references: [bankAccounts.id],
  }),
  bankReconciliation: one(bankReconciliations, {
    fields: [bankTransactions.bankReconciliationId],
    references: [bankReconciliations.id],
  }),
}));

export const creditNotesRelations = relations(creditNotes, ({ one }) => ({
  company: one(companies, {
    fields: [creditNotes.companyId],
    references: [companies.id],
  }),
}));

// ==========================================
// STAGE 5.3: FIXED ASSETS REGISTER SCHEMA
// ==========================================

export const fixedAssetCategories = pgTable("fixed_asset_categories", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  code: text("code").notNull(), // e.g. "EQUIP", "VEH", "COMP"
  name: text("name").notNull(),
  depreciationMethod: text("depreciation_method").notNull(), // straight_line, declining_balance, units_of_production
  usefulLifeMonths: integer("useful_life_months").notNull(),
  decliningBalanceRate: numeric("declining_balance_rate", { precision: 5, scale: 2 }), // e.g. 20.00
  assetGlAccount: text("asset_gl_account").notNull(), // e.g., "1510"
  depreciationExpenseGlAccount: text("depreciation_expense_gl_account").notNull(), // e.g., "5050"
  accumulatedDepreciationGlAccount: text("accumulated_depreciation_gl_account").notNull(), // e.g., "1519"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const fixedAssets = pgTable("fixed_assets", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  storeId: integer("store_id")
    .references(() => stores.id)
    .notNull(),
  categoryCode: text("category_code").notNull(), // e.g. "EQUIP"
  assetCode: text("asset_code").notNull(), // unique asset registration, e.g. "FA-0001"
  name: text("name").notNull(),
  description: text("description"),
  acquisitionDate: timestamp("acquisition_date").notNull(),
  acquisitionCost: numeric("acquisition_cost", { precision: 12, scale: 2 }).notNull(),
  salvageValue: numeric("salvage_value", { precision: 12, scale: 2 }).default("0.00").notNull(),
  depreciationMethod: text("depreciation_method").notNull(), // straight_line, declining_balance, units_of_production
  usefulLifeMonths: integer("useful_life_months").notNull(),
  decliningBalanceRate: numeric("declining_balance_rate", { precision: 5, scale: 2 }), // e.g. 20.00
  totalUnitsExpected: numeric("total_units_expected", { precision: 12, scale: 2 }), // for Units of Production
  unitsProducedToDate: numeric("units_produced_to_date", { precision: 12, scale: 2 }).default("0.00").notNull(),
  accumulatedDepreciation: numeric("accumulated_depreciation", { precision: 12, scale: 2 }).default("0.00").notNull(),
  netBookValue: numeric("net_book_value", { precision: 12, scale: 2 }).notNull(), // cost - accum
  status: text("status").notNull().default("active"), // active, disposed, fully_depreciated
  assetGlAccount: text("asset_gl_account").notNull(),
  depreciationExpenseGlAccount: text("depreciation_expense_gl_account").notNull(),
  accumulatedDepreciationGlAccount: text("accumulated_depreciation_gl_account").notNull(),
  disposalDate: timestamp("disposal_date"),
  disposalPrice: numeric("disposal_price", { precision: 12, scale: 2 }),
  disposalGainLoss: numeric("disposal_gain_loss", { precision: 12, scale: 2 }),
  disposalType: text("disposal_type"), // sale, scrap, write_off
  currencyCode: text("currency_code").default("USD").notNull(),
  exchangeRate: numeric("exchange_rate", { precision: 12, scale: 6 }).default("1.000000").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const fixedAssetDepreciationLogs = pgTable("fixed_asset_depreciation_logs", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id")
    .references(() => fixedAssets.id, { onDelete: "cascade" })
    .notNull(),
  periodStartDate: timestamp("period_start_date").notNull(),
  periodEndDate: timestamp("period_end_date").notNull(),
  depreciationAmount: numeric("depreciation_amount", { precision: 12, scale: 2 }).notNull(),
  accumulatedDepreciationAfter: numeric("accumulated_depreciation_after", { precision: 12, scale: 2 }).notNull(),
  netBookValueAfter: numeric("net_book_value_after", { precision: 12, scale: 2 }).notNull(),
  generalLedgerEntryId: integer("general_ledger_entry_id"), // link to general_ledger_entries if needed
  unitsProducedInPeriod: numeric("units_produced_in_period", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const fixedAssetMovements = pgTable("fixed_asset_movements", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id")
    .references(() => fixedAssets.id, { onDelete: "cascade" })
    .notNull(),
  fromStoreId: integer("from_store_id")
    .references(() => stores.id),
  toStoreId: integer("to_store_id")
    .references(() => stores.id)
    .notNull(),
  transferDate: timestamp("transfer_date").notNull(),
  reason: text("reason").notNull(),
  createdById: integer("created_by_id")
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const fixedAssetAuditLogs = pgTable("fixed_asset_audit_logs", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id")
    .references(() => fixedAssets.id, { onDelete: "cascade" })
    .notNull(),
  eventType: text("event_type").notNull(), // acquisition, depreciation, disposal, transfer, impairment, revaluation
  description: text("description").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  createdById: integer("created_by_id")
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations for Fixed Assets

export const fixedAssetCategoriesRelations = relations(fixedAssetCategories, ({ one }) => ({
  company: one(companies, {
    fields: [fixedAssetCategories.companyId],
    references: [companies.id],
  }),
}));

export const fixedAssetsRelations = relations(fixedAssets, ({ one, many }) => ({
  company: one(companies, {
    fields: [fixedAssets.companyId],
    references: [companies.id],
  }),
  store: one(stores, {
    fields: [fixedAssets.storeId],
    references: [stores.id],
  }),
  depreciationLogs: many(fixedAssetDepreciationLogs),
  movements: many(fixedAssetMovements),
  auditLogs: many(fixedAssetAuditLogs),
}));

export const fixedAssetDepreciationLogsRelations = relations(fixedAssetDepreciationLogs, ({ one }) => ({
  asset: one(fixedAssets, {
    fields: [fixedAssetDepreciationLogs.assetId],
    references: [fixedAssets.id],
  }),
}));

export const fixedAssetMovementsRelations = relations(fixedAssetMovements, ({ one }) => ({
  asset: one(fixedAssets, {
    fields: [fixedAssetMovements.assetId],
    references: [fixedAssets.id],
  }),
  fromStore: one(stores, {
    fields: [fixedAssetMovements.fromStoreId],
    references: [stores.id],
  }),
  toStore: one(stores, {
    fields: [fixedAssetMovements.toStoreId],
    references: [stores.id],
  }),
  createdBy: one(users, {
    fields: [fixedAssetMovements.createdById],
    references: [users.id],
  }),
}));

export const fixedAssetAuditLogsRelations = relations(fixedAssetAuditLogs, ({ one }) => ({
  asset: one(fixedAssets, {
    fields: [fixedAssetAuditLogs.assetId],
    references: [fixedAssets.id],
  }),
  createdBy: one(users, {
    fields: [fixedAssetAuditLogs.createdById],
    references: [users.id],
  }),
}));


export const savedReports = pgTable("saved_reports", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  reportType: text("report_type").notNull(), // e.g. 'sales', 'financial', 'ar', 'ap'
  filters: text("filters").notNull(), // JSON filters string
  createdByUserId: integer("created_by_user_id")
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const savedReportsRelations = relations(savedReports, ({ one }) => ({
  company: one(companies, {
    fields: [savedReports.companyId],
    references: [companies.id],
  }),
  createdByUser: one(users, {
    fields: [savedReports.createdByUserId],
    references: [users.id],
  }),
}));




