import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ConsumeStockCommand } from './receive-stock.command';
import { ICostLayerRepository, IInventoryLedgerRepository } from '../../domain/repositories/inventory.repository.interface';
import { InventoryLedgerEntry } from '../../domain/entities/inventory-ledger.entity';
import { Quantity } from '../../domain/value-objects/quantity.vo';
import { randomUUID } from 'crypto';
import { StockConsumedEvent } from '../../domain/events/stock-received.event';

@CommandHandler(ConsumeStockCommand)
export class ConsumeStockHandler implements ICommandHandler<ConsumeStockCommand> {
  constructor(
    @Inject(ICostLayerRepository)
    private readonly costLayerRepo: ICostLayerRepository,
    @Inject(IInventoryLedgerRepository)
    private readonly ledgerRepo: IInventoryLedgerRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ConsumeStockCommand): Promise<void> {
    const qtyToConsume = new Quantity(command.quantityToConsume);
    if (!qtyToConsume.isPositive()) {
      throw new Error('Consumption quantity must be positive');
    }

    // Pessimistic lock is applied inside the repository (FOR UPDATE)
    const openLayers = await this.costLayerRepo.findOpenLayersForProduct(command.productId, command.warehouseId);

    let remainingToConsume = qtyToConsume.value;

    for (const layer of openLayers) {
      if (remainingToConsume <= 0) break;

      const layerConsumed = layer.consume(new Quantity(remainingToConsume));
      remainingToConsume -= layerConsumed.value;

      await this.costLayerRepo.update(layer);

      // Note: In a full production implementation, we would also insert records into `inventory_layer_consumptions`
      // mapping exactly which cost layers were consumed by this specific sale/ledger entry.
    }

    if (remainingToConsume > 0) {
      throw new Error(`Insufficient stock. Short by ${remainingToConsume}. Negative inventory protection triggered.`);
    }

    // Create the negative ledger entry
    const ledgerEntry = InventoryLedgerEntry.createMovement(
      randomUUID(),
      command.productId,
      command.warehouseId,
      command.movementType,
      new Quantity(-command.quantityToConsume), // Negative movement
      command.referenceDocumentId
    );

    await this.ledgerRepo.save(ledgerEntry);

    this.eventBus.publish(new StockConsumedEvent(
      command.productId,
      command.warehouseId,
      command.quantityToConsume,
      command.referenceDocumentId
    ));
  }
}
