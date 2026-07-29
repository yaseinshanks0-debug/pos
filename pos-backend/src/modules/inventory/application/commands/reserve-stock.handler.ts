import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ReserveStockCommand, ReleaseReservationCommand } from './reserve-stock.command';
import { IInventoryLedgerRepository } from '../../domain/repositories/inventory.repository.interface';
import { randomUUID } from 'crypto';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../../infrastructure/database/schema/inventory.schema';
import { DATABASE_CONNECTION } from '../../../products/infrastructure/repositories/product.repository';
import { eq, and } from 'drizzle-orm';

@CommandHandler(ReserveStockCommand)
export class ReserveStockHandler implements ICommandHandler<ReserveStockCommand> {
  constructor(
    @Inject(IInventoryLedgerRepository)
    private readonly ledgerRepo: IInventoryLedgerRepository,
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async execute(command: ReserveStockCommand): Promise<string> {
    if (command.quantity <= 0) {
      throw new Error('Reservation quantity must be positive');
    }

    // 1. Calculate available stock (On Hand - Reserved)
    const onHand = await this.ledgerRepo.calculateStockOnHand(command.productId, command.warehouseId);

    const reservedResult = await this.db.select({ sum: schema.inventoryReservations.quantity })
      .from(schema.inventoryReservations)
      .where(and(
        eq(schema.inventoryReservations.productId, command.productId),
        eq(schema.inventoryReservations.warehouseId, command.warehouseId),
        eq(schema.inventoryReservations.status, 'ACTIVE')
      ));

    const totalReserved = reservedResult.reduce((acc, curr) => acc + Number(curr.sum), 0);
    const available = onHand - totalReserved;

    if (available < command.quantity) {
      throw new Error(`Insufficient stock. Available: ${available}, Requested: ${command.quantity}`);
    }

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + command.ttlMinutes);

    const reservationId = randomUUID();

    await this.db.insert(schema.inventoryReservations).values({
      id: reservationId,
      productId: command.productId,
      warehouseId: command.warehouseId,
      quantity: command.quantity.toString(),
      referenceDocumentId: command.referenceDocumentId,
      expiresAt: expiresAt,
      status: 'ACTIVE'
    });

    return reservationId;
  }
}

@CommandHandler(ReleaseReservationCommand)
export class ReleaseReservationHandler implements ICommandHandler<ReleaseReservationCommand> {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async execute(command: ReleaseReservationCommand): Promise<void> {
    await this.db.update(schema.inventoryReservations)
      .set({ status: 'CANCELLED' })
      .where(eq(schema.inventoryReservations.id, command.reservationId));
  }
}
