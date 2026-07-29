import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ReceiveStockDto, ConsumeStockDto } from '../dtos/inventory.dto';
import { ReceiveStockCommand, ConsumeStockCommand } from '../../application/commands/receive-stock.command';
import { GetStockAvailabilityQuery } from '../../application/queries/inventory.queries';

@ApiTags('Inventory')
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('receive')
  @ApiOperation({ summary: 'Receive new stock (Creates FIFO layer)' })
  @ApiResponse({ status: 201, description: 'Stock received successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  async receiveStock(@Body() dto: ReceiveStockDto) {
    const command = new ReceiveStockCommand(
      dto.productId,
      dto.warehouseId,
      dto.quantity,
      dto.unitCost,
      dto.currency || 'USD',
      dto.referenceDocumentId
    );
    await this.commandBus.execute(command);
    return { success: true };
  }

  @Post('consume')
  @ApiOperation({ summary: 'Consume stock (Depletes FIFO layers)' })
  @ApiResponse({ status: 201, description: 'Stock consumed successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request (e.g. Insufficient stock).' })
  async consumeStock(@Body() dto: ConsumeStockDto) {
    const command = new ConsumeStockCommand(
      dto.productId,
      dto.warehouseId,
      dto.quantity,
      dto.movementType,
      dto.referenceDocumentId
    );
    await this.commandBus.execute(command);
    return { success: true };
  }

  @Get('availability/:warehouseId/:productId')
  @ApiOperation({ summary: 'Get stock availability' })
  @ApiParam({ name: 'warehouseId', description: 'Warehouse UUID' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Stock availability object.' })
  async getAvailability(
    @Param('warehouseId') warehouseId: string,
    @Param('productId') productId: string
  ) {
    return this.queryBus.execute(new GetStockAvailabilityQuery(productId, warehouseId));
  }
}
