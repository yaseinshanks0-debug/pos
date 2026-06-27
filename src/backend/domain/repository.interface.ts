// src/backend/domain/repository.interface.ts

export interface IRepository<T> {
  findById(id: number): Promise<T | null>;
  findAll(filters?: Record<string, any>): Promise<T[]>;
  create(data: Partial<T>): Promise<T>;
  update(id: number, data: Partial<T>): Promise<T>;
  delete(id: number): Promise<boolean>;
}

// Specialized Transfer Order Repository Interface
export interface ITransferOrderRepository extends IRepository<any> {
  findByNumber(transferNumber: string): Promise<any | null>;
  getPendingApproval(): Promise<any[]>;
  findWithItems(id: number): Promise<any | null>;
}

// Specialized Inventory Repository Interface
export interface IInventoryRepository extends IRepository<any> {
  findByStoreAndProduct(storeId: number, productId: number, variantId?: number): Promise<any | null>;
  findByWarehouseAndProduct(warehouseId: number, productId: number, variantId?: number): Promise<any | null>;
  adjustStock(
    warehouseId: number,
    productId: number,
    variantId: number | null,
    quantityDelta: number,
    reason: string,
    userId: number
  ): Promise<any>;
}

// Specialized Gift Card Repository Interface
export interface IGiftCardRepository extends IRepository<any> {
  findByCardNumber(cardNumber: string): Promise<any | null>;
  recordTransaction(giftCardId: number, type: string, amount: number, referenceId?: number): Promise<any>;
}

// Specialized User Repository Interface
export interface IUserRepository extends IRepository<any> {
  findByEmail(email: string): Promise<any | null>;
  findByResetToken(token: string): Promise<any | null>;
  getUserWithRoleAndPermissions(userId: number): Promise<any | null>;
}
