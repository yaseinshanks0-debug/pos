// src/backend/test-stage2-final-scenarios.ts
import { db } from "../db/index.ts";
import { DrizzleUnitOfWork } from "./infrastructure/persistence/unit-of-work.ts";
import { InventoryCountService } from "./application/services/inventory-count.service.ts";
import { InventoryAdjustmentService } from "./application/services/inventory-adjustment.service.ts";
import { TransferOrderService } from "./application/services/transfer-order.service.ts";
import { AccountingService } from "./application/services/accounting.service.ts";
import { StructuredLogger } from "./infrastructure/logging/logger.ts";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema.ts";

const logger = new StructuredLogger();
const uow = new DrizzleUnitOfWork();

async function runStage2FinalVerification() {
  logger.info("==================================================================");
  logger.info("   STAGE 2 FINAL VERIFICATION: SYSTEM EXECUTION TRACE GENERATOR   ");
  logger.info("==================================================================");

  // Setup / Seed base records
  await db.transaction(async (tx) => {
    // Company
    const companiesList = await tx.select().from(schema.companies).where(eq(schema.companies.id, 1));
    if (companiesList.length === 0) {
      await tx.insert(schema.companies).values({
        id: 1,
        name: "Acme Enterprise Corp.",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    // Stores (HQ = Store 1, Branch = Store 2)
    const store1 = await tx.select().from(schema.stores).where(eq(schema.stores.id, 1));
    if (store1.length === 0) {
      await tx.insert(schema.stores).values({
        id: 1,
        companyId: 1,
        name: "Acme Store A",
        code: "STORE-A",
        type: "retail",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    const store2 = await tx.select().from(schema.stores).where(eq(schema.stores.id, 2));
    if (store2.length === 0) {
      await tx.insert(schema.stores).values({
        id: 2,
        companyId: 1,
        name: "Acme Store B",
        code: "STORE-B",
        type: "retail",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    // Warehouses
    const wh1 = await tx.select().from(schema.warehouses).where(eq(schema.warehouses.id, 1));
    if (wh1.length === 0) {
      await tx.insert(schema.warehouses).values({
        id: 1,
        storeId: 1,
        name: "Warehouse Store A",
        code: "WH-A",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    const wh2 = await tx.select().from(schema.warehouses).where(eq(schema.warehouses.id, 2));
    if (wh2.length === 0) {
      await tx.insert(schema.warehouses).values({
        id: 2,
        storeId: 2,
        name: "Warehouse Store B",
        code: "WH-B",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    // Base Product (Product 10)
    const itemsList = await tx.select().from(schema.products).where(eq(schema.products.id, 10));
    if (itemsList.length === 0) {
      await tx.insert(schema.products).values({
        id: 10,
        companyId: 1,
        sku: "PROD-VAL-CORE",
        barcode: "101010101",
        name: "Core Stock Material",
        costPrice: "10.00",
        retailPrice: "18.00",
        reorderPoint: 5,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    // Role & User
    const rolesList = await tx.select().from(schema.roles).where(eq(schema.roles.id, 1));
    if (rolesList.length === 0) {
      await tx.insert(schema.roles).values({
        id: 1,
        name: "super_admin",
        description: "Super Admin",
        createdAt: new Date()
      });
    }

    const usersList = await tx.select().from(schema.users).where(eq(schema.users.id, 1));
    if (usersList.length === 0) {
      await tx.insert(schema.users).values({
        id: 1,
        uid: "uid-test-stage2-final",
        email: "controller@acme.com",
        fullName: "System Corporate Accountant",
        roleId: 1,
        companyId: 1,
        storeId: 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  });

  const countService = new InventoryCountService(uow, logger);
  const adjustmentService = new InventoryAdjustmentService(uow, logger);
  const transferService = new TransferOrderService(uow, logger);

  // Helper to query on-hand quantity
  const getOnHand = async (whId: number) => {
    const records = await db.select().from(schema.inventory).where(eq(schema.inventory.warehouseId, whId));
    return records.length > 0 ? records[0].quantity : 0;
  };

  // Helper to dump GL ledger entries
  const printLedger = async (label: string) => {
    const entries = await db.select().from(schema.generalLedgerEntries).orderBy(schema.generalLedgerEntries.id);
    logger.info(`\n[LEDGER STATUS: ${label}]`);
    console.table(entries.map(e => ({
      ID: e.id,
      Store: `Store ${e.storeId}`,
      Code: e.accountCode,
      Name: e.accountName,
      Debit: `$${Number(e.debit).toFixed(2)}`,
      Credit: `$${Number(e.credit).toFixed(2)}`,
      Description: e.description
    })));
  };

  // Helper to clean tables between test scenarios
  const resetTables = async () => {
    await db.delete(schema.inventoryCostLayerConsumptions);
    await db.delete(schema.inventoryCostLayers);
    await db.delete(schema.generalLedgerEntries);
    await db.delete(schema.transferOrderItems);
    await db.delete(schema.transferOrders);
    await db.delete(schema.inventoryCountItems);
    await db.delete(schema.inventoryCountSessions);
    await db.delete(schema.inventoryAdjustmentItems);
    await db.delete(schema.inventoryAdjustments);
    await db.delete(schema.inventoryMovements);
    await db.delete(schema.inventory);
  };


  // ==========================================================
  // SCENARIO 1: INTER-STORE TRANSFER (Full flow)
  // ==========================================================
  logger.info("\n==========================================================");
  logger.info("SCENARIO 1: INTER-STORE TRANSFER");
  logger.info("==========================================================");
  await resetTables();

  // Setup: Store A has 10 units
  await db.insert(schema.inventory).values({
    warehouseId: 1,
    productId: 10,
    variantId: null,
    quantity: 10,
    reorderLevel: 2,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  logger.info(`Source (Store A / Warehouse 1) Inventory BEFORE shipment: ${await getOnHand(1)} units`);
  logger.info(`Destination (Store B / Warehouse 2) Inventory BEFORE shipment: ${await getOnHand(2)} units`);

  // Create Transfer payload
  const transfer1 = await transferService.createTransfer({
    transferNumber: "TR-SCENARIO-1",
    sourceStoreId: 1,
    sourceWarehouseId: 1,
    destinationStoreId: 2,
    destinationWarehouseId: 2,
    notes: "Scenario 1 inter-store transfer verification.",
    createdByUserId: 1,
    items: [{ productId: 10, quantityRequest: 10 }]
  });

  await transferService.approveTransfer(transfer1.id, 1);
  await transferService.shipTransfer(transfer1.id);

  logger.info(`Source (Store A / Warehouse 1) Inventory AFTER shipment: ${await getOnHand(1)} units`);
  
  // In-transit state query
  const transferInTransitInfo = await db.select().from(schema.transferOrders).where(eq(schema.transferOrders.id, transfer1.id));
  logger.info(`Transfer Status in database: "${transferInTransitInfo[0].status}" (In-transit: true)`);
  logger.info(`Destination (Store B / Warehouse 2) Inventory in-transit state: ${await getOnHand(2)} units (not yet resolved to WH-B on-hand)`);

  // Receive Transfer Order
  await transferService.receiveTransfer(transfer1.id, 1, [
    { itemId: transfer1.items[0].id, qtyReceived: 10 }
  ]);

  logger.info(`Destination (Store B / Warehouse 2) Inventory AFTER receipt: ${await getOnHand(2)} units`);
  await printLedger("Scenario 1 Inter-Store Transfer");


  // ==========================================================
  // SCENARIO 2: PARTIAL TRANSFER RECEIPT
  // ==========================================================
  logger.info("\n==========================================================");
  logger.info("SCENARIO 2: PARTIAL TRANSFER RECEIPT");
  logger.info("==========================================================");
  await resetTables();

  // Setup: Store A has 10 units
  await db.insert(schema.inventory).values({
    warehouseId: 1,
    productId: 10,
    variantId: null,
    quantity: 10,
    reorderLevel: 2,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const transfer2 = await transferService.createTransfer({
    transferNumber: "TR-SCENARIO-2",
    sourceStoreId: 1,
    sourceWarehouseId: 1,
    destinationStoreId: 2,
    destinationWarehouseId: 2,
    notes: "Scenario 2 partial receipt verification.",
    createdByUserId: 1,
    items: [{ productId: 10, quantityRequest: 10 }]
  });

  await transferService.approveTransfer(transfer2.id, 1);
  await transferService.shipTransfer(transfer2.id);

  // Receive ONLY 6 units
  const partialReceipt = await transferService.receiveTransfer(transfer2.id, 1, [
    { itemId: transfer2.items[0].id, qtyReceived: 6 }
  ]);

  const itemsInTransit = await db.select().from(schema.transferOrderItems).where(eq(schema.transferOrderItems.transferOrderId, transfer2.id));
  const remainingInTransit = itemsInTransit[0].shippedQty - itemsInTransit[0].receivedQty;

  logger.info(`Transfer Final Recorded Status: "${partialReceipt.status}"`);
  logger.info(`Remaining in-transit quantity in order record: ${remainingInTransit} units`);
  logger.info(`Destination Store B (Warehouse 2) inventory quantity: ${await getOnHand(2)} units`);
  logger.info(`Source Store A (Warehouse 1) inventory quantity: ${await getOnHand(1)} units`);


  // ==========================================================
  // SCENARIO 3: PHYSICAL INVENTORY COUNT VARIANCE
  // ==========================================================
  logger.info("\n==========================================================");
  logger.info("SCENARIO 3: PHYSICAL INVENTORY COUNT VARIANCE");
  logger.info("==========================================================");
  await resetTables();

  // Setup: System quantity is 100 units
  await db.insert(schema.inventory).values({
    warehouseId: 1,
    productId: 10,
    variantId: null,
    quantity: 100,
    reorderLevel: 5,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  logger.info(`Database System quantity BEFORE starting session: ${await getOnHand(1)} units`);

  const countSession = await countService.startCountSession({
    companyId: 1,
    storeId: 1,
    warehouseId: 1,
    type: "cycle",
    notes: "Scenario 3 count validation",
    createdByUserId: 1
  });

  // Counted quantity is 92 units (Variance of -8 units)
  const submittedCounts = await countService.submitCounts({
    id: countSession.id,
    notes: "Submitted actual count verification",
    items: [
      {
        productId: 10,
        variantId: undefined,
        countedQuantity: 92,
        reasonCode: "shrinkage"
      }
    ]
  });

  logger.info(`Variance detected & in count record: ${submittedCounts.items[0].variance} units`);

  // Approve count session to finalize stock and write journal entries
  await countService.approveCountSession(countSession.id, 1);

  logger.info(`Database System quantity AFTER count approval: ${await getOnHand(1)} units`);
  await printLedger("Scenario 3 Physical Count Variance");


  // ==========================================================
  // SCENARIO 4: THEFT / DAMAGE ADJUSTMENT
  // ==========================================================
  logger.info("\n==========================================================");
  logger.info("SCENARIO 4: THEFT / DAMAGE ADJUSTMENT");
  logger.info("==========================================================");
  await resetTables();

  // Setup: Starting with 20 units
  await db.insert(schema.inventory).values({
    warehouseId: 1,
    productId: 10,
    variantId: null,
    quantity: 20,
    reorderLevel: 5,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  logger.info(`Inventory BEFORE Damage Adjustment: ${await getOnHand(1)} units`);

  // Adjust 5 units damaged
  const adjustment = await adjustmentService.createAdjustment({
    companyId: 1,
    storeId: 1,
    warehouseId: 1,
    adjustmentNumber: "ADJ-DAMAGE-05",
    type: "damage",
    notes: "Found 5 units damaged on side shelf C.",
    createdByUserId: 1,
    items: [
      {
        productId: 10,
        variantId: undefined,
        quantityAdjusted: -5,
        reasonCode: "damage"
      }
    ]
  });

  await adjustmentService.postAdjustment(adjustment.id, 1);

  logger.info(`Inventory AFTER damage adjustment posted: ${await getOnHand(1)} units (Expected: 15)`);
  await printLedger("Scenario 4 Damage/Theft Adjustment");

  logger.info("\n==========================================================");
  logger.info("   ALL TEST SCENARIOS COMPLETED");
  logger.info("==========================================================");
}

runStage2FinalVerification().then(() => {
  process.exit(0);
}).catch(err => {
  logger.error("Final verification script failed", err);
  process.exit(1);
});
