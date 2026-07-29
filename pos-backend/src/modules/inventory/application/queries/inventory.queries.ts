export class GetStockAvailabilityQuery {
  constructor(
    public readonly productId: string,
    public readonly warehouseId: string
  ) {}
}
