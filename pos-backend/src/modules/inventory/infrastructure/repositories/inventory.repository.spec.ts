import { WarehouseRepository, CostLayerRepository, InventoryLedgerRepository } from './inventory.repository';
import { Warehouse } from '../../domain/entities/warehouse.entity';
import { CostLayer } from '../../domain/entities/cost-layer.entity';
import { Quantity } from '../../domain/value-objects/quantity.vo';
import { Money } from '../../../products/domain/value-objects/money.vo';
import { InventoryLedgerEntry } from '../../domain/entities/inventory-ledger.entity';

describe('Inventory Repositories', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      query: {
        warehouses: { findFirst: jest.fn(), findMany: jest.fn() },
        inventoryCostLayers: { findMany: jest.fn() },
      },
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
    };
  });

  describe('WarehouseRepository', () => {
    it('should find by id', async () => {
      const repo = new WarehouseRepository(mockDb);
      mockDb.query.warehouses.findFirst.mockResolvedValue({ id: '1', name: 'Main', code: 'WH1', isDefault: true, isActive: true });
      const wh = await repo.findById('1');
      expect(wh?.code).toBe('WH1');
    });

    it('should save', async () => {
      const repo = new WarehouseRepository(mockDb);
      await repo.save(Warehouse.create('1', 'Main', 'WH1'));
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('CostLayerRepository', () => {
    it('should find open layers mapped properly', async () => {
      const repo = new CostLayerRepository(mockDb);
      mockDb.query.inventoryCostLayers.findMany.mockResolvedValue([
        { id: '1', productId: 'p1', warehouseId: 'w1', initialQuantity: '10', remainingQuantity: '10', unitCost: '5.50', status: 'OPEN', receivedAt: new Date() }
      ]);
      const layers = await repo.findOpenLayersForProduct('p1', 'w1');
      expect(layers.length).toBe(1);
      expect(layers[0].remainingQuantity.value).toBe(10);
      expect(layers[0].unitCost.amount).toBe(5.50);
    });

    it('should update layer', async () => {
      const repo = new CostLayerRepository(mockDb);
      const layer = new CostLayer('1', 'p1', 'w1', new Quantity(10), new Quantity(5), new Money(10), new Date(), 'OPEN');
      await repo.update(layer);
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('InventoryLedgerRepository', () => {
    it('should calculate stock', async () => {
      const repo = new InventoryLedgerRepository(mockDb);
      mockDb.where.mockResolvedValue([{ sum: '25.5' }]);
      const stock = await repo.calculateStockOnHand('p1', 'w1');
      expect(stock).toBe(25.5);
    });

    it('should save entry', async () => {
      const repo = new InventoryLedgerRepository(mockDb);
      const entry = InventoryLedgerEntry.createMovement('1', 'p1', 'w1', 'SALE', new Quantity(-5));
      await repo.save(entry);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });
});
