import { Quantity } from './quantity.vo';

describe('Quantity Value Object', () => {
  it('should create and add correctly', () => {
    const q1 = new Quantity(10);
    const q2 = new Quantity(5);
    const sum = q1.add(q2);
    expect(sum.value).toBe(15);
  });

  it('should correctly identify positive/negative', () => {
    expect(new Quantity(10).isPositive()).toBeTruthy();
    expect(new Quantity(-10).isNegative()).toBeTruthy();
    expect(new Quantity(0).isZero()).toBeTruthy();
  });
});
