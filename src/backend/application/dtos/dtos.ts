// src/backend/application/dtos/dtos.ts

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
  timestamp: string;
}

// Transfer Order DTOs
export interface CreateTransferOrderItemDto {
  productId: number;
  variantId?: number;
  quantityRequest: number;
  notes?: string;
}

export interface CreateTransferOrderDto {
  transferNumber: string;
  sourceStoreId: number;
  sourceWarehouseId: number;
  destinationStoreId: number;
  destinationWarehouseId: number;
  notes?: string;
  items: CreateTransferOrderItemDto[];
  createdByUserId?: number;
}

export interface UpdateTransferOrderDto {
  notes?: string;
  status?: "draft" | "approved" | "in_transit" | "partially_received" | "received" | "cancelled";
  approvedByUserId?: number;
  receivedByUserId?: number;
  externalReference?: string;
}

// Sales Return DTOs
export interface CreateReturnItemDto {
  saleItemId?: number;
  productId: number;
  variantId?: number;
  qty: number;
  unitPrice: number;
  refundAmount: number;
  restocked: boolean;
  reasonCode?: string;
}

export interface CreateSalesReturnDto {
  returnNumber: string;
  saleId?: number;
  storeId: number;
  customerId?: number;
  cashierId: number;
  refundMethod: "cash" | "credit_card" | "store_credit" | "gift_card";
  notes?: string;
  items: CreateReturnItemDto[];
}

// Exchange DTOs
export interface CreateExchangeDto {
  exchangeNumber: string;
  storeId: number;
  customerId?: number;
  cashierId: number;
  returnId: number;
  newSaleId: number;
  differenceAmount: number;
  paymentStatus: "paid" | "refunded" | "even_exchange";
}

// Gift Card DTOs
export interface CreateGiftCardDto {
  companyId: number;
  cardNumber: string;
  initialBalance: number;
  expiryDate?: string;
  customerId?: number;
}

export interface GiftCardTxDto {
  giftCardId: number;
  type: "issue" | "redeem" | "refund_to_card" | "top_up" | "void";
  amount: number;
  referenceType?: "sale" | "return" | "manual";
  referenceId?: number;
  createdByUserId?: number;
}

// ==========================================
// Inventory Module DTOs
// ==========================================
export interface CreateProductDto {
  companyId: number;
  sku: string;
  barcode: string;
  name: string;
  description?: string;
  categoryId?: number;
  departmentId?: number;
  brand?: string;
  costPrice: number | string;
  retailPrice: number | string;
  taxCategoryId?: number;
  reorderPoint?: number;
}

export interface UpdateProductDto {
  name?: string;
  description?: string;
  categoryId?: number;
  departmentId?: number;
  brand?: string;
  costPrice?: number | string;
  retailPrice?: number | string;
  taxCategoryId?: number;
  reorderPoint?: number;
}

export interface CreateProductVariantDto {
  productId: number;
  sku: string;
  barcode: string;
  variantName: string;
  size?: string;
  color?: string;
  material?: string;
  costPrice?: number | string;
  retailPrice?: number | string;
  isActive?: boolean;
}

export interface UpdateProductVariantDto {
  variantName?: string;
  size?: string;
  color?: string;
  material?: string;
  costPrice?: number | string;
  retailPrice?: number | string;
  isActive?: boolean;
}

export interface CreateCategoryDto {
  companyId: number;
  name: string;
  parentId?: number;
}

export interface CreateDepartmentDto {
  companyId: number;
  name: string;
}

export interface InventoryAdjustmentDto {
  warehouseId: number;
  productId: number;
  variantId?: number;
  quantityDelta: number;
  reasonCode: "damaged" | "theft" | "audit_discrepancy" | "receiving_discrepancy" | "manual_correction" | string;
  userId: number;
}

export interface CreateInventorySnapshotDto {
  warehouseId: number;
  snapshotType: "daily" | "weekly" | "monthly" | "audit";
}

// ==========================================
// Purchasing Module DTOs
// ==========================================
export interface CreateVendorDto {
  companyId: number;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  paymentTerms?: string; // cash, net30, net60, etc.
  creditLimit?: number | string;
}

export interface UpdateVendorDto {
  name?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  paymentTerms?: string;
  creditLimit?: number | string;
  status?: "active" | "inactive";
}

export interface CreatePurchaseOrderItemDto {
  productId: number;
  variantId?: number;
  orderedQty: number;
  unitCost: number | string;
}

export interface CreatePurchaseOrderDto {
  companyId: number;
  poNumber: string;
  vendorId: number;
  storeId: number;
  notes?: string;
  items: CreatePurchaseOrderItemDto[];
}

export interface UpdatePurchaseOrderDto {
  notes?: string;
  status?: "draft" | "submitted" | "approved" | "sent" | "received" | "closed";
}

export interface ReceivePurchaseOrderItemDto {
  productId: number;
  variantId?: number;
  receivedQty: number;
}

export interface ReceivePurchaseOrderDto {
  warehouseId: number;
  receivedByUserId: number;
  items: ReceivePurchaseOrderItemDto[];
  notes?: string;
  forceClose?: boolean;
}

export interface RecordVendorCreditDto {
  vendorId: number;
  amount: number | string;
  reason: string;
}

// ==========================================
// POS & Cash Drawer Module DTOs
// ==========================================
export interface CreateSaleItemDto {
  productId: number;
  variantId?: number;
  qty: number;
  unitPrice: number | string;
  discountAmount?: number | string;
  taxAmount?: number | string;
}

export interface CreatePaymentPayloadDto {
  paymentMethod: "cash" | "credit_card" | "debit_card" | "mobile_wallet" | "store_credit" | "gift_card";
  amount: number | string;
  transactionRef?: string;
}

export interface CreateSaleDto {
  storeId: number;
  customerId?: number;
  cashierId: number;
  shiftId?: number;
  subtotal: number | string;
  discountAmount?: number | string;
  taxAmount?: number | string;
  totalAmount: number | string;
  payments: CreatePaymentPayloadDto[];
  items: CreateSaleItemDto[];
  pointsRedeemed?: number; // Loyalty points usage
  giftCardNumberUsed?: string; // Gift card redemption
  useStoreCredit?: boolean; // Consume customer's store credit (from customerId)
}

export interface OpenShiftDto {
  cashDrawerId: number;
  userId: number;
  openingCash: number | string;
}

export interface CloseShiftDto {
  actualCash: number | string;
}

export interface CreateCustomerDto {
  name: string;
  mobileNumber: string;
  email?: string;
  address?: string;
  birthDate?: string;
  customerGroupId?: number;
}

// ==========================================
// Synchronization Module DTOs
// ==========================================
export interface SyncOperationDto {
  entityType: "product" | "sale" | "transfer" | "customer" | "inventory";
  entityId: number;
  actionType: "create" | "update" | "delete";
  localVersion: number;
  localUpdatedAt: string;
  payload: Record<string, any>;
}

export interface SyncPayloadDto {
  storeId: number;
  operations: SyncOperationDto[];
}

export interface ResolveConflictDto {
  resolutionStrategy: "client_wins" | "server_wins" | "manual";
  resolvedByUserId: number;
  manualData?: Record<string, any>;
  notes?: string;
}

// ==========================================
// Reporting & Analytics Module DTOs
// ==========================================
export interface ReportFilterDto {
  startDate?: string;
  endDate?: string;
  storeId?: number;
  cashierId?: number;
  productId?: number;
  categoryId?: number;
  limit?: number;
  accountCode?: string;
  departmentId?: number;
}

// ==========================================
// Accounting & General Ledger Module DTOs
// ==========================================
export interface JournalEntryLineDto {
  accountCode: string;
  accountName: string;
  accountType: "assets" | "liabilities" | "equity" | "revenue" | "expenses";
  debit: number;
  credit: number;
}

export interface CreateJournalEntryDto {
  companyId: number;
  storeId?: number;
  referenceType: string;
  referenceId?: number;
  description: string;
  lines: JournalEntryLineDto[];
  createdAt?: string | Date;
}

export interface AccountingFilterDto {
  startDate?: string;
  endDate?: string;
  storeId?: number;
  accountCode?: string;
}

// Stage 2: Inventory Counts & Adjustments DTOs

export interface CountItemInputDto {
  productId: number;
  variantId?: number;
  countedQuantity: number;
  reasonCode?: string;
}

export interface CreateCountSessionDto {
  companyId: number;
  storeId: number;
  warehouseId: number;
  type: "cycle" | "full";
  notes?: string;
  createdByUserId: number;
}

export interface SubmitCountSessionDto {
  id: number;
  items: CountItemInputDto[];
  notes?: string;
}

export interface ApproveCountSessionDto {
  id: number;
  approvedByUserId: number;
}

export interface AdjustmentItemInputDto {
  productId: number;
  variantId?: number;
  quantityAdjusted: number; // positive for gain, negative for loss
  reasonCode: "shrinkage" | "damage" | "expiration" | "theft" | "manual_correction" | string;
}

export interface CreateInventoryAdjustmentDto {
  companyId: number;
  storeId: number;
  warehouseId: number;
  adjustmentNumber: string;
  type: "shrinkage" | "damage" | "expiration" | "theft" | "manual";
  notes?: string;
  items: AdjustmentItemInputDto[];
  createdByUserId: number;
}export interface CreateBankAccountDto {
  companyId: number;
  name: string;
  accountNumber: string;
  routingNumber?: string;
  bankName?: string;
  currency?: string;
  ledgerAccountCode: string;
}

export interface CreateVendorInvoiceItemDto {
  accountCode: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  taxAmount?: number;
}

export interface CreateVendorInvoiceDto {
  companyId: number;
  vendorId: number;
  invoiceNumber: string;
  invoiceDate: Date | string;
  dueDate: Date | string;
  taxAmount?: number;
  apControlAccountCode?: string;
  currencyCode?: string;
  exchangeRate?: number;
  items: CreateVendorInvoiceItemDto[];
}

export interface CreateVendorPaymentDto {
  companyId: number;
  vendorId: number;
  vendorInvoiceId?: number;
  bankAccountId: number;
  paymentDate: Date | string;
  paymentMethod: "bank" | "cash" | "cheque";
  referenceNumber?: string;
  amount: number;
  notes?: string;
  currencyCode?: string;
  exchangeRate?: number;
  currencyAmount?: number;
}

export interface CreateCustomerInvoiceItemDto {
  accountCode: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  taxAmount?: number;
}

export interface CreateCustomerInvoiceDto {
  companyId: number;
  customerId: number;
  invoiceNumber: string;
  invoiceDate: Date | string;
  dueDate: Date | string;
  taxAmount?: number;
  arControlAccountCode?: string;
  currencyCode?: string;
  exchangeRate?: number;
  items: CreateCustomerInvoiceItemDto[];
}

export interface CreateCustomerReceiptDto {
  companyId: number;
  customerId: number;
  customerInvoiceId?: number;
  bankAccountId: number;
  receiptDate: Date | string;
  paymentMethod: "bank" | "cash" | "cheque";
  referenceNumber?: string;
  amount: number;
  notes?: string;
  currencyCode?: string;
  exchangeRate?: number;
  currencyAmount?: number;
}

export interface CreateCreditNoteDto {
  companyId: number;
  type: "vendor" | "customer";
  entityId: number; // customerId or vendorId
  referenceInvoiceId?: number;
  creditNoteNumber: string;
  creditNoteDate: Date | string;
  amount: number;
  notes?: string;
}

export interface BankTransactionInputDto {
  transactionDate: Date | string;
  description: string;
  amount: number;
  referenceNumber?: string;
}

export interface ImportBankTransactionsDto {
  bankAccountId: number;
  transactions: BankTransactionInputDto[];
}

export interface MatchBankTransactionDto {
  bankTransactionId: number;
  matchedType: "payment" | "receipt" | "charge" | "interest";
  matchedReferenceId: number;
}

export interface PostReconciliationAdjustmentDto {
  bankTransactionId: number;
  ledgerAccountCode: string;
  reason: string;
  companyId: number;
}

export interface ReconcileBankAccountDto {
  bankAccountId: number;
  statementEndDate: Date | string;
  statementEndingBalance: number;
  performedByUserId: number;
}

export interface CreateCurrencyDto {
  code: string;
  name: string;
  symbol: string;
  isBase?: boolean;
  decimals?: number;
}

export interface SetExchangeRateDto {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  rateDate: Date | string;
}

export interface CreateBudgetDto {
  companyId: number;
  fiscalYearId: number;
  departmentId?: number;
  storeId?: number;
  accountCode: string;
  name: string;
  annualAmount: number;
  notes?: string;
  periodAmounts?: { periodId: number; amount: number }[]; // optional monthly breakdown
}

export interface ReviseBudgetDto {
  budgetId: number;
  revisedAmount: number;
  reason: string;
  revisedByUserId: number;
}

export interface CashTransferDto {
  companyId: number;
  sourceBankAccountId: number;
  destinationBankAccountId: number;
  amount: number;
  transferDate: Date | string;
  referenceNumber?: string;
  notes?: string;
}

export interface CashTransactionDto {
  companyId: number;
  bankAccountId: number;
  type: "cash_in" | "cash_out";
  amount: number;
  transactionDate: Date | string;
  referenceNumber?: string;
  description: string;
  ledgerAccountCode: string;
}

export interface CurrencyRevaluationDto {
  companyId: number;
  revaluationDate: Date | string;
  performedByUserId: number;
}


