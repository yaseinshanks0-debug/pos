import { Money } from '../../../products/domain/value-objects/money.vo';
import { Promotion } from '../entities/promotion.entity';
import { TaxCode } from '../entities/tax.entity';

export interface PricingContext {
  basePrice: Money;
  storeOverridePrice?: Money;
  customerOverridePrice?: Money;
  quantityBreakPrice?: Money;
  promotions: Promotion[];
  taxes: TaxCode[];
  calculationDate: Date;
}

export class PriceCalculatorService {
  /**
   * Deterministic calculation order:
   * Base -> Level -> Store -> Customer -> Quantity -> Promo -> Tax
   */
  public calculateFinalPrice(context: PricingContext): Money {
    let currentPrice = context.basePrice;

    if (context.storeOverridePrice) {
      currentPrice = context.storeOverridePrice;
    }

    if (context.customerOverridePrice) {
      currentPrice = context.customerOverridePrice;
    }

    if (context.quantityBreakPrice) {
      currentPrice = context.quantityBreakPrice;
    }

    let activePromotions = context.promotions.filter(p => p.isValidAt(context.calculationDate));
    activePromotions.sort((a, b) => b.priority - a.priority);

    for (const promo of activePromotions) {
      currentPrice = promo.applyDiscount(currentPrice);
      if (!promo.isStackable) {
        break;
      }
    }

    // Apply Taxes
    let totalTaxAmount = 0;
    let baseForCompound = currentPrice.amount;

    for (const tax of context.taxes) {
      if (tax.isCompound) {
        const compoundTax = baseForCompound * tax.rate;
        totalTaxAmount += compoundTax;
      } else {
        totalTaxAmount += currentPrice.amount * tax.rate;
      }
    }

    return new Money(currentPrice.amount + totalTaxAmount, currentPrice.currency);
  }
}
