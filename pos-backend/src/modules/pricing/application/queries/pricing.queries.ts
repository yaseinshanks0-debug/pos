export class CalculateFinalPriceQuery {
  constructor(
    public readonly productId: string,
    public readonly storeId: string,
    public readonly priceLevelId: string, // RETAIL, VIP, etc.
    public readonly quantity: number = 1
  ) {}
}
