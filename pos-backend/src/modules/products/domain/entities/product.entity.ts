import { Barcode } from '../value-objects/barcode.vo';
import { Money } from '../value-objects/money.vo';

export class ProductPrice {
  constructor(
    public readonly id: string,
    public readonly price: Money,
    public readonly priceTier: string,
    public readonly storeId: string | null = null,
    public readonly effectiveDate: Date = new Date(),
    public readonly endDate: Date | null = null
  ) {}
}

export class Product {
  constructor(
    public readonly id: string,
    public name: string,
    public sku: string,
    public categoryId: string | null,
    public brandId: string | null,
    public unitOfMeasure: string,
    public isTracked: boolean,
    public isActive: boolean,
    public description: string | null = null,
    private _barcodes: Barcode[] = [],
    private _prices: ProductPrice[] = []
  ) {}

  get barcodes(): ReadonlyArray<Barcode> {
    return this._barcodes;
  }

  get prices(): ReadonlyArray<ProductPrice> {
    return this._prices;
  }

  addBarcode(barcode: Barcode) {
    if (this._barcodes.some((b) => b.value === barcode.value)) {
      throw new Error('Barcode already exists for this product');
    }
    this._barcodes.push(barcode);
  }

  removeBarcode(barcodeValue: string) {
    this._barcodes = this._barcodes.filter((b) => b.value !== barcodeValue);
  }

  addPrice(price: ProductPrice) {
    this._prices.push(price);
  }

  deactivate() {
    this.isActive = false;
  }

  activate() {
    this.isActive = true;
  }

  updateDetails(name: string, description: string | null, unitOfMeasure: string) {
    this.name = name;
    this.description = description;
    this.unitOfMeasure = unitOfMeasure;
  }
}
