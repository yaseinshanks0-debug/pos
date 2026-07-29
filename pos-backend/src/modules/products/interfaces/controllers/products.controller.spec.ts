import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateProductDto } from '../dtos/create-product.dto';

describe('ProductsController', () => {
  let controller: ProductsController;
  let mockCommandBus: jest.Mocked<CommandBus>;
  let mockQueryBus: jest.Mocked<QueryBus>;

  beforeEach(async () => {
    mockCommandBus = { execute: jest.fn() } as any;
    mockQueryBus = { execute: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        { provide: CommandBus, useValue: mockCommandBus },
        { provide: QueryBus, useValue: mockQueryBus },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  it('should create a product', async () => {
    const dto: CreateProductDto = { name: 'Test', sku: 'SKU' };
    mockCommandBus.execute.mockResolvedValue('test-id');

    const result = await controller.createProduct(dto);
    expect(result).toEqual({ id: 'test-id' });
    expect(mockCommandBus.execute).toHaveBeenCalled();
  });

  it('should list products', async () => {
    mockQueryBus.execute.mockResolvedValue([]);
    const result = await controller.listProducts(10, 0);
    expect(result).toEqual([]);
    expect(mockQueryBus.execute).toHaveBeenCalled();
  });

  it('should get a product', async () => {
    mockQueryBus.execute.mockResolvedValue({ id: 'test-id' });
    const result = await controller.getProduct('test-id');
    expect(result).toEqual({ id: 'test-id' });
    expect(mockQueryBus.execute).toHaveBeenCalled();
  });

  it('should get a product by barcode', async () => {
    mockQueryBus.execute.mockResolvedValue({ id: 'test-id' });
    const result = await controller.getProductByBarcode('12345');
    expect(result).toEqual({ id: 'test-id' });
    expect(mockQueryBus.execute).toHaveBeenCalled();
  });
});
