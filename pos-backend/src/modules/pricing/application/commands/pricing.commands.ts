export class SetStorePriceCommand {
  constructor(
    public readonly productId: string,
    public readonly storeId: string,
    public readonly priceLevelId: string,
    public readonly priceAmount: number,
    public readonly currency: string = 'USD'
  ) {}
}

export class CreatePromotionCommand {
  constructor(
    public readonly name: string,
    public readonly type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'BOGO' | 'MIX_MATCH',
    public readonly value: number,
    public readonly startDate: Date,
    public readonly endDate: Date,
    public readonly productIds: string[],
    public readonly priority: number = 0,
    public readonly isStackable: boolean = false
  ) {}
}
