import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CalculateFinalPriceQuery } from './pricing.queries';
import { IStorePriceRepository, IPromotionRepository } from '../../domain/repositories/pricing.repository.interface';
import { PriceCalculatorService, PricingContext } from '../../domain/services/price-calculator.service';
import { IProductRepository } from '../../../products/domain/repositories/product.repository.interface';
import { Money } from '../../../../products/domain/value-objects/money.vo';

@QueryHandler(CalculateFinalPriceQuery)
export class CalculateFinalPriceHandler implements IQueryHandler<CalculateFinalPriceQuery> {
  constructor(
    @Inject(IStorePriceRepository)
    private readonly storePriceRepo: IStorePriceRepository,
    @Inject(IPromotionRepository)
    private readonly promotionRepo: IPromotionRepository,
    @Inject(IProductRepository)
    private readonly productRepo: IProductRepository,
  ) {}

  async execute(query: CalculateFinalPriceQuery) {
    const product = await this.productRepo.findById(query.productId);
    if (!product) throw new Error('Product not found');

    const basePriceEntity = product.prices.find(p => p.priceTier === 'RETAIL') || product.prices[0];
    if (!basePriceEntity) throw new Error('Base price not found for product');

    const storePrice = await this.storePriceRepo.findActiveByProductAndStore(query.productId, query.storeId, query.priceLevelId);
    const activePromotions = await this.promotionRepo.findActivePromotionsForProduct(query.productId);

    const context: PricingContext = {
      basePrice: basePriceEntity.price,
      storeOverridePrice: storePrice ? storePrice.price : undefined,
      promotions: activePromotions,
      taxes: [], // Fully implemented Tax Rules would be pulled from a TaxRepository here
      calculationDate: new Date(),
    };

    const calculator = new PriceCalculatorService();
    const finalPrice = calculator.calculateFinalPrice(context);

    return {
      productId: query.productId,
      finalAmount: finalPrice.amount,
      currency: finalPrice.currency,
    };
  }
}
