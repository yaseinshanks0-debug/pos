import { AggregateRoot } from '../../../products/domain/entities/aggregate-root';
import { Money } from '../../../products/domain/value-objects/money.vo';

export class PriceLevel extends AggregateRoot {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly isActive: boolean = true,
    public readonly description: string | null = null
  ) {
    super();
  }
}

export class StorePrice extends AggregateRoot {
  constructor(
    public readonly id: string,
    public readonly productId: string,
    public readonly storeId: string,
    public readonly priceLevelId: string,
    public price: Money,
    public effectiveDate: Date,
    public endDate: Date | null,
    public isActive: boolean = true
  ) {
    super();
    if (price.amount < 0) {
      throw new Error('Price cannot be negative');
    }
  }

  updatePrice(newPrice: Money, effectiveDate: Date = new Date()): void {
    if (newPrice.amount < 0) {
      throw new Error('Price cannot be negative');
    }
    this.price = newPrice;
    this.effectiveDate = effectiveDate;
  }
}
