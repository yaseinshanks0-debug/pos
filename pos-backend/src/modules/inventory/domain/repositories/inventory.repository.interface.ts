import { CostLayer } from '../entities/cost-layer.entity';
import { InventoryLedgerEntry } from '../entities/inventory-ledger.entity';
import { Warehouse } from '../entities/warehouse.entity';

export interface IWarehouseRepository {
  findById(id: string): Promise<Warehouse | null>;
  findByCode(code: string): Promise<Warehouse | null>;
  findAll(): Promise<Warehouse[]>;
  save(warehouse: Warehouse): Promise<void>;
}
export const IWarehouseRepository = Symbol('IWarehouseRepository');

export interface ICostLayerRepository {
  findOpenLayersForProduct(productId: string, warehouseId: string): Promise<CostLayer[]>;
  save(layer: CostLayer): Promise<void>;
  update(layer: CostLayer): Promise<void>;
}
export const ICostLayerRepository = Symbol('ICostLayerRepository');

export interface IInventoryLedgerRepository {
  save(entry: InventoryLedgerEntry): Promise<void>;
  calculateStockOnHand(productId: string, warehouseId: string): Promise<number>;
}
export const IInventoryLedgerRepository = Symbol('IInventoryLedgerRepository');
