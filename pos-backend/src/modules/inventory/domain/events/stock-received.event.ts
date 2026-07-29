export class StockReceivedEvent {
  constructor(
    public readonly productId: string,
    public readonly warehouseId: string,
    public readonly quantity: number,
    public readonly unitCost: number,
    public readonly referenceDocumentId: string | null
  ) {}
}

export class StockConsumedEvent {
  constructor(
    public readonly productId: string,
    public readonly warehouseId: string,
    public readonly quantity: number,
    public readonly referenceDocumentId: string | null
  ) {}
}
