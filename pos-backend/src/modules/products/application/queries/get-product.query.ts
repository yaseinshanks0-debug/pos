export class GetProductQuery {
  constructor(public readonly id: string) {}
}

export class GetProductByBarcodeQuery {
  constructor(public readonly barcode: string) {}
}

export class ListProductsQuery {
  constructor(public readonly limit: number = 100, public readonly offset: number = 0) {}
}
