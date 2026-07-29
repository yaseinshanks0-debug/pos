import { IsString, IsNotEmpty, IsOptional, IsNumber, IsUUID, IsPositive, IsBoolean, IsDateString, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SetStorePriceDto {
  @ApiProperty({ description: 'The UUID of the product', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ description: 'The UUID of the store', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  storeId: string;

  @ApiProperty({ description: 'The UUID of the price level (e.g. RETAIL)', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  priceLevelId: string;

  @ApiProperty({ description: 'The override price amount', example: 85.99 })
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  priceAmount: number;

  @ApiPropertyOptional({ description: 'Currency code', example: 'USD', default: 'USD' })
  @IsString()
  @IsOptional()
  currency?: string;
}

export class CreatePromotionDto {
  @ApiProperty({ description: 'Promotion Name', example: 'Summer Flash Sale' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Promotion Type', enum: ['PERCENTAGE', 'FIXED_AMOUNT', 'BOGO', 'MIX_MATCH'] })
  @IsString()
  @IsNotEmpty()
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'BOGO' | 'MIX_MATCH';

  @ApiProperty({ description: 'Discount value', example: 15.0 })
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  value: number;

  @ApiProperty({ description: 'Valid from date' })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({ description: 'Valid until date' })
  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @ApiProperty({ description: 'List of product UUIDs to apply this promotion to', type: [String] })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsNotEmpty()
  productIds: string[];

  @ApiPropertyOptional({ description: 'Priority level (higher applied first)', default: 0 })
  @IsNumber()
  @IsOptional()
  priority?: number;

  @ApiPropertyOptional({ description: 'Can this be stacked with other promotions?', default: false })
  @IsBoolean()
  @IsOptional()
  isStackable?: boolean;
}
