export class Barcode {
  constructor(
    public readonly value: string,
    public readonly type: string = 'UNKNOWN',
    public readonly isPrimary: boolean = false
  ) {
    if (!value) {
      throw new Error('Barcode value is required');
    }
  }

  equals(other: Barcode): boolean {
    return this.value === other.value;
  }
}
