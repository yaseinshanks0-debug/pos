import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateProductCommand } from './create-product.command';
import { IProductRepository } from '../../domain/repositories/product.repository.interface';
import { Product, ProductPrice } from '../../domain/entities/product.entity';
import { Barcode } from '../../domain/value-objects/barcode.vo';
import { Money } from '../../domain/value-objects/money.vo';
import { randomUUID } from 'crypto';

@CommandHandler(CreateProductCommand)
export class CreateProductHandler implements ICommandHandler<CreateProductCommand> {
  constructor(
    @Inject(IProductRepository)
    private readonly productRepository: IProductRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateProductCommand): Promise<string> {
    const existingProduct = await this.productRepository.findBySku(command.sku);
    if (existingProduct) {
      throw new Error(`Product with SKU ${command.sku} already exists.`);
    }

    const productId = randomUUID();
    const product = Product.create(
      productId,
      command.name,
      command.sku,
      command.categoryId,
      command.brandId,
      command.unitOfMeasure,
      command.isTracked,
      command.description || null
    );

    if (command.barcodes) {
      command.barcodes.forEach((b) => {
        product.addBarcode(new Barcode(b.value, b.type, b.isPrimary));
      });
    }

    if (command.initialPrices) {
      command.initialPrices.forEach((p) => {
        const money = new Money(p.price, p.currency);
        product.addPrice(
          new ProductPrice(
            randomUUID(),
            money,
            p.priceTier,
            p.storeId || null
          )
        );
      });
    }

    await this.productRepository.save(product);

    // Publish all accumulated domain events (e.g., ProductCreatedEvent)
    product.domainEvents.forEach(event => this.eventBus.publish(event));
    product.clearEvents();

    return productId;
  }
}
