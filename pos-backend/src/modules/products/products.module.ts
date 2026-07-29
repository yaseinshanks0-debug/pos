import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ProductsController } from './interfaces/controllers/products.controller';
import { CreateProductHandler } from './application/commands/create-product.handler';
import { GetProductHandler, GetProductByBarcodeHandler, ListProductsHandler } from './application/queries/get-product.handler';
import { ProductRepository, DATABASE_CONNECTION } from './infrastructure/repositories/product.repository';
import { IProductRepository } from './domain/repositories/product.repository.interface';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../../infrastructure/database/schema/product.schema';

const commandHandlers = [CreateProductHandler];
const queryHandlers = [GetProductHandler, GetProductByBarcodeHandler, ListProductsHandler];

@Module({
  imports: [CqrsModule],
  controllers: [ProductsController],
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
      provide: IProductRepository,
      useClass: ProductRepository,
    },
  ],
})
export class ProductsModule {}
