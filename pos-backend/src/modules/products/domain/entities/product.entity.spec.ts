import { Product, ProductPrice } from './product.entity';
import { Barcode } from '../value-objects/barcode.vo';
import { Money } from '../value-objects/money.vo';
import { randomUUID } from 'crypto';
import { ProductCreatedEvent } from '../events/product-created.event';

describe('Product Entity', () => {
  it('should create a valid product using static factory and record event', () => {
    const product = Product.create(
      randomUUID(),
      'Test Product',
      'TEST-SKU-1',
      null,
      null,
      'EA',
      true,
      'Description'
    );

    expect(product.name).toBe('Test Product');
    expect(product.sku).toBe('TEST-SKU-1');
    expect(product.isActive).toBe(true);
    expect(product.domainEvents.length).toBe(1);
    expect(product.domainEvents[0]).toBeInstanceOf(ProductCreatedEvent);
    expect(product.domainEvents[0].sku).toBe('TEST-SKU-1');
  });

  it('should add a barcode successfully', () => {
    const product = Product.create(randomUUID(), 'Test', 'SKU-2', null, null, 'EA', true);
    const barcode = new Barcode('123456789012', 'UPC', true);

    product.addBarcode(barcode);

    expect(product.barcodes.length).toBe(1);
    expect(product.barcodes[0].value).toBe('123456789012');
  });

  it('should remove a barcode successfully', () => {
    const product = Product.create(randomUUID(), 'Test', 'SKU-2', null, null, 'EA', true);
    const barcode = new Barcode('123456789012', 'UPC', true);
    product.addBarcode(barcode);
    expect(product.barcodes.length).toBe(1);

    product.removeBarcode('123456789012');
    expect(product.barcodes.length).toBe(0);
  });

  it('should throw an error when adding a duplicate barcode', () => {
    const product = Product.create(randomUUID(), 'Test', 'SKU-3', null, null, 'EA', true);
    const barcode = new Barcode('123456789012', 'UPC', true);

    product.addBarcode(barcode);

    expect(() => product.addBarcode(barcode)).toThrow('Barcode already exists for this product');
  });

  it('should add a price successfully', () => {
    const product = Product.create(randomUUID(), 'Test', 'SKU-4', null, null, 'EA', true);
    const price = new ProductPrice(randomUUID(), new Money(10.50, 'USD'), 'RETAIL');

    product.addPrice(price);

    expect(product.prices.length).toBe(1);
    expect(product.prices[0].price.amount).toBe(10.50);
  });

  it('should correctly deactivate and activate the product', () => {
    const product = Product.create(randomUUID(), 'Test', 'SKU-5', null, null, 'EA', true);
    product.deactivate();
    expect(product.isActive).toBe(false);
    product.activate();
    expect(product.isActive).toBe(true);
  });

  it('should correctly update details', () => {
    const product = Product.create(randomUUID(), 'Test', 'SKU-6', null, null, 'EA', true);
    product.updateDetails('New Name', 'New Description', 'KG');
    expect(product.name).toBe('New Name');
    expect(product.description).toBe('New Description');
    expect(product.unitOfMeasure).toBe('KG');
  });
});
