import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gt, lte } from 'drizzle-orm';
import { IStorePriceRepository, IPromotionRepository } from '../../domain/repositories/pricing.repository.interface';
import { StorePrice } from '../../domain/entities/price.entity';
import { Promotion } from '../../domain/entities/promotion.entity';
import { Money } from '../../../products/domain/value-objects/money.vo';
import * as schema from '../../../../infrastructure/database/schema/pricing.schema';
import { DATABASE_CONNECTION } from '../../../products/infrastructure/repositories/product.repository';

@Injectable()
export class StorePriceRepository implements IStorePriceRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: NodePgDatabase<typeof schema>) {}

  async findActiveByProductAndStore(productId: string, storeId: string, priceLevelId: string): Promise<StorePrice | null> {
    const row = await this.db.query.storePrices.findFirst({
      where: and(
        eq(schema.storePrices.productId, productId),
        eq(schema.storePrices.storeId, storeId),
        eq(schema.storePrices.priceLevelId, priceLevelId),
        eq(schema.storePrices.isActive, true)
      ),
    });

    if (!row) return null;
    return new StorePrice(row.id, row.productId, row.storeId, row.priceLevelId, new Money(parseFloat(row.price), row.currency), row.effectiveDate, row.endDate, row.isActive);
  }

  async save(storePrice: StorePrice): Promise<void> {
    await this.db.insert(schema.storePrices).values({
      id: storePrice.id,
      productId: storePrice.productId,
      storeId: storePrice.storeId,
      priceLevelId: storePrice.priceLevelId,
      price: storePrice.price.amount.toString(),
      currency: storePrice.price.currency,
      effectiveDate: storePrice.effectiveDate,
      endDate: storePrice.endDate,
      isActive: storePrice.isActive,
    });
  }
}

@Injectable()
export class PromotionRepository implements IPromotionRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: NodePgDatabase<typeof schema>) {}

  async findActivePromotionsForProduct(productId: string): Promise<Promotion[]> {
    // Requires a join in Drizzle to find promos linked to the product
    const rows = await this.db.select({
      id: schema.promotionRules.id,
      name: schema.promotionRules.name,
      type: schema.promotionRules.type,
      value: schema.promotionRules.value,
      startDate: schema.promotionRules.startDate,
      endDate: schema.promotionRules.endDate,
      priority: schema.promotionRules.priority,
      isStackable: schema.promotionRules.isStackable,
      isActive: schema.promotionRules.isActive,
      timeOfDayStart: schema.promotionRules.timeOfDayStart,
      timeOfDayEnd: schema.promotionRules.timeOfDayEnd,
      daysOfWeek: schema.promotionRules.daysOfWeek,
    })
    .from(schema.promotionRules)
    .innerJoin(schema.promotionProducts, eq(schema.promotionRules.id, schema.promotionProducts.promotionId))
    .where(and(
      eq(schema.promotionProducts.productId, productId),
      eq(schema.promotionRules.isActive, true)
    ));

    return rows.map(r => new Promotion(
      r.id, r.name, r.type as any, parseFloat(r.value), r.startDate, r.endDate, r.priority, r.isStackable, r.isActive, r.timeOfDayStart || undefined, r.timeOfDayEnd || undefined, r.daysOfWeek || undefined
    ));
  }

  async save(promotion: Promotion): Promise<void> {
    await this.db.insert(schema.promotionRules).values({
      id: promotion.id,
      name: promotion.name,
      type: promotion.type,
      value: promotion.value.toString(),
      startDate: promotion.startDate,
      endDate: promotion.endDate,
      priority: promotion.priority,
      isStackable: promotion.isStackable,
      isActive: promotion.isActive,
    });
  }
}
