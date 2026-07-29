import { AggregateRoot } from '../../../products/domain/entities/aggregate-root';
import { Quantity } from '../value-objects/quantity.vo';

export type MovementType = 'PURCHASE' | 'SALE' | 'RETURN' | 'ADJUSTMENT' | 'TRANSFER_IN' | 'TRANSFER_OUT';

export class InventoryLedgerEntry extends AggregateRoot {
  constructor(
    public readonly id: string,
    public readonly productId: string,
    public readonly warehouseId: string,
    public readonly movementType: MovementType,
    public readonly quantity: Quantity,
    public readonly locationId: string | null = null,
    public readonly referenceDocumentId: string | null = null,
    public readonly notes: string | null = null,
    public readonly createdAt: Date = new Date()
  ) {
    super();
  }

  static createMovement(
    id: string,
    productId: string,
    warehouseId: string,
    movementType: MovementType,
    quantity: Quantity,
    referenceDocumentId: string | null = null
  ): InventoryLedgerEntry {
    return new InventoryLedgerEntry(
      id,
      productId,
      warehouseId,
      movementType,
      quantity,
      null,
      referenceDocumentId
    );
  }
}
