import { CalculateFinalPriceHandler } from './pricing.handlers';
import { CalculateFinalPriceQuery } from './pricing.queries';
import { IStorePriceRepository, IPromotionRepository } from '../../domain/repositories/pricing.repository.interface';
import { IProductRepository } from '../../../products/domain/repositories/product.repository.interface';
import { StorePrice } from '../../domain/entities/price.entity';
import { Promotion } from '../../domain/entities/promotion.entity';
import { Product, ProductPrice } from '../../../products/domain/entities/product.entity';
import { Money } from '../../../products/domain/value-objects/money.vo';
import { randomUUID } from 'crypto';

describe('CalculateFinalPriceHandler', () => {
  let mockStorePriceRepo: jest.Mocked<IStorePriceRepository>;
  let mockPromoRepo: jest.Mocked<IPromotionRepository>;
  let mockProductRepo: jest.Mocked<IProductRepository>;
  let handler: CalculateFinalPriceHandler;

  beforeEach(() => {
    mockStorePriceRepo = {
      findActiveByProductAndStore: jest.fn(),
      save: jest.fn(),
    };
    mockPromoRepo = {
      findActivePromotionsForProduct: jest.fn(),
      save: jest.fn(),
    };
    mockProductRepo = {
      findById: jest.fn(),
      findBySku: jest.fn(),
      findByBarcode: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    handler = new CalculateFinalPriceHandler(mockStorePriceRepo, mockPromoRepo, mockProductRepo);
  });

  it('should calculate final price applying store overrides and promos', async () => {
    // Setup Base Product
    const product = Product.create('prod1', 'Test', 'SKU', null, null, 'EA', true);
    product.addPrice(new ProductPrice('price1', new Money(100), 'RETAIL'));
    mockProductRepo.findById.mockResolvedValue(product);

    // Setup Store Override
    const storeOverride = new StorePrice('sp1', 'prod1', 'store1', 'level1', new Money(90), new Date(), null);
    mockStorePriceRepo.findActiveByProductAndStore.mockResolvedValue(storeOverride);

    // Setup Promos (10% off)
    const promo = new Promotion(randomUUID(), '10% off', 'PERCENTAGE', 10, new Date('2020-01-01'), new Date('2099-01-01'));
    mockPromoRepo.findActivePromotionsForProduct.mockResolvedValue([promo]);

    const result = await handler.execute(new CalculateFinalPriceQuery('prod1', 'store1', 'level1', 1));

    expect(result.finalAmount).toBe(81); // Base: 100 -> Store: 90 -> Promo 10%: 81
    expect(result.currency).toBe('USD');
  });

  it('should throw if product missing', async () => {
    mockProductRepo.findById.mockResolvedValue(null);
    await expect(handler.execute(new CalculateFinalPriceQuery('prod1', 'store1', 'level1', 1))).rejects.toThrow('Product not found');
  });
});
