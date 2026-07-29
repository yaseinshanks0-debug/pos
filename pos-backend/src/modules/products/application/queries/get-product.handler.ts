import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetProductQuery, GetProductByBarcodeQuery, ListProductsQuery } from './get-product.query';
import { IProductRepository } from '../../domain/repositories/product.repository.interface';
import { Product } from '../../domain/entities/product.entity';

// Helper to map domain entity to primitive DTO to avoid serialization leaks
function mapProductToDto(product: Product | null) {
  if (!product) return null;
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    description: product.description,
    categoryId: product.categoryId,
    brandId: product.brandId,
    unitOfMeasure: product.unitOfMeasure,
    isTracked: product.isTracked,
    isActive: product.isActive,
    barcodes: product.barcodes.map(b => ({
      value: b.value,
      type: b.type,
      isPrimary: b.isPrimary,
    })),
    prices: product.prices.map(p => ({
      id: p.id,
      price: p.price.amount,
      currency: p.price.currency,
      priceTier: p.priceTier,
      storeId: p.storeId,
    })),
  };
}

@QueryHandler(GetProductQuery)
export class GetProductHandler implements IQueryHandler<GetProductQuery> {
  constructor(
    @Inject(IProductRepository)
    private readonly productRepository: IProductRepository,
  ) {}

  async execute(query: GetProductQuery) {
    const product = await this.productRepository.findById(query.id);
    return mapProductToDto(product);
  }
}

@QueryHandler(GetProductByBarcodeQuery)
export class GetProductByBarcodeHandler implements IQueryHandler<GetProductByBarcodeQuery> {
  constructor(
    @Inject(IProductRepository)
    private readonly productRepository: IProductRepository,
  ) {}

  async execute(query: GetProductByBarcodeQuery) {
    const product = await this.productRepository.findByBarcode(query.barcode);
    return mapProductToDto(product);
  }
}

@QueryHandler(ListProductsQuery)
export class ListProductsHandler implements IQueryHandler<ListProductsQuery> {
  constructor(
    @Inject(IProductRepository)
    private readonly productRepository: IProductRepository,
  ) {}

  async execute(query: ListProductsQuery) {
    const products = await this.productRepository.findAll(query.limit, query.offset);
    return products.map(mapProductToDto);
  }
}
