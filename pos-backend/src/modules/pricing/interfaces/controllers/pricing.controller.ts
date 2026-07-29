import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { SetStorePriceDto, CreatePromotionDto } from '../dtos/pricing.dto';
import { SetStorePriceCommand, CreatePromotionCommand } from '../../application/commands/pricing.commands';
import { CalculateFinalPriceQuery } from '../../application/queries/pricing.queries';

@ApiTags('Pricing Engine')
@Controller('pricing')
export class PricingController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('store-price')
  @ApiOperation({ summary: 'Set a store specific price override' })
  @ApiResponse({ status: 201, description: 'Store price override set successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  async setStorePrice(@Body() dto: SetStorePriceDto) {
    const command = new SetStorePriceCommand(
      dto.productId,
      dto.storeId,
      dto.priceLevelId,
      dto.priceAmount,
      dto.currency || 'USD'
    );
    const id = await this.commandBus.execute(command);
    return { success: true, id };
  }

  @Post('promotion')
  @ApiOperation({ summary: 'Create a new promotion rule' })
  @ApiResponse({ status: 201, description: 'Promotion created successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  async createPromotion(@Body() dto: CreatePromotionDto) {
    const command = new CreatePromotionCommand(
      dto.name,
      dto.type,
      dto.value,
      new Date(dto.startDate),
      new Date(dto.endDate),
      dto.productIds,
      dto.priority || 0,
      dto.isStackable || false
    );
    const id = await this.commandBus.execute(command);
    return { success: true, id };
  }

  @Get('calculate')
  @ApiOperation({ summary: 'Calculate final deterministic price for a product' })
  @ApiQuery({ name: 'productId', description: 'Product UUID', required: true })
  @ApiQuery({ name: 'storeId', description: 'Store UUID', required: true })
  @ApiQuery({ name: 'priceLevelId', description: 'Price Level UUID', required: true })
  @ApiQuery({ name: 'quantity', description: 'Quantity', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'The calculated final price.' })
  async calculatePrice(
    @Query('productId') productId: string,
    @Query('storeId') storeId: string,
    @Query('priceLevelId') priceLevelId: string,
    @Query('quantity') quantity?: number
  ) {
    return this.queryBus.execute(new CalculateFinalPriceQuery(
      productId,
      storeId,
      priceLevelId,
      quantity ? Number(quantity) : 1
    ));
  }
}
