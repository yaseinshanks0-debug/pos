import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetProductQuery, GetProductByBarcodeQuery, ListProductsQuery } from './get-product.query';
import { IProductRepository } from '../../domain/repositories/product.repository.interface';
import { Product } from '../../domain/entities/product.entity';

@QueryHandler(GetProductQuery)
export class GetProductHandler implements IQueryHandler<GetProductQuery> {
  constructor(
    @Inject(IProductRepository)
    private readonly productRepository: IProductRepository,
  ) {}

  async execute(query: GetProductQuery): Promise<Product | null> {
    return this.productRepository.findById(query.id);
  }
}

@QueryHandler(GetProductByBarcodeQuery)
export class GetProductByBarcodeHandler implements IQueryHandler<GetProductByBarcodeQuery> {
  constructor(
    @Inject(IProductRepository)
    private readonly productRepository: IProductRepository,
  ) {}

  async execute(query: GetProductByBarcodeQuery): Promise<Product | null> {
    return this.productRepository.findByBarcode(query.barcode);
  }
}

@QueryHandler(ListProductsQuery)
export class ListProductsHandler implements IQueryHandler<ListProductsQuery> {
  constructor(
    @Inject(IProductRepository)
    private readonly productRepository: IProductRepository,
  ) {}

  async execute(query: ListProductsQuery): Promise<Product[]> {
    return this.productRepository.findAll(query.limit, query.offset);
  }
}
