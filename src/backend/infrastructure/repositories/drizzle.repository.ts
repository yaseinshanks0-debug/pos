// src/backend/infrastructure/repositories/drizzle.repository.ts

import { eq, and, sql } from "drizzle-orm";
import { db } from "../../../db/index.ts";
import * as schema from "../../../db/schema.ts";
import { 
  IRepository, 
  ITransferOrderRepository, 
  IInventoryRepository, 
  IGiftCardRepository,
  IUserRepository
} from "../../domain/repository.interface.ts";

// Complete 44-entity table mapping registry
export const TableRegistry: Record<string, any> = {
  companies: schema.companies,
  stores: schema.stores,
  warehouses: schema.warehouses,
  roles: schema.roles,
  permissions: schema.permissions,
  rolePermissions: schema.rolePermissions,
  users: schema.users,
  employees: schema.employees,
  customerGroups: schema.customerGroups,
  customers: schema.customers,
  vendors: schema.vendors,
  categories: schema.categories,
  departments: schema.departments,
  taxRules: schema.taxRules,
  products: schema.products,
  productVariants: schema.productVariants,
  inventory: schema.inventory,
  inventoryMovements: schema.inventoryMovements,
  purchaseOrders: schema.purchaseOrders,
  purchaseOrderItems: schema.purchaseOrderItems,
  transferOrders: schema.transferOrders,
  transferOrderItems: schema.transferOrderItems,
  cashDrawers: schema.cashDrawers,
  shifts: schema.shifts,
  sales: schema.sales,
  saleItems: schema.saleItems,
  payments: schema.payments,
  invoices: schema.invoices,
  receipts: schema.receipts,
  loyaltyTransactions: schema.loyaltyTransactions,
  storeExchangeLogs: schema.storeExchangeLogs,
  auditLogs: schema.auditLogs,
  notifications: schema.notifications,
  settings: schema.settings,
  generalLedgerEntries: schema.generalLedgerEntries,
  attachments: schema.attachments,
  salesReturns: schema.salesReturns,
  returnItems: schema.returnItems,
  exchanges: schema.exchanges,
  storeCreditTransactions: schema.storeCreditTransactions,
  giftCards: schema.giftCards,
  giftCardTransactions: schema.giftCardTransactions,
  offlineSyncConflicts: schema.offlineSyncConflicts,
  inventorySnapshots: schema.inventorySnapshots,
  inventoryCostLayers: schema.inventoryCostLayers,
  inventoryCostLayerConsumptions: schema.inventoryCostLayerConsumptions,
  storePrices: schema.storePrices,
  inventoryCountSessions: schema.inventoryCountSessions,
  inventoryCountItems: schema.inventoryCountItems,
    inventoryAdjustments: schema.inventoryAdjustments,
  inventoryAdjustmentItems: schema.inventoryAdjustmentItems,
  storeExchangeBatches: schema.storeExchangeBatches,
  storeExchangeBatchItems: schema.storeExchangeBatchItems,
  syncCheckpoints: schema.syncCheckpoints,
  syncConflicts: schema.syncConflicts,
  offlineTransactionQueue: schema.offlineTransactionQueue,
  synchronizationAuditLogs: schema.synchronizationAuditLogs,
  fiscalYears: schema.fiscalYears,
  accountingPeriods: schema.accountingPeriods,
  fiscalCloseRuns: schema.fiscalCloseRuns,
  accountingLockAuditLogs: schema.accountingLockAuditLogs,
  bankAccounts: schema.bankAccounts,
  vendorInvoices: schema.vendorInvoices,
  vendorInvoiceItems: schema.vendorInvoiceItems,
  vendorPayments: schema.vendorPayments,
  customerInvoices: schema.customerInvoices,
  customerInvoiceItems: schema.customerInvoiceItems,
  customerReceipts: schema.customerReceipts,
  bankReconciliations: schema.bankReconciliations,
  bankTransactions: schema.bankTransactions,
  creditNotes: schema.creditNotes,
  currencies: schema.currencies,
  exchangeRates: schema.exchangeRates,
  budgets: schema.budgets,
  budgetPeriods: schema.budgetPeriods,
  budgetRevisions: schema.budgetRevisions,
  cashTransfers: schema.cashTransfers,
  cashTransactions: schema.cashTransactions,
  fixedAssetCategories: schema.fixedAssetCategories,
  fixedAssets: schema.fixedAssets,
  fixedAssetDepreciationLogs: schema.fixedAssetDepreciationLogs,
  fixedAssetMovements: schema.fixedAssetMovements,
  fixedAssetAuditLogs: schema.fixedAssetAuditLogs,
  savedReports: schema.savedReports,
};

export class DrizzleRepository<T> implements IRepository<T> {
  constructor(
    protected readonly tableName: string,
    protected readonly txContext: any = null
  ) {}

  protected get db() {
    return this.txContext || db;
  }

  protected get table() {
    const table = TableRegistry[this.tableName];
    if (!table) {
      throw new Error(`Entity "${this.tableName}" is not registered in the TableRegistry.`);
    }
    return table;
  }

  public async findById(id: number): Promise<T | null> {
    const result = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.id, id));
    return (result[0] as T) || null;
  }

  public async findAll(filters?: Record<string, any>): Promise<T[]> {
    let query = this.db.select().from(this.table);
    if (filters && Object.keys(filters).length > 0) {
      const conditions: any[] = [];
      for (const [key, val] of Object.entries(filters)) {
        if (this.table[key]) {
          conditions.push(eq(this.table[key], val));
        }
      }
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }
    const result = await query;
    return result as T[];
  }

  public async create(data: Partial<T>): Promise<T> {
    let payload = { ...data } as any;
    if (this.tableName === "auditLogs") {
      if (payload.entityName && !payload.tableName) {
        payload.tableName = payload.entityName;
      }
      if (payload.entityId && !payload.recordId) {
        payload.recordId = payload.entityId;
      }
    }
    const result = await this.db
      .insert(this.table)
      .values(payload)
      .returning();
    return result[0] as T;
  }

  public async update(id: number, data: Partial<T>): Promise<T> {
    const result = await this.db
      .update(this.table)
      .set(data)
      .where(eq(this.table.id, id))
      .returning();
    return result[0] as T;
  }

  public async delete(id: number): Promise<boolean> {
    const result = await this.db
      .delete(this.table)
      .where(eq(this.table.id, id))
      .returning();
    return result.length > 0;
  }
}

// Specialized Drizzle Transfer Order Repository Implementation
export class DrizzleTransferOrderRepository 
  extends DrizzleRepository<any> 
  implements ITransferOrderRepository 
{
  constructor(txContext: any = null) {
    super("transferOrders", txContext);
  }

  public async findByNumber(transferNumber: string): Promise<any | null> {
    const result = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.transferNumber, transferNumber));
    return result[0] || null;
  }

  public async getPendingApproval(): Promise<any[]> {
    return this.db
      .select()
      .from(this.table)
      .where(eq(this.table.status, "draft"));
  }

  public async findWithItems(id: number): Promise<any | null> {
    const transfer = await this.findById(id);
    if (!transfer) return null;

    const items = await this.db
      .select()
      .from(schema.transferOrderItems)
      .where(eq(schema.transferOrderItems.transferOrderId, id));

    return { ...transfer, items };
  }
}

// Specialized Drizzle Inventory Repository Implementation
export class DrizzleInventoryRepository 
  extends DrizzleRepository<any> 
  implements IInventoryRepository 
{
  constructor(txContext: any = null) {
    super("inventory", txContext);
  }

  public async findByStoreAndProduct(
    storeId: number, 
    productId: number, 
    variantId?: number
  ): Promise<any | null> {
    const conditions = [
      eq(this.table.productId, productId)
    ];
    if (variantId !== undefined) {
      conditions.push(eq(this.table.variantId, variantId));
    }
    const query = this.db
      .select()
      .from(this.table)
      .where(and(...conditions));
    
    const result = await query;
    return result[0] || null;
  }

  public async findByWarehouseAndProduct(
    warehouseId: number, 
    productId: number, 
    variantId?: number | null
  ): Promise<any | null> {
    const conditions = [
      eq(this.table.warehouseId, warehouseId),
      eq(this.table.productId, productId)
    ];
    if (variantId) {
      conditions.push(eq(this.table.variantId, variantId));
    } else {
      conditions.push(sql`${this.table.variantId} IS NULL`);
    }

    const result = await this.db
      .select()
      .from(this.table)
      .where(and(...conditions));
    return result[0] || null;
  }

  public async adjustStock(
    warehouseId: number,
    productId: number,
    variantId: number | null,
    quantityDelta: number,
    reason: string,
    userId: number
  ): Promise<any> {
    let stock = await this.findByWarehouseAndProduct(warehouseId, productId, variantId);
    
    if (!stock) {
      stock = await this.create({
        warehouseId,
        productId,
        variantId,
        quantity: quantityDelta,
        reorderLevel: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else {
      stock = await this.update(stock.id, {
        quantity: stock.quantity + quantityDelta,
        updatedAt: new Date(),
      });
    }

    // Lookup cost price for inventory movement log
    let costPrice = "0.00";
    if (variantId) {
      const variant = await this.db
        .select()
        .from(schema.productVariants)
        .where(eq(schema.productVariants.id, variantId));
      if (variant[0] && variant[0].costPrice) {
        costPrice = variant[0].costPrice;
      } else {
        const prod = await this.db
          .select()
          .from(schema.products)
          .where(eq(schema.products.id, productId));
        if (prod[0]) {
          costPrice = prod[0].costPrice;
        }
      }
    } else {
      const prod = await this.db
        .select()
        .from(schema.products)
        .where(eq(schema.products.id, productId));
      if (prod[0]) {
        costPrice = prod[0].costPrice;
      }
    }

    // Record movement audit
    await this.db.insert(schema.inventoryMovements).values({
      inventoryId: stock.id,
      type: "adjustment",
      quantity: quantityDelta,
      unitCost: costPrice,
      reasonCode: reason,
      referenceType: "manual_adjustment",
      referenceId: userId,
      userId: userId,
      createdAt: new Date(),
    });

    return stock;
  }
}

// Specialized Drizzle Gift Card Repository Implementation
export class DrizzleGiftCardRepository 
  extends DrizzleRepository<any> 
  implements IGiftCardRepository 
{
  constructor(txContext: any = null) {
    super("giftCards", txContext);
  }

  public async findByCardNumber(cardNumber: string): Promise<any | null> {
    const result = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.cardNumber, cardNumber));
    return result[0] || null;
  }

  public async recordTransaction(
    giftCardId: number, 
    type: string, 
    amount: number, 
    referenceId?: number
  ): Promise<any> {
    const card = await this.findById(giftCardId);
    if (!card) throw new Error(`Gift Card ID ${giftCardId} not found`);

    const newBalance = Number(card.currentBalance) + amount;

    // Update balance
    await this.update(giftCardId, {
      currentBalance: String(newBalance),
      updatedAt: new Date(),
    });

    // Insert log
    const txLog = await this.db
      .insert(schema.giftCardTransactions)
      .values({
        giftCardId,
        type,
        amount: String(amount),
        balanceAfter: String(newBalance),
        referenceType: referenceId ? "sale" : "manual",
        referenceId: referenceId || null,
        createdAt: new Date(),
      })
      .returning();

    return txLog[0];
  }
}

// Specialized Drizzle User Repository Implementation
export class DrizzleUserRepository 
  extends DrizzleRepository<any> 
  implements IUserRepository 
{
  constructor(txContext: any = null) {
    super("users", txContext);
  }

  public async findByEmail(email: string): Promise<any | null> {
    const result = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.email, email.toLowerCase().trim()));
    return result[0] || null;
  }

  public async findByResetToken(token: string): Promise<any | null> {
    const result = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.passwordResetToken, token));
    return result[0] || null;
  }

  public async getUserWithRoleAndPermissions(userId: number): Promise<any | null> {
    const user = await this.findById(userId);
    if (!user) return null;

    // Get the user's role
    const role = await this.db
      .select()
      .from(schema.roles)
      .where(eq(schema.roles.id, user.roleId));
    
    if (role.length === 0) {
      return { ...user, role: null, permissions: [] };
    }

    // Get permissions associated with this role
    const userRolePermissions = await this.db
      .select({
        permissionName: schema.permissions.name
      })
      .from(schema.rolePermissions)
      .innerJoin(
        schema.permissions,
        eq(schema.rolePermissions.permissionId, schema.permissions.id)
      )
      .where(eq(schema.rolePermissions.roleId, user.roleId));

    const permissionNames = userRolePermissions.map((rp: any) => rp.permissionName);

    return {
      ...user,
      role: role[0],
      permissions: permissionNames
    };
  }
}
