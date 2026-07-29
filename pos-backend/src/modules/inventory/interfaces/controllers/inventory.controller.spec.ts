import { Test, TestingModule } from '@nestjs/testing';
import { InventoryController } from './inventory.controller';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ReceiveStockDto, ConsumeStockDto } from '../dtos/inventory.dto';

describe('InventoryController', () => {
  let controller: InventoryController;
  let mockCommandBus: jest.Mocked<CommandBus>;
  let mockQueryBus: jest.Mocked<QueryBus>;

  beforeEach(async () => {
    mockCommandBus = { execute: jest.fn() } as any;
    mockQueryBus = { execute: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        { provide: CommandBus, useValue: mockCommandBus },
        { provide: QueryBus, useValue: mockQueryBus },
      ],
    }).compile();

    controller = module.get<InventoryController>(InventoryController);
  });

  it('should receive stock', async () => {
    const dto: ReceiveStockDto = { productId: '1', warehouseId: 'w1', quantity: 10, unitCost: 5 };
    const result = await controller.receiveStock(dto);
    expect(result).toEqual({ success: true });
    expect(mockCommandBus.execute).toHaveBeenCalled();
  });

  it('should consume stock', async () => {
    const dto: ConsumeStockDto = { productId: '1', warehouseId: 'w1', quantity: 2, movementType: 'SALE' };
    const result = await controller.consumeStock(dto);
    expect(result).toEqual({ success: true });
    expect(mockCommandBus.execute).toHaveBeenCalled();
  });

  it('should get availability', async () => {
    mockQueryBus.execute.mockResolvedValue({ onHand: 10 });
    const result = await controller.getAvailability('w1', 'p1');
    expect(result).toEqual({ onHand: 10 });
    expect(mockQueryBus.execute).toHaveBeenCalled();
  });
});
