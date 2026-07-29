import { ReceiveStockHandler } from './receive-stock.handler';
import { ConsumeStockHandler } from './consume-stock.handler';
import { ReceiveStockCommand, ConsumeStockCommand } from './receive-stock.command';
import { ICostLayerRepository, IInventoryLedgerRepository } from '../../domain/repositories/inventory.repository.interface';
import { EventBus } from '@nestjs/cqrs';
import { CostLayer } from '../../domain/entities/cost-layer.entity';
import { Quantity } from '../../domain/value-objects/quantity.vo';
import { Money } from '../../../products/domain/value-objects/money.vo';

describe('Inventory Command Handlers', () => {
  let mockCostLayerRepo: jest.Mocked<ICostLayerRepository>;
  let mockLedgerRepo: jest.Mocked<IInventoryLedgerRepository>;
  let mockEventBus: jest.Mocked<EventBus>;

  beforeEach(() => {
    mockCostLayerRepo = {
      findOpenLayersForProduct: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };
    mockLedgerRepo = {
      save: jest.fn(),
      calculateStockOnHand: jest.fn(),
    };
    mockEventBus = { publish: jest.fn() } as any;
  });

  describe('ReceiveStockHandler', () => {
    it('should receive stock and create layer and ledger', async () => {
      const handler = new ReceiveStockHandler(mockCostLayerRepo, mockLedgerRepo, mockEventBus);
      await handler.execute(new ReceiveStockCommand('prod1', 'wh1', 10, 5.00));

      expect(mockCostLayerRepo.save).toHaveBeenCalledTimes(1);
      expect(mockLedgerRepo.save).toHaveBeenCalledTimes(1);
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    });

    it('should throw on negative quantity', async () => {
      const handler = new ReceiveStockHandler(mockCostLayerRepo, mockLedgerRepo, mockEventBus);
      await expect(handler.execute(new ReceiveStockCommand('prod1', 'wh1', -10, 5.00))).rejects.toThrow();
    });
  });

  describe('ConsumeStockHandler', () => {
    it('should consume FIFO layers successfully', async () => {
      const handler = new ConsumeStockHandler(mockCostLayerRepo, mockLedgerRepo, mockEventBus);

      const layer1 = new CostLayer('1', 'prod1', 'wh1', new Quantity(5), new Quantity(5), new Money(10), new Date(), 'OPEN');
      const layer2 = new CostLayer('2', 'prod1', 'wh1', new Quantity(10), new Quantity(10), new Money(12), new Date(), 'OPEN');

      mockCostLayerRepo.findOpenLayersForProduct.mockResolvedValue([layer1, layer2]);

      await handler.execute(new ConsumeStockCommand('prod1', 'wh1', 8, 'SALE'));

      expect(mockCostLayerRepo.update).toHaveBeenCalledTimes(2);
      expect(layer1.status).toBe('DEPLETED');
      expect(layer1.remainingQuantity.value).toBe(0);
      expect(layer2.status).toBe('OPEN');
      expect(layer2.remainingQuantity.value).toBe(7); // 10 - 3
      expect(mockLedgerRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should throw if insufficient stock', async () => {
      const handler = new ConsumeStockHandler(mockCostLayerRepo, mockLedgerRepo, mockEventBus);
      const layer1 = new CostLayer('1', 'prod1', 'wh1', new Quantity(5), new Quantity(5), new Money(10), new Date(), 'OPEN');
      mockCostLayerRepo.findOpenLayersForProduct.mockResolvedValue([layer1]);

      await expect(handler.execute(new ConsumeStockCommand('prod1', 'wh1', 8, 'SALE')))
        .rejects.toThrow('Insufficient stock. Short by 3. Negative inventory protection triggered.');
    });
  });
});
