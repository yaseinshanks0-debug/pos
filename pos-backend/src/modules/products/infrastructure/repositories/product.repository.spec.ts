import { ProductRepository, DATABASE_CONNECTION } from './product.repository';
import { Product } from '../../domain/entities/product.entity';
import { Barcode } from '../../domain/value-objects/barcode.vo';
import { Money } from '../../domain/value-objects/money.vo';
import { ProductPrice } from '../../domain/entities/product.entity';

describe('ProductRepository', () => {
  let repository: ProductRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      query: {
        products: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
        productBarcodes: {
          findFirst: jest.fn(),
        },
      },
      transaction: jest.fn(async (cb) => {
        const tx = {
          insert: jest.fn().mockReturnThis(),
          values: jest.fn(),
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          delete: jest.fn().mockReturnThis(),
        };
        await cb(tx);
      }),
      delete: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
    };

    repository = new ProductRepository(mockDb);
  });

  it('should find a product by ID', async () => {
    mockDb.query.products.findFirst.mockResolvedValue({ id: '1', name: 'Test', sku: 'SKU', barcodes: [], prices: [] });
    const product = await repository.findById('1');
    expect(product).toBeDefined();
    expect(product?.id).toBe('1');
  });

  it('should return null if product by ID not found', async () => {
    mockDb.query.products.findFirst.mockResolvedValue(null);
    const product = await repository.findById('1');
    expect(product).toBeNull();
  });

  it('should find a product by SKU', async () => {
    mockDb.query.products.findFirst.mockResolvedValue({ id: '1', name: 'Test', sku: 'SKU', barcodes: [], prices: [] });
    const product = await repository.findBySku('SKU');
    expect(product).toBeDefined();
    expect(product?.sku).toBe('SKU');
  });

  it('should return null if product by SKU not found', async () => {
    mockDb.query.products.findFirst.mockResolvedValue(null);
    const product = await repository.findBySku('SKU');
    expect(product).toBeNull();
  });

  it('should find a product by barcode', async () => {
    mockDb.query.productBarcodes.findFirst.mockResolvedValue({ productId: '1' });
    mockDb.query.products.findFirst.mockResolvedValue({ id: '1', name: 'Test', sku: 'SKU', barcodes: [], prices: [] });

    const product = await repository.findByBarcode('123');
    expect(product).toBeDefined();
    expect(product?.id).toBe('1');
  });

  it('should return null if barcode not found', async () => {
    mockDb.query.productBarcodes.findFirst.mockResolvedValue(null);
    const product = await repository.findByBarcode('123');
    expect(product).toBeNull();
  });

  it('should list products', async () => {
    mockDb.query.products.findMany.mockResolvedValue([{ id: '1', name: 'Test', sku: 'SKU', barcodes: [], prices: [] }]);
    const products = await repository.findAll(10, 0);
    expect(products.length).toBe(1);
    expect(products[0].id).toBe('1');
  });

  it('should save a product', async () => {
    const product = Product.create('1', 'Test', 'SKU', null, null, 'EA', true);
    product.addBarcode(new Barcode('123'));
    product.addPrice(new ProductPrice('2', new Money(100), 'RETAIL'));

    await repository.save(product);
    expect(mockDb.transaction).toHaveBeenCalled();
  });

  it('should update a product', async () => {
    const product = Product.create('1', 'Test', 'SKU', null, null, 'EA', true);
    product.addBarcode(new Barcode('123'));
    product.addPrice(new ProductPrice('2', new Money(100), 'RETAIL'));
    await repository.update(product);
    expect(mockDb.transaction).toHaveBeenCalled();
  });

  it('should delete a product', async () => {
    await repository.delete('1');
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it('should map from db row with related data', async () => {
      mockDb.query.products.findFirst.mockResolvedValue({
          id: '1', name: 'Test', sku: 'SKU',
          barcodes: [{ barcode: '123', barcodeType: 'UPC', isPrimary: true }],
          prices: [{ id: 'p1', price: '10.50', currency: 'USD', priceTier: 'RETAIL' }]
      });
      const product = await repository.findById('1');
      expect(product).toBeDefined();
      expect(product?.barcodes.length).toBe(1);
      expect(product?.prices.length).toBe(1);
  });
});
