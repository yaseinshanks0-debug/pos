export class CreateProductCommand {
  constructor(
    public readonly name: string,
    public readonly sku: string,
    public readonly categoryId: string | null,
    public readonly brandId: string | null,
    public readonly unitOfMeasure: string,
    public readonly isTracked: boolean,
    public readonly description?: string,
    public readonly barcodes?: { value: string; type: string; isPrimary: boolean }[],
    public readonly initialPrices?: { price: number; currency: string; priceTier: string; storeId?: string }[]
  ) {}
}
