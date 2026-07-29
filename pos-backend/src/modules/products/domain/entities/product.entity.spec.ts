import { Product, ProductPrice } from './product.entity';
import { Barcode } from '../value-objects/barcode.vo';
import { Money } from '../value-objects/money.vo';
import { randomUUID } from 'crypto';

describe('Product Entity', () => {
  it('should create a valid product', () => {
    const product = new Product(
      randomUUID(),
      'Test Product',
      'TEST-SKU-1',
      null,
      null,
      'EA',
      true,
      true
    );

    expect(product.name).toBe('Test Product');
    expect(product.sku).toBe('TEST-SKU-1');
    expect(product.isActive).toBe(true);
  });

  it('should add a barcode successfully', () => {
    const product = new Product(randomUUID(), 'Test', 'SKU-2', null, null, 'EA', true, true);
    const barcode = new Barcode('123456789012', 'UPC', true);

    product.addBarcode(barcode);

    expect(product.barcodes.length).toBe(1);
    expect(product.barcodes[0].value).toBe('123456789012');
  });

  it('should throw an error when adding a duplicate barcode', () => {
    const product = new Product(randomUUID(), 'Test', 'SKU-3', null, null, 'EA', true, true);
    const barcode = new Barcode('123456789012', 'UPC', true);

    product.addBarcode(barcode);

    expect(() => product.addBarcode(barcode)).toThrow('Barcode already exists for this product');
  });

  it('should add a price successfully', () => {
    const product = new Product(randomUUID(), 'Test', 'SKU-4', null, null, 'EA', true, true);
    const price = new ProductPrice(randomUUID(), new Money(10.50, 'USD'), 'RETAIL');

    product.addPrice(price);

    expect(product.prices.length).toBe(1);
    expect(product.prices[0].price.amount).toBe(10.50);
  });

  it('should correctly deactivate the product', () => {
    const product = new Product(randomUUID(), 'Test', 'SKU-5', null, null, 'EA', true, true);
    product.deactivate();
    expect(product.isActive).toBe(false);
  });
});
