export class ReserveStockCommand {
  constructor(
    public readonly productId: string,
    public readonly warehouseId: string,
    public readonly quantity: number,
    public readonly referenceDocumentId: string, // e.g., Order ID
    public readonly ttlMinutes: number = 30
  ) {}
}

export class ReleaseReservationCommand {
  constructor(
    public readonly reservationId: string
  ) {}
}
