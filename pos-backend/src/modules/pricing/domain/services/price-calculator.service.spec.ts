import { PriceCalculatorService, PricingContext } from './price-calculator.service';
import { Money } from '../../../products/domain/value-objects/money.vo';
import { Promotion } from '../entities/promotion.entity';
import { TaxCode } from '../entities/tax.entity';
import { randomUUID } from 'crypto';

describe('PriceCalculatorService', () => {
  let calculator: PriceCalculatorService;

  beforeEach(() => {
    calculator = new PriceCalculatorService();
  });

  it('should calculate base price with tax', () => {
    const tax = new TaxCode(randomUUID(), 'VAT', 'VAT', 0.10); // 10%
    const context: PricingContext = {
      basePrice: new Money(100),
      promotions: [],
      taxes: [tax],
      calculationDate: new Date(),
    };
    const finalPrice = calculator.calculateFinalPrice(context);
    expect(finalPrice.amount).toBe(110);
  });

  it('should calculate price with promo and tax', () => {
    const promo = new Promotion(randomUUID(), '10% Off', 'PERCENTAGE', 10, new Date('2020-01-01'), new Date('2099-01-01'));
    const tax = new TaxCode(randomUUID(), 'VAT', 'VAT', 0.10); // 10%

    const context: PricingContext = {
      basePrice: new Money(100),
      promotions: [promo],
      taxes: [tax],
      calculationDate: new Date(),
    };

    // Base 100 -> Promo 10% off = 90. Tax 10% of 90 = 9. Total = 99.
    const finalPrice = calculator.calculateFinalPrice(context);
    expect(finalPrice.amount).toBe(99);
  });
});
