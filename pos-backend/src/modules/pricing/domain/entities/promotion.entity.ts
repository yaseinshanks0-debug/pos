import { AggregateRoot } from '../../../products/domain/entities/aggregate-root';
import { Money } from '../../../products/domain/value-objects/money.vo';

export type PromotionType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'BOGO' | 'MIX_MATCH';

export class Promotion extends AggregateRoot {
  constructor(
    public readonly id: string,
    public name: string,
    public type: PromotionType,
    public value: number,
    public startDate: Date,
    public endDate: Date,
    public priority: number = 0,
    public isStackable: boolean = false,
    public isActive: boolean = true,
    public readonly timeOfDayStart?: string,
    public readonly timeOfDayEnd?: string,
    public readonly daysOfWeek?: string // Comma separated integers e.g. "1,2,3" for Mon,Tue,Wed
  ) {
    super();
    if (value < 0) {
      throw new Error('Promotion value cannot be negative');
    }
  }

  isValidAt(date: Date): boolean {
    if (!this.isActive) return false;
    if (date < this.startDate || date > this.endDate) return false;

    // Time of day check
    if (this.timeOfDayStart && this.timeOfDayEnd) {
      const timeStr = date.toTimeString().split(' ')[0]; // HH:MM:SS
      if (timeStr < this.timeOfDayStart || timeStr > this.timeOfDayEnd) {
        return false;
      }
    }

    // Days of week check (0 = Sunday, 1 = Monday)
    if (this.daysOfWeek) {
      const day = date.getDay().toString();
      const validDays = this.daysOfWeek.split(',');
      if (!validDays.includes(day)) {
        return false;
      }
    }

    return true;
  }

  applyDiscount(basePrice: Money): Money {
    if (this.type === 'PERCENTAGE') {
      const discountAmount = basePrice.amount * (this.value / 100);
      return new Money(Math.max(0, basePrice.amount - discountAmount), basePrice.currency);
    } else if (this.type === 'FIXED_AMOUNT') {
      return new Money(Math.max(0, basePrice.amount - this.value), basePrice.currency);
    }
    // Complex promos like BOGO are handled in cart engine, but here we just return base
    return basePrice;
  }
}
