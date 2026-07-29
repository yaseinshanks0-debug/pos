import { Test, TestingModule } from '@nestjs/testing';
import { PricingController } from './pricing.controller';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { SetStorePriceDto, CreatePromotionDto } from '../dtos/pricing.dto';

describe('PricingController', () => {
  let controller: PricingController;
  let mockCommandBus: jest.Mocked<CommandBus>;
  let mockQueryBus: jest.Mocked<QueryBus>;

  beforeEach(async () => {
    mockCommandBus = { execute: jest.fn() } as any;
    mockQueryBus = { execute: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PricingController],
      providers: [
        { provide: CommandBus, useValue: mockCommandBus },
        { provide: QueryBus, useValue: mockQueryBus },
      ],
    }).compile();

    controller = module.get<PricingController>(PricingController);
  });

  it('should set store price', async () => {
    const dto: SetStorePriceDto = { productId: 'p1', storeId: 's1', priceLevelId: 'pl1', priceAmount: 90 };
    mockCommandBus.execute.mockResolvedValue('test-id');
    const result = await controller.setStorePrice(dto);
    expect(result).toEqual({ success: true, id: 'test-id' });
    expect(mockCommandBus.execute).toHaveBeenCalled();
  });

  it('should create promotion', async () => {
    const dto: CreatePromotionDto = { name: 'Promo', type: 'PERCENTAGE', value: 10, startDate: '2021-01-01', endDate: '2021-12-31', productIds: ['p1'] };
    mockCommandBus.execute.mockResolvedValue('test-id');
    const result = await controller.createPromotion(dto);
    expect(result).toEqual({ success: true, id: 'test-id' });
    expect(mockCommandBus.execute).toHaveBeenCalled();
  });

  it('should calculate final price', async () => {
    mockQueryBus.execute.mockResolvedValue({ finalAmount: 80 });
    const result = await controller.calculatePrice('p1', 's1', 'pl1', 1);
    expect(result).toEqual({ finalAmount: 80 });
    expect(mockQueryBus.execute).toHaveBeenCalled();
  });
});
