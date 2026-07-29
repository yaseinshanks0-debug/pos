import { IsString, IsNotEmpty, IsOptional, IsNumber, IsUUID, IsPositive } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReceiveStockDto {
  @ApiProperty({ description: 'The UUID of the product', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ description: 'The UUID of the warehouse receiving the stock', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  warehouseId: string;

  @ApiProperty({ description: 'Quantity of stock received', example: 100 })
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  quantity: number;

  @ApiProperty({ description: 'Unit cost of the stock received', example: 5.50 })
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  unitCost: number;

  @ApiPropertyOptional({ description: 'Currency code', example: 'USD', default: 'USD' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ description: 'Reference ID (e.g. PO Number)' })
  @IsString()
  @IsOptional()
  referenceDocumentId?: string;
}

export class ConsumeStockDto {
  @ApiProperty({ description: 'The UUID of the product', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ description: 'The UUID of the warehouse', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  warehouseId: string;

  @ApiProperty({ description: 'Quantity of stock to consume', example: 2 })
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  quantity: number;

  @ApiProperty({ description: 'Type of movement (e.g. SALE, TRANSFER_OUT)', example: 'SALE' })
  @IsString()
  @IsNotEmpty()
  movementType: 'SALE' | 'ADJUSTMENT' | 'TRANSFER_OUT';

  @ApiPropertyOptional({ description: 'Reference ID (e.g. Order ID)' })
  @IsString()
  @IsOptional()
  referenceDocumentId?: string;
}
