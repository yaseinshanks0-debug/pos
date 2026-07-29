import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { InventoryController } from './interfaces/controllers/inventory.controller';
import { ReceiveStockHandler } from './application/commands/receive-stock.handler';
import { ConsumeStockHandler } from './application/commands/consume-stock.handler';
import { ReserveStockHandler, ReleaseReservationHandler } from './application/commands/reserve-stock.handler';
import { GetStockAvailabilityHandler } from './application/queries/inventory.handlers';
import { WarehouseRepository, CostLayerRepository, InventoryLedgerRepository } from './infrastructure/repositories/inventory.repository';
import { IWarehouseRepository, ICostLayerRepository, IInventoryLedgerRepository } from './domain/repositories/inventory.repository.interface';
import { DATABASE_CONNECTION } from '../products/infrastructure/repositories/product.repository';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../../infrastructure/database/schema/inventory.schema';

const commandHandlers = [ReceiveStockHandler, ConsumeStockHandler, ReserveStockHandler, ReleaseReservationHandler];
const queryHandlers = [GetStockAvailabilityHandler];

@Module({
  imports: [CqrsModule],
  controllers: [InventoryController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    {
      provide: DATABASE_CONNECTION,
      useFactory: () => {
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/pos',
        });
        return drizzle(pool, { schema });
      },
    },
    {
      provide: IWarehouseRepository,
      useClass: WarehouseRepository,
    },
    {
      provide: ICostLayerRepository,
      useClass: CostLayerRepository,
    },
    {
      provide: IInventoryLedgerRepository,
      useClass: InventoryLedgerRepository,
    },
  ],
})
export class InventoryModule {}
