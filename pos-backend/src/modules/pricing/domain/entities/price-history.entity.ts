import { AggregateRoot } from '../../../products/domain/entities/aggregate-root';
import { Money } from '../../../products/domain/value-objects/money.vo';

export class PriceHistoryRecord extends AggregateRoot {
  constructor(
    public readonly id: string,
    public readonly entityType: 'STORE_PRICE' | 'CUSTOMER_PRICE' | 'PROMOTION' | 'BASE_PRICE',
    public readonly entityId: string,
    public readonly newPrice: Money,
    public readonly changedAt: Date,
    public readonly reason?: string,
    public readonly oldPrice?: Money,
    public readonly userId?: string,
    public readonly approvedBy?: string
  ) {
    super();
  }
}
