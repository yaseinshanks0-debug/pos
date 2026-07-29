import { pgTable, text, timestamp, boolean, uuid, varchar, decimal, integer, index, foreignKey, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { products } from './product.schema';

export const warehouses = pgTable('warehouses', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }).unique().notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  parentId: uuid('parent_id'),
  address: text('address'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('warehouses_parent_id_idx').on(table.parentId),
  index('warehouses_is_active_idx').on(table.isActive),
]);

export const warehouseLocations = pgTable('warehouse_locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 100 }).notNull(),
  type: varchar('type', { length: 50 }).notNull().default('BIN'), // ZONE, AISLE, RACK, SHELF, BIN
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('warehouse_locations_warehouse_id_idx').on(table.warehouseId),
  uniqueIndex('warehouse_locations_code_idx').on(table.warehouseId, table.code),
]);

export const inventoryLedger = pgTable('inventory_ledger', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id, { onDelete: 'cascade' }).notNull(),
  locationId: uuid('location_id').references(() => warehouseLocations.id),
  movementType: varchar('movement_type', { length: 50 }).notNull(), // PURCHASE, SALE, RETURN, ADJUSTMENT, TRANSFER_IN, TRANSFER_OUT, etc.
  quantity: decimal('quantity', { precision: 15, scale: 4 }).notNull(), // Positive for IN, Negative for OUT
  referenceDocumentId: varchar('reference_document_id', { length: 100 }), // e.g. Order ID, Transfer ID
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('inventory_ledger_product_id_idx').on(table.productId),
  index('inventory_ledger_warehouse_id_idx').on(table.warehouseId),
  index('inventory_ledger_movement_type_idx').on(table.movementType),
  index('inventory_ledger_created_at_idx').on(table.createdAt),
]);

export const inventoryCostLayers = pgTable('inventory_cost_layers', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id, { onDelete: 'cascade' }).notNull(),
  initialQuantity: decimal('initial_quantity', { precision: 15, scale: 4 }).notNull(),
  remainingQuantity: decimal('remaining_quantity', { precision: 15, scale: 4 }).notNull(),
  unitCost: decimal('unit_cost', { precision: 15, scale: 4 }).notNull(),
  referenceDocumentId: varchar('reference_document_id', { length: 100 }),
  receivedAt: timestamp('received_at').defaultNow().notNull(),
  status: varchar('status', { length: 50 }).default('OPEN').notNull(), // OPEN, DEPLETED, LOCKED
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('inventory_cost_layers_product_warehouse_idx').on(table.productId, table.warehouseId),
  index('inventory_cost_layers_status_idx').on(table.status),
  index('inventory_cost_layers_received_at_idx').on(table.receivedAt), // Essential for FIFO ordering
]);

export const inventoryLayerConsumptions = pgTable('inventory_layer_consumptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  costLayerId: uuid('cost_layer_id').references(() => inventoryCostLayers.id, { onDelete: 'cascade' }).notNull(),
  ledgerEntryId: uuid('ledger_entry_id').references(() => inventoryLedger.id, { onDelete: 'cascade' }).notNull(),
  quantityConsumed: decimal('quantity_consumed', { precision: 15, scale: 4 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('inventory_layer_consumptions_layer_idx').on(table.costLayerId),
  index('inventory_layer_consumptions_ledger_idx').on(table.ledgerEntryId),
]);

export const inventoryReservations = pgTable('inventory_reservations', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id, { onDelete: 'cascade' }).notNull(),
  quantity: decimal('quantity', { precision: 15, scale: 4 }).notNull(),
  referenceDocumentId: varchar('reference_document_id', { length: 100 }).notNull(), // Order ID, Cart ID
  status: varchar('status', { length: 50 }).default('ACTIVE').notNull(), // ACTIVE, CONSUMED, EXPIRED, CANCELLED
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('inventory_reservations_product_warehouse_idx').on(table.productId, table.warehouseId),
  index('inventory_reservations_status_idx').on(table.status),
  index('inventory_reservations_expires_at_idx').on(table.expiresAt),
]);

export const inventoryBatches = pgTable('inventory_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  batchNumber: varchar('batch_number', { length: 100 }).notNull(),
  supplierBatch: varchar('supplier_batch', { length: 100 }),
  manufacturingDate: timestamp('manufacturing_date'),
  expiryDate: timestamp('expiry_date'),
  status: varchar('status', { length: 50 }).default('ACTIVE').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('inventory_batches_product_batch_idx').on(table.productId, table.batchNumber),
  index('inventory_batches_expiry_date_idx').on(table.expiryDate),
]);

export const inventorySerialNumbers = pgTable('inventory_serial_numbers', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id),
  serialNumber: varchar('serial_number', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).default('IN_STOCK').notNull(), // IN_STOCK, SOLD, IN_TRANSIT, RETURNED, DAMAGED
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('inventory_serial_numbers_idx').on(table.productId, table.serialNumber),
  index('inventory_serial_numbers_status_idx').on(table.status),
]);

export const stockAdjustments = pgTable('stock_adjustments', {
  id: uuid('id').primaryKey().defaultRandom(),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id).notNull(),
  reason: varchar('reason', { length: 100 }).notNull(), // CYCLE_COUNT, DAMAGE, LOST, FOUND, MANUAL
  status: varchar('status', { length: 50 }).default('PENDING').notNull(), // PENDING, APPROVED, REJECTED
  approvedBy: uuid('approved_by'), // Employee ID (placeholder)
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const stockAdjustmentLines = pgTable('stock_adjustment_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  adjustmentId: uuid('adjustment_id').references(() => stockAdjustments.id, { onDelete: 'cascade' }).notNull(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  expectedQuantity: decimal('expected_quantity', { precision: 15, scale: 4 }).notNull(),
  actualQuantity: decimal('actual_quantity', { precision: 15, scale: 4 }).notNull(),
  varianceQuantity: decimal('variance_quantity', { precision: 15, scale: 4 }).notNull(),
  unitCost: decimal('unit_cost', { precision: 15, scale: 4 }).notNull(),
});

export const stockTransfers = pgTable('stock_transfers', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceWarehouseId: uuid('source_warehouse_id').references(() => warehouses.id).notNull(),
  destinationWarehouseId: uuid('destination_warehouse_id').references(() => warehouses.id).notNull(),
  status: varchar('status', { length: 50 }).default('REQUESTED').notNull(), // REQUESTED, APPROVED, SHIPPED, PARTIALLY_RECEIVED, RECEIVED, CANCELLED
  shippedAt: timestamp('shipped_at'),
  receivedAt: timestamp('received_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const stockTransferLines = pgTable('stock_transfer_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  transferId: uuid('transfer_id').references(() => stockTransfers.id, { onDelete: 'cascade' }).notNull(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  requestedQuantity: decimal('requested_quantity', { precision: 15, scale: 4 }).notNull(),
  shippedQuantity: decimal('shipped_quantity', { precision: 15, scale: 4 }).default('0').notNull(),
  receivedQuantity: decimal('received_quantity', { precision: 15, scale: 4 }).default('0').notNull(),
});

export const reorderRules = pgTable('reorder_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id, { onDelete: 'cascade' }).notNull(),
  minStock: decimal('min_stock', { precision: 15, scale: 4 }).notNull(),
  maxStock: decimal('max_stock', { precision: 15, scale: 4 }).notNull(),
  safetyStock: decimal('safety_stock', { precision: 15, scale: 4 }).notNull(),
  leadTimeDays: integer('lead_time_days').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
}, (table) => [
  uniqueIndex('reorder_rules_product_warehouse_idx').on(table.productId, table.warehouseId),
]);

export const inventoryAlerts = pgTable('inventory_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // LOW_STOCK, OUT_OF_STOCK, EXPIRED, NEGATIVE
  message: text('message').notNull(),
  isResolved: boolean('is_resolved').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
}, (table) => [
  index('inventory_alerts_unresolved_idx').on(table.isResolved),
]);

// Exporting relations
export const warehousesRelations = relations(warehouses, ({ many }) => ({
  locations: many(warehouseLocations),
}));

export const stockCounts = pgTable('stock_counts', {
  id: uuid('id').primaryKey().defaultRandom(),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // CYCLE_COUNT, FULL_COUNT, BLIND_COUNT
  status: varchar('status', { length: 50 }).default('IN_PROGRESS').notNull(), // IN_PROGRESS, COMPLETED, CANCELLED
  scheduledAt: timestamp('scheduled_at'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const stockCountLines = pgTable('stock_count_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  stockCountId: uuid('stock_count_id').references(() => stockCounts.id, { onDelete: 'cascade' }).notNull(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  expectedQuantity: decimal('expected_quantity', { precision: 15, scale: 4 }), // Nullable for blind counts
  countedQuantity: decimal('counted_quantity', { precision: 15, scale: 4 }).notNull(),
});

export const inventorySnapshots = pgTable('inventory_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id).notNull(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  totalQuantity: decimal('total_quantity', { precision: 15, scale: 4 }).notNull(),
  totalValue: decimal('total_value', { precision: 15, scale: 4 }).notNull(),
  snapshotDate: timestamp('snapshot_date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('inventory_snapshots_date_idx').on(table.snapshotDate),
]);
