import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { SetStorePriceCommand, CreatePromotionCommand } from './pricing.commands';
import { IStorePriceRepository, IPromotionRepository } from '../../domain/repositories/pricing.repository.interface';
import { StorePrice } from '../../domain/entities/price.entity';
import { Promotion } from '../../domain/entities/promotion.entity';
import { Money } from '../../../products/domain/value-objects/money.vo';
import { randomUUID } from 'crypto';

@CommandHandler(SetStorePriceCommand)
export class SetStorePriceHandler implements ICommandHandler<SetStorePriceCommand> {
  constructor(
    @Inject(IStorePriceRepository)
    private readonly repo: IStorePriceRepository,
  ) {}

  async execute(command: SetStorePriceCommand): Promise<string> {
    const money = new Money(command.priceAmount, command.currency);
    const id = randomUUID();

    // In a full implementation, we would mark the old price as inactive and create a new one to preserve history
    const storePrice = new StorePrice(
      id,
      command.productId,
      command.storeId,
      command.priceLevelId,
      money,
      new Date(),
      null
    );

    await this.repo.save(storePrice);
    return id;
  }
}

@CommandHandler(CreatePromotionCommand)
export class CreatePromotionHandler implements ICommandHandler<CreatePromotionCommand> {
  constructor(
    @Inject(IPromotionRepository)
    private readonly repo: IPromotionRepository,
  ) {}

  async execute(command: CreatePromotionCommand): Promise<string> {
    const id = randomUUID();

    const promotion = new Promotion(
      id,
      command.name,
      command.type,
      command.value,
      command.startDate,
      command.endDate,
      command.priority,
      command.isStackable,
      true
    );

    // In a full implementation, we'd also link command.productIds in a transaction
    await this.repo.save(promotion);

    return id;
  }
}
