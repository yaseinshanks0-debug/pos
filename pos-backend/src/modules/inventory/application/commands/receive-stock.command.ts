export class ReceiveStockCommand {
  constructor(
    public readonly productId: string,
    public readonly warehouseId: string,
    public readonly quantity: number,
    public readonly unitCost: number,
    public readonly currency: string = 'USD',
    public readonly referenceDocumentId: string | null = null,
    public readonly notes: string | null = null
  ) {}
}

export class ConsumeStockCommand {
  constructor(
    public readonly productId: string,
    public readonly warehouseId: string,
    public readonly quantityToConsume: number,
    public readonly movementType: 'SALE' | 'ADJUSTMENT' | 'TRANSFER_OUT',
    public readonly referenceDocumentId: string | null = null
  ) {}
}
