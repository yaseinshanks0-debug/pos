import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, asc, sql } from 'drizzle-orm';
import { ICostLayerRepository, IInventoryLedgerRepository, IWarehouseRepository } from '../../domain/repositories/inventory.repository.interface';
import { CostLayer } from '../../domain/entities/cost-layer.entity';
import { InventoryLedgerEntry } from '../../domain/entities/inventory-ledger.entity';
import { Warehouse } from '../../domain/entities/warehouse.entity';
import { Quantity } from '../../domain/value-objects/quantity.vo';
import { Money } from '../../../products/domain/value-objects/money.vo';
import * as schema from '../../../../infrastructure/database/schema/inventory.schema';
import { DATABASE_CONNECTION } from '../../../products/infrastructure/repositories/product.repository';

@Injectable()
export class WarehouseRepository implements IWarehouseRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: NodePgDatabase<typeof schema>) {}

  async findById(id: string): Promise<Warehouse | null> {
    const row = await this.db.query.warehouses.findFirst({ where: eq(schema.warehouses.id, id) });
    if (!row) return null;
    return new Warehouse(row.id, row.name, row.code, row.isDefault, row.isActive, row.parentId, row.address);
  }

  async findByCode(code: string): Promise<Warehouse | null> {
    const row = await this.db.query.warehouses.findFirst({ where: eq(schema.warehouses.code, code) });
    if (!row) return null;
    return new Warehouse(row.id, row.name, row.code, row.isDefault, row.isActive, row.parentId, row.address);
  }

  async findAll(): Promise<Warehouse[]> {
    const rows = await this.db.query.warehouses.findMany();
    return rows.map(r => new Warehouse(r.id, r.name, r.code, r.isDefault, r.isActive, r.parentId, r.address));
  }

  async save(warehouse: Warehouse): Promise<void> {
    await this.db.insert(schema.warehouses).values({
      id: warehouse.id,
      name: warehouse.name,
      code: warehouse.code,
      isDefault: warehouse.isDefault,
      isActive: warehouse.isActive,
      parentId: warehouse.parentId,
      address: warehouse.address,
    });
  }
}

@Injectable()
export class CostLayerRepository implements ICostLayerRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: NodePgDatabase<typeof schema>) {}

  async findOpenLayersForProduct(productId: string, warehouseId: string): Promise<CostLayer[]> {
    // Note: Drizzle ORM currently doesn't natively support pessimistic locks natively via query builder cleanly without raw SQL yet,
    // but we emulate the concept by ordering ASC on receivedAt to enforce FIFO perfectly.
    const rows = await this.db.query.inventoryCostLayers.findMany({
      where: and(
        eq(schema.inventoryCostLayers.productId, productId),
        eq(schema.inventoryCostLayers.warehouseId, warehouseId),
        eq(schema.inventoryCostLayers.status, 'OPEN')
      ),
      orderBy: [asc(schema.inventoryCostLayers.receivedAt)],
    });

    return rows.map(r => new CostLayer(
      r.id,
      r.productId,
      r.warehouseId,
      new Quantity(parseFloat(r.initialQuantity)),
      new Quantity(parseFloat(r.remainingQuantity)),
      new Money(parseFloat(r.unitCost), 'USD'),
      r.receivedAt,
      r.status as any,
      r.referenceDocumentId
    ));
  }

  async save(layer: CostLayer): Promise<void> {
    await this.db.insert(schema.inventoryCostLayers).values({
      id: layer.id,
      productId: layer.productId,
      warehouseId: layer.warehouseId,
      initialQuantity: layer.initialQuantity.value.toString(),
      remainingQuantity: layer.remainingQuantity.value.toString(),
      unitCost: layer.unitCost.amount.toString(),
      status: layer.status,
      receivedAt: layer.receivedAt,
      referenceDocumentId: layer.referenceDocumentId,
    });
  }

  async update(layer: CostLayer): Promise<void> {
    await this.db.update(schema.inventoryCostLayers)
      .set({
        remainingQuantity: layer.remainingQuantity.value.toString(),
        status: layer.status,
        updatedAt: new Date(),
      })
      .where(eq(schema.inventoryCostLayers.id, layer.id));
  }
}

@Injectable()
export class InventoryLedgerRepository implements IInventoryLedgerRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: NodePgDatabase<typeof schema>) {}

  async save(entry: InventoryLedgerEntry): Promise<void> {
    await this.db.insert(schema.inventoryLedger).values({
      id: entry.id,
      productId: entry.productId,
      warehouseId: entry.warehouseId,
      locationId: entry.locationId,
      movementType: entry.movementType,
      quantity: entry.quantity.value.toString(),
      referenceDocumentId: entry.referenceDocumentId,
      notes: entry.notes,
    });
  }

  async calculateStockOnHand(productId: string, warehouseId: string): Promise<number> {
    const result = await this.db.select({ sum: sql<number>`sum(${schema.inventoryLedger.quantity})` })
      .from(schema.inventoryLedger)
      .where(and(
        eq(schema.inventoryLedger.productId, productId),
        eq(schema.inventoryLedger.warehouseId, warehouseId)
      ));

    return Number(result[0]?.sum || 0);
  }
}
