import { StorePrice } from '../entities/price.entity';
import { Promotion } from '../entities/promotion.entity';

export interface IStorePriceRepository {
  findActiveByProductAndStore(productId: string, storeId: string, priceLevelId: string): Promise<StorePrice | null>;
  save(storePrice: StorePrice): Promise<void>;
}
export const IStorePriceRepository = Symbol('IStorePriceRepository');

export interface IPromotionRepository {
  findActivePromotionsForProduct(productId: string): Promise<Promotion[]>;
  save(promotion: Promotion): Promise<void>;
}
export const IPromotionRepository = Symbol('IPromotionRepository');
