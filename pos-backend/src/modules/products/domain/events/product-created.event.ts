export class ProductCreatedEvent {
  constructor(
    public readonly productId: string,
    public readonly sku: string,
    public readonly occurredAt: Date = new Date()
  ) {}
}
