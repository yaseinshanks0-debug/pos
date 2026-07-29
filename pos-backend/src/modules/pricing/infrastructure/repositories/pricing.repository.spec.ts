import { StorePriceRepository, PromotionRepository } from './pricing.repository';
import { StorePrice } from '../../domain/entities/price.entity';
import { Promotion } from '../../domain/entities/promotion.entity';
import { Money } from '../../../products/domain/value-objects/money.vo';
import { randomUUID } from 'crypto';

describe('Pricing Repositories', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      query: {
        storePrices: { findFirst: jest.fn() }
      },
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
    };
  });

  describe('StorePriceRepository', () => {
    it('should find active store price', async () => {
      mockDb.query.storePrices.findFirst.mockResolvedValue({
        id: '1', productId: 'p1', storeId: 's1', priceLevelId: 'pl1', price: '90.50', currency: 'USD', effectiveDate: new Date(), isActive: true
      });

      const repo = new StorePriceRepository(mockDb);
      const price = await repo.findActiveByProductAndStore('p1', 's1', 'pl1');
      expect(price?.price.amount).toBe(90.5);
    });

    it('should return null if not found', async () => {
      mockDb.query.storePrices.findFirst.mockResolvedValue(null);
      const repo = new StorePriceRepository(mockDb);
      const price = await repo.findActiveByProductAndStore('p1', 's1', 'pl1');
      expect(price).toBeNull();
    });

    it('should save store price', async () => {
      const repo = new StorePriceRepository(mockDb);
      const price = new StorePrice('1', 'p1', 's1', 'pl1', new Money(90), new Date(), null);
      await repo.save(price);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('PromotionRepository', () => {
    it('should find active promos', async () => {
      mockDb.where.mockResolvedValue([
        { id: '1', name: 'Promo', type: 'PERCENTAGE', value: '10', startDate: new Date(), endDate: new Date(), priority: 0, isStackable: false, isActive: true }
      ]);
      const repo = new PromotionRepository(mockDb);
      const promos = await repo.findActivePromotionsForProduct('p1');
      expect(promos.length).toBe(1);
      expect(promos[0].value).toBe(10);
    });

    it('should save promo', async () => {
      const repo = new PromotionRepository(mockDb);
      const promo = new Promotion('1', 'Promo', 'PERCENTAGE', 10, new Date(), new Date());
      await repo.save(promo);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });
});
