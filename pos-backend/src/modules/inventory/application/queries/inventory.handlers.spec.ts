import { GetStockAvailabilityHandler } from './inventory.handlers';
import { GetStockAvailabilityQuery } from './inventory.queries';
import { IInventoryLedgerRepository } from '../../domain/repositories/inventory.repository.interface';

describe('Inventory Query Handlers', () => {
  let mockLedgerRepo: jest.Mocked<IInventoryLedgerRepository>;

  beforeEach(() => {
    mockLedgerRepo = {
      save: jest.fn(),
      calculateStockOnHand: jest.fn(),
    };
  });

  describe('GetStockAvailabilityHandler', () => {
    it('should return calculated stock', async () => {
      mockLedgerRepo.calculateStockOnHand.mockResolvedValue(50);
      const handler = new GetStockAvailabilityHandler(mockLedgerRepo);

      const result = await handler.execute(new GetStockAvailabilityQuery('prod1', 'wh1'));

      expect(result.onHand).toBe(50);
      expect(result.available).toBe(50);
      expect(mockLedgerRepo.calculateStockOnHand).toHaveBeenCalledWith('prod1', 'wh1');
    });
  });
});
