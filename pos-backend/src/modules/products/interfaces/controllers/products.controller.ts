import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CreateProductDto } from '../dtos/create-product.dto';
import { CreateProductCommand } from '../../application/commands/create-product.command';
import { GetProductQuery, GetProductByBarcodeQuery, ListProductsQuery } from '../../application/queries/get-product.query';

/**
 * Controller handling all RESTful API endpoints for Products.
 */
@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * Endpoint to create a new product.
   * @param createProductDto Data transfer object containing product details.
   * @returns The UUID of the newly created product.
   */
  @Post()
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({ status: 201, description: 'The product has been successfully created.', schema: { example: { id: 'uuid-string' } } })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
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

  /**
   * Endpoint to list products with basic pagination.
   * @param limit Number of items to return.
   * @param offset Number of items to skip.
   */
  @Get()
  @ApiOperation({ summary: 'List products with pagination' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 100 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiResponse({ status: 200, description: 'List of products.' })
  async listProducts(
    @Query('limit') limit: number = 100,
    @Query('offset') offset: number = 0,
  ) {
    return this.queryBus.execute(new ListProductsQuery(Number(limit), Number(offset)));
  }

  /**
   * Endpoint to retrieve a specific product by its ID.
   * @param id The UUID of the product.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Retrieve a product by its UUID' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'The product details.' })
  @ApiResponse({ status: 404, description: 'Product not found.' })
  async getProduct(@Param('id') id: string) {
    return this.queryBus.execute(new GetProductQuery(id));
  }

  /**
   * Endpoint to instantly search and retrieve a product by scanning its barcode.
   * @param barcode The scanned barcode string.
   */
  @Get('barcode/:barcode')
  @ApiOperation({ summary: 'Find a product by scanning a barcode' })
  @ApiParam({ name: 'barcode', description: 'Scanned barcode value' })
  @ApiResponse({ status: 200, description: 'The matching product details.' })
  @ApiResponse({ status: 404, description: 'Product not found.' })
  async getProductByBarcode(@Param('barcode') barcode: string) {
    return this.queryBus.execute(new GetProductByBarcodeQuery(barcode));
  }
}
