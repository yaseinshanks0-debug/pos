import { SetStorePriceHandler, CreatePromotionHandler } from './pricing.handlers';
import { SetStorePriceCommand, CreatePromotionCommand } from './pricing.commands';
import { IStorePriceRepository, IPromotionRepository } from '../../domain/repositories/pricing.repository.interface';

describe('Pricing Command Handlers', () => {
  let mockStorePriceRepo: jest.Mocked<IStorePriceRepository>;
  let mockPromoRepo: jest.Mocked<IPromotionRepository>;

  beforeEach(() => {
    mockStorePriceRepo = {
      findActiveByProductAndStore: jest.fn(),
      save: jest.fn(),
    };
    mockPromoRepo = {
      findActivePromotionsForProduct: jest.fn(),
      save: jest.fn(),
    };
  });

  describe('SetStorePriceHandler', () => {
    it('should save a store price', async () => {
      const handler = new SetStorePriceHandler(mockStorePriceRepo);
      const id = await handler.execute(new SetStorePriceCommand('prod1', 'store1', 'level1', 50));
      expect(id).toBeDefined();
      expect(mockStorePriceRepo.save).toHaveBeenCalled();
    });
  });

  describe('CreatePromotionHandler', () => {
    it('should save a promotion', async () => {
      const handler = new CreatePromotionHandler(mockPromoRepo);
      const id = await handler.execute(new CreatePromotionCommand('10% off', 'PERCENTAGE', 10, new Date(), new Date(), ['prod1']));
      expect(id).toBeDefined();
      expect(mockPromoRepo.save).toHaveBeenCalled();
    });
  });
});
