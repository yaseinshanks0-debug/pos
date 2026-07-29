import { AggregateRoot } from '../../../products/domain/entities/aggregate-root';
import { Money } from '../../../products/domain/value-objects/money.vo';

export class TaxCode extends AggregateRoot {
  constructor(
    public readonly id: string,
    public readonly code: string,
    public readonly name: string,
    public readonly rate: number, // e.g. 0.085 for 8.5%
    public readonly isCompound: boolean = false,
    public readonly isActive: boolean = true
  ) {
    super();
  }

  calculateTax(amount: Money): Money {
    return new Money(amount.amount * this.rate, amount.currency);
  }
}
