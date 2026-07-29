import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray, ValidateNested, IsNumber, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

class BarcodeDto {
  @IsString()
  @IsNotEmpty()
  value: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}

class PriceDto {
  @IsNumber()
  @IsNotEmpty()
  price: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  priceTier?: string;

  @IsUUID()
  @IsOptional()
  storeId?: string;
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsUUID()
  @IsOptional()
  brandId?: string;

  @IsString()
  @IsOptional()
  unitOfMeasure?: string;

  @IsBoolean()
  @IsOptional()
  isTracked?: boolean;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BarcodeDto)
  @IsOptional()
  barcodes?: BarcodeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceDto)
  @IsOptional()
  initialPrices?: PriceDto[];
}
