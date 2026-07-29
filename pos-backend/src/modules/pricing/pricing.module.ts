import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PricingController } from './interfaces/controllers/pricing.controller';
import { SetStorePriceHandler, CreatePromotionHandler } from './application/commands/pricing.handlers';
import { CalculateFinalPriceHandler } from './application/queries/pricing.handlers';
import { StorePriceRepository, PromotionRepository } from './infrastructure/repositories/pricing.repository';
import { IStorePriceRepository, IPromotionRepository } from './domain/repositories/pricing.repository.interface';
import { DATABASE_CONNECTION, ProductRepository } from '../products/infrastructure/repositories/product.repository';
import { IProductRepository } from '../products/domain/repositories/product.repository.interface';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../../infrastructure/database/schema/pricing.schema';

const commandHandlers = [SetStorePriceHandler, CreatePromotionHandler];
const queryHandlers = [CalculateFinalPriceHandler];

@Module({
  imports: [CqrsModule],
  controllers: [PricingController],
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
      provide: IStorePriceRepository,
      useClass: StorePriceRepository,
    },
    {
      provide: IPromotionRepository,
      useClass: PromotionRepository,
    },
    {
      provide: IProductRepository,
      useClass: ProductRepository,
    },
  ],
})
export class PricingModule {}
