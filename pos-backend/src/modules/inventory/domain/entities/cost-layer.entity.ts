import { AggregateRoot } from '../../../products/domain/entities/aggregate-root';
import { Quantity } from '../value-objects/quantity.vo';
import { Money } from '../../../products/domain/value-objects/money.vo';

export type LayerStatus = 'OPEN' | 'DEPLETED' | 'LOCKED';

export class CostLayer extends AggregateRoot {
  constructor(
    public readonly id: string,
    public readonly productId: string,
    public readonly warehouseId: string,
    public readonly initialQuantity: Quantity,
    public remainingQuantity: Quantity,
    public readonly unitCost: Money,
    public readonly receivedAt: Date,
    public status: LayerStatus,
    public readonly referenceDocumentId: string | null = null
  ) {
    super();
  }

  consume(quantityToConsume: Quantity): Quantity {
    if (this.status !== 'OPEN') {
      throw new Error('Cannot consume from a non-open layer');
    }

    if (quantityToConsume.isNegative() || quantityToConsume.isZero()) {
      throw new Error('Consumption quantity must be positive');
    }

    if (this.remainingQuantity.value >= quantityToConsume.value) {
      this.remainingQuantity = this.remainingQuantity.subtract(quantityToConsume);
      if (this.remainingQuantity.isZero()) {
        this.status = 'DEPLETED';
      }
      return quantityToConsume;
    } else {
      const consumed = this.remainingQuantity;
      this.remainingQuantity = new Quantity(0);
      this.status = 'DEPLETED';
      return consumed;
    }
  }
}
