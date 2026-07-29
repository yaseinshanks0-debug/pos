import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateProductDto } from '../dtos/create-product.dto';
import { CreateProductCommand } from '../../application/commands/create-product.command';
import { GetProductQuery, GetProductByBarcodeQuery, ListProductsQuery } from '../../application/queries/get-product.query';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  async createProduct(@Body() createProductDto: CreateProductDto) {
    const command = new CreateProductCommand(
      createProductDto.name,
      createProductDto.sku,
      createProductDto.categoryId || null,
      createProductDto.brandId || null,
      createProductDto.unitOfMeasure || 'EA',
      createProductDto.isTracked !== undefined ? createProductDto.isTracked : true,
      createProductDto.description,
      createProductDto.barcodes?.map(b => ({ value: b.value, type: b.type || 'UNKNOWN', isPrimary: b.isPrimary || false })),
      createProductDto.initialPrices?.map(p => ({ price: p.price, currency: p.currency || 'USD', priceTier: p.priceTier || 'RETAIL', storeId: p.storeId }))
    );
    const productId = await this.commandBus.execute(command);
    return { id: productId };
  }

  @Get()
  async listProducts(
    @Query('limit') limit: number = 100,
    @Query('offset') offset: number = 0,
  ) {
    return this.queryBus.execute(new ListProductsQuery(Number(limit), Number(offset)));
  }

  @Get(':id')
  async getProduct(@Param('id') id: string) {
    return this.queryBus.execute(new GetProductQuery(id));
  }

  @Get('barcode/:barcode')
  async getProductByBarcode(@Param('barcode') barcode: string) {
    return this.queryBus.execute(new GetProductByBarcodeQuery(barcode));
  }
}
