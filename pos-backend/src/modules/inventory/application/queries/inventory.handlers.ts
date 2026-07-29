import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetStockAvailabilityQuery } from './inventory.queries';
import { IInventoryLedgerRepository } from '../../domain/repositories/inventory.repository.interface';

@QueryHandler(GetStockAvailabilityQuery)
export class GetStockAvailabilityHandler implements IQueryHandler<GetStockAvailabilityQuery> {
  constructor(
    @Inject(IInventoryLedgerRepository)
    private readonly ledgerRepo: IInventoryLedgerRepository,
  ) {}

  async execute(query: GetStockAvailabilityQuery) {
    const onHand = await this.ledgerRepo.calculateStockOnHand(query.productId, query.warehouseId);

    return {
      productId: query.productId,
      warehouseId: query.warehouseId,
      onHand: onHand,
      // In full implementation, we'd also calculate reserved/incoming stock here
      available: onHand,
    };
  }
}
