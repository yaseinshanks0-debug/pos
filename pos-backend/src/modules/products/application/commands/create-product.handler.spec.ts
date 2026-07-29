import { CreateProductHandler } from './create-product.handler';
import { CreateProductCommand } from './create-product.command';
import { IProductRepository } from '../../domain/repositories/product.repository.interface';
import { Product } from '../../domain/entities/product.entity';
import { randomUUID } from 'crypto';
import { EventBus } from '@nestjs/cqrs';

describe('CreateProductHandler', () => {
  let handler: CreateProductHandler;
  let mockProductRepo: jest.Mocked<IProductRepository>;
  let mockEventBus: jest.Mocked<EventBus>;

  beforeEach(() => {
    mockProductRepo = {
      findById: jest.fn(),
      findBySku: jest.fn(),
      findByBarcode: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockEventBus = {
      publish: jest.fn(),
      publishAll: jest.fn(),
    } as any;

    handler = new CreateProductHandler(mockProductRepo, mockEventBus);
  });

  it('should successfully create a product', async () => {
    mockProductRepo.findBySku.mockResolvedValue(null);

    const command = new CreateProductCommand(
      'Test Product',
      'SKU-TEST-1',
      null,
      null,
      'EA',
      true,
      'A description',
      [{ value: '123', type: 'UPC', isPrimary: true }],
      [{ price: 10.99, currency: 'USD', priceTier: 'RETAIL' }]
    );

    const productId = await handler.execute(command);

    expect(productId).toBeDefined();
    expect(mockProductRepo.save).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);

    const savedProduct = mockProductRepo.save.mock.calls[0][0] as Product;
    expect(savedProduct.name).toBe('Test Product');
    expect(savedProduct.sku).toBe('SKU-TEST-1');
    expect(savedProduct.barcodes.length).toBe(1);
    expect(savedProduct.prices.length).toBe(1);
  });

  it('should throw an error if SKU already exists', async () => {
    const existingProduct = Product.create(randomUUID(), 'Existing', 'SKU-TEST-1', null, null, 'EA', true);
    mockProductRepo.findBySku.mockResolvedValue(existingProduct);

    const command = new CreateProductCommand(
      'Test Product',
      'SKU-TEST-1',
      null,
      null,
      'EA',
      true
    );

    await expect(handler.execute(command)).rejects.toThrow('Product with SKU SKU-TEST-1 already exists.');
    expect(mockProductRepo.save).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
});
