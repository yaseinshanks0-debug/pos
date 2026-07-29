import { GetProductHandler, GetProductByBarcodeHandler, ListProductsHandler } from './get-product.handler';
import { GetProductQuery, GetProductByBarcodeQuery, ListProductsQuery } from './get-product.query';
import { IProductRepository } from '../../domain/repositories/product.repository.interface';
import { Product } from '../../domain/entities/product.entity';

describe('Query Handlers', () => {
  let mockProductRepo: jest.Mocked<IProductRepository>;

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
  });

  describe('GetProductHandler', () => {
    it('should return a mapped product DTO by ID', async () => {
      const handler = new GetProductHandler(mockProductRepo);
      const product = Product.create('1', 'Test', 'SKU', null, null, 'EA', true);
      mockProductRepo.findById.mockResolvedValue(product);

      const result = await handler.execute(new GetProductQuery('1'));
      expect(result).toBeDefined();
      expect(result?.id).toBe('1');
      expect(result?.name).toBe('Test');
      expect(mockProductRepo.findById).toHaveBeenCalledWith('1');
    });

    it('should return null if not found', async () => {
      const handler = new GetProductHandler(mockProductRepo);
      mockProductRepo.findById.mockResolvedValue(null);

      const result = await handler.execute(new GetProductQuery('1'));
      expect(result).toBeNull();
    });
  });

  describe('GetProductByBarcodeHandler', () => {
    it('should return a mapped product DTO by Barcode', async () => {
      const handler = new GetProductByBarcodeHandler(mockProductRepo);
      const product = Product.create('1', 'Test', 'SKU', null, null, 'EA', true);
      mockProductRepo.findByBarcode.mockResolvedValue(product);

      const result = await handler.execute(new GetProductByBarcodeQuery('12345'));
      expect(result).toBeDefined();
      expect(result?.id).toBe('1');
      expect(mockProductRepo.findByBarcode).toHaveBeenCalledWith('12345');
    });
  });

  describe('ListProductsHandler', () => {
    it('should return a list of mapped product DTOs', async () => {
      const handler = new ListProductsHandler(mockProductRepo);
      const product = Product.create('1', 'Test', 'SKU', null, null, 'EA', true);
      mockProductRepo.findAll.mockResolvedValue([product]);

      const result = await handler.execute(new ListProductsQuery(10, 0));
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('1');
      expect(mockProductRepo.findAll).toHaveBeenCalledWith(10, 0);
    });
  });
});
