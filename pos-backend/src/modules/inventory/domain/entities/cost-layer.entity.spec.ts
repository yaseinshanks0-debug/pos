import { CostLayer } from './cost-layer.entity';
import { Quantity } from '../value-objects/quantity.vo';
import { Money } from '../../../products/domain/value-objects/money.vo';
import { randomUUID } from 'crypto';

describe('CostLayer Entity', () => {
  it('should partially consume and remain OPEN', () => {
    const layer = new CostLayer(randomUUID(), randomUUID(), randomUUID(), new Quantity(10), new Quantity(10), new Money(5), new Date(), 'OPEN');
    const consumed = layer.consume(new Quantity(4));

    expect(consumed.value).toBe(4);
    expect(layer.remainingQuantity.value).toBe(6);
    expect(layer.status).toBe('OPEN');
  });

  it('should fully consume and switch to DEPLETED', () => {
    const layer = new CostLayer(randomUUID(), randomUUID(), randomUUID(), new Quantity(10), new Quantity(10), new Money(5), new Date(), 'OPEN');
    const consumed = layer.consume(new Quantity(15)); // Try to consume more than available

    expect(consumed.value).toBe(10);
    expect(layer.remainingQuantity.value).toBe(0);
    expect(layer.status).toBe('DEPLETED');
  });

  it('should throw if consuming negative', () => {
    const layer = new CostLayer(randomUUID(), randomUUID(), randomUUID(), new Quantity(10), new Quantity(10), new Money(5), new Date(), 'OPEN');
    expect(() => layer.consume(new Quantity(-5))).toThrow('Consumption quantity must be positive');
  });
});
