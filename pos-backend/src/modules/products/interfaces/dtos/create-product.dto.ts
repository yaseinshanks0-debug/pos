import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray, ValidateNested, IsNumber, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class BarcodeDto {
  @ApiProperty({ description: 'The actual barcode string', example: '123456789012' })
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiPropertyOptional({ description: 'Type of barcode', example: 'UPC', default: 'UNKNOWN' })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ description: 'Is this the primary barcode for scanning?', default: false })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}

class PriceDto {
  @ApiProperty({ description: 'The price amount', example: 10.99 })
  @IsNumber()
  @IsNotEmpty()
  price: number;

  @ApiPropertyOptional({ description: 'Currency code', example: 'USD', default: 'USD' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ description: 'Price tier categorization', example: 'RETAIL', default: 'RETAIL' })
  @IsString()
  @IsOptional()
  priceTier?: string;

  @ApiPropertyOptional({ description: 'Store specific pricing override. Null means global/default.', format: 'uuid' })
  @IsUUID()
  @IsOptional()
  storeId?: string;
}

/**
 * Data Transfer Object for creating a new Product.
 */
export class CreateProductDto {
  @ApiProperty({ description: 'The name of the product', example: 'Organic Apple' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Stock Keeping Unit, must be unique', example: 'FRU-APP-001' })
  @IsString()
  @IsNotEmpty()
  sku: string;

  @ApiPropertyOptional({ description: 'Optional Category UUID', format: 'uuid' })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Optional Brand UUID', format: 'uuid' })
  @IsUUID()
  @IsOptional()
  brandId?: string;

  @ApiPropertyOptional({ description: 'Unit of Measure', example: 'KG', default: 'EA' })
  @IsString()
  @IsOptional()
  unitOfMeasure?: string;

  @ApiPropertyOptional({ description: 'Should this product trigger inventory tracking?', default: true })
  @IsBoolean()
  @IsOptional()
  isTracked?: boolean;

  @ApiPropertyOptional({ description: 'Optional detailed description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ type: () => [BarcodeDto], description: 'Optional list of initial barcodes' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BarcodeDto)
  @IsOptional()
  barcodes?: BarcodeDto[];

  @ApiPropertyOptional({ type: () => [PriceDto], description: 'Optional list of initial prices' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceDto)
  @IsOptional()
  initialPrices?: PriceDto[];
}
