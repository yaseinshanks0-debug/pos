import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ReceiveStockCommand } from './receive-stock.command';
import { ICostLayerRepository, IInventoryLedgerRepository } from '../../domain/repositories/inventory.repository.interface';
import { CostLayer } from '../../domain/entities/cost-layer.entity';
import { InventoryLedgerEntry } from '../../domain/entities/inventory-ledger.entity';
import { Quantity } from '../../domain/value-objects/quantity.vo';
import { Money } from '../../../products/domain/value-objects/money.vo';
import { randomUUID } from 'crypto';
import { StockReceivedEvent } from '../../domain/events/stock-received.event';

@CommandHandler(ReceiveStockCommand)
export class ReceiveStockHandler implements ICommandHandler<ReceiveStockCommand> {
  constructor(
    @Inject(ICostLayerRepository)
    private readonly costLayerRepo: ICostLayerRepository,
    @Inject(IInventoryLedgerRepository)
    private readonly ledgerRepo: IInventoryLedgerRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ReceiveStockCommand): Promise<void> {
    const qty = new Quantity(command.quantity);
    if (!qty.isPositive()) {
      throw new Error('Receive quantity must be positive');
    }

    const cost = new Money(command.unitCost, command.currency);

    // 1. Create the new FIFO Cost Layer
    const layer = new CostLayer(
      randomUUID(),
      command.productId,
      command.warehouseId,
      qty,
      qty,
      cost,
      new Date(),
      'OPEN',
      command.referenceDocumentId
    );

    await this.costLayerRepo.save(layer);

    // 2. Create the Ledger Entry
    const ledgerEntry = InventoryLedgerEntry.createMovement(
      randomUUID(),
      command.productId,
      command.warehouseId,
      'PURCHASE',
      qty,
      command.referenceDocumentId
    );

    await this.ledgerRepo.save(ledgerEntry);

    // 3. Publish Event
    this.eventBus.publish(new StockReceivedEvent(
      command.productId,
      command.warehouseId,
      command.quantity,
      command.unitCost,
      command.referenceDocumentId
    ));
  }
}
