import { Barcode } from './barcode.vo';
import { Money } from './money.vo';

describe('Value Objects', () => {
  describe('Barcode', () => {
    it('should create a valid barcode', () => {
      const barcode = new Barcode('123', 'UPC', true);
      expect(barcode.value).toBe('123');
      expect(barcode.type).toBe('UPC');
      expect(barcode.isPrimary).toBe(true);
    });

    it('should throw if value is empty', () => {
      expect(() => new Barcode('')).toThrow('Barcode value is required');
    });

    it('should equate same barcodes', () => {
      const b1 = new Barcode('123');
      const b2 = new Barcode('123');
      const b3 = new Barcode('456');
      expect(b1.equals(b2)).toBe(true);
      expect(b1.equals(b3)).toBe(false);
    });
  });

  describe('Money', () => {
    it('should create a valid money object', () => {
      const m = new Money(100, 'USD');
      expect(m.amount).toBe(100);
      expect(m.currency).toBe('USD');
    });

    it('should throw on negative amount', () => {
      expect(() => new Money(-1)).toThrow('Amount cannot be negative');
    });

    it('should equate same money values', () => {
      const m1 = new Money(100, 'USD');
      const m2 = new Money(100, 'USD');
      const m3 = new Money(100, 'EUR');
      const m4 = new Money(50, 'USD');
      expect(m1.equals(m2)).toBe(true);
      expect(m1.equals(m3)).toBe(false);
      expect(m1.equals(m4)).toBe(false);
    });
  });
});
