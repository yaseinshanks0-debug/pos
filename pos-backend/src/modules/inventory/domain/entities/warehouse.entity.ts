import { AggregateRoot } from '../../../products/domain/entities/aggregate-root';

export class Warehouse extends AggregateRoot {
  constructor(
    public readonly id: string,
    public name: string,
    public code: string,
    public isDefault: boolean,
    public isActive: boolean,
    public parentId: string | null = null,
    public address: string | null = null
  ) {
    super();
  }

  static create(id: string, name: string, code: string, isDefault: boolean = false): Warehouse {
    return new Warehouse(id, name, code, isDefault, true);
  }

  deactivate(): void {
    this.isActive = false;
  }
}
