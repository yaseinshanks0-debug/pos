import { ReserveStockHandler, ReleaseReservationHandler } from './reserve-stock.handler';
import { ReserveStockCommand, ReleaseReservationCommand } from './reserve-stock.command';
import { IInventoryLedgerRepository } from '../../domain/repositories/inventory.repository.interface';

describe('Reserve Stock Handlers', () => {
  let mockLedgerRepo: jest.Mocked<IInventoryLedgerRepository>;
  let mockDb: any;

  beforeEach(() => {
    mockLedgerRepo = {
      save: jest.fn(),
      calculateStockOnHand: jest.fn(),
    };
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      values: jest.fn(),
    };
  });

  describe('ReserveStockHandler', () => {
    it('should reserve stock successfully', async () => {
      mockLedgerRepo.calculateStockOnHand.mockResolvedValue(100);
      mockDb.where.mockResolvedValue([{ sum: '20' }]); // 20 already reserved

      const handler = new ReserveStockHandler(mockLedgerRepo, mockDb);
      const command = new ReserveStockCommand('prod1', 'wh1', 10, 'order1');

      const id = await handler.execute(command);
      expect(id).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should throw if insufficient stock', async () => {
      mockLedgerRepo.calculateStockOnHand.mockResolvedValue(25);
      mockDb.where.mockResolvedValue([{ sum: '20' }]); // Available is 5

      const handler = new ReserveStockHandler(mockLedgerRepo, mockDb);
      const command = new ReserveStockCommand('prod1', 'wh1', 10, 'order1'); // Wants 10

      await expect(handler.execute(command)).rejects.toThrow('Insufficient stock');
    });
  });
});
