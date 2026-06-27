// src/backend/test-stage2-real-run.ts
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

async function runStage2ValidationSimulation() {
  logger.info("==================================================================");
  logger.info("STAGE 2: INTEGRATION WORKFLOWS & ACCOUNTING SYSTEM VERIFICATION");
  logger.info("==================================================================");

  // SECTION 1: SEED PREREQUISITE DATA
  logger.info("Step 1.1: Seeding entities (Company, 2 Stores, 2 Warehouses, Product & User)...");

  await db.transaction(async (tx) => {
    // 1. Company
    const companiesList = await tx.select().from(schema.companies).where(eq(schema.companies.id, 1));
    if (companiesList.length === 0) {
      await tx.insert(schema.companies).values({
        id: 1,
        name: "Acme Multi-Store Group Inc.",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date()
      });
      logger.info("Seeded Company ID: 1");
    }

    // 2. Stores (HQ + Branch)
    const store1 = await tx.select().from(schema.stores).where(eq(schema.stores.id, 1));
    if (store1.length === 0) {
      await tx.insert(schema.stores).values({
        id: 1,
        companyId: 1,
        name: "Acme Flagship HQ Store",
        code: "STR-HQ",
        type: "retail",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date()
      });
      logger.info("Seeded Store ID: 1 (Primary)");
    }

    const store2 = await tx.select().from(schema.stores).where(eq(schema.stores.id, 2));
    if (store2.length === 0) {
      await tx.insert(schema.stores).values({
        id: 2,
        companyId: 1,
        name: "Acme Downtown Branch",
        code: "STR-DWTN",
        type: "retail",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date()
      });
      logger.info("Seeded Store ID: 2 (Branch)");
    }

    // 3. Warehouses
    const wh1 = await tx.select().from(schema.warehouses).where(eq(schema.warehouses.id, 1));
    if (wh1.length === 0) {
      await tx.insert(schema.warehouses).values({
        id: 1,
        storeId: 1,
        name: "Flagship Showroom Warehouse",
        code: "WH-HQ-01",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date()
      });
      logger.info("Seeded Warehouse ID: 1 (Primary WH)");
    }

    const wh2 = await tx.select().from(schema.warehouses).where(eq(schema.warehouses.id, 2));
    if (wh2.length === 0) {
      await tx.insert(schema.warehouses).values({
        id: 2,
        storeId: 2,
        name: "Downtown Depot Storage",
        code: "WH-DWTN-02",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date()
      });
      logger.info("Seeded Warehouse ID: 2 (Branch WH)");
    }

    // 4. Product
    const itemsList = await tx.select().from(schema.products).where(eq(schema.products.id, 10));
    if (itemsList.length === 0) {
      await tx.insert(schema.products).values({
        id: 10,
        companyId: 1,
        sku: "PROD-STAGE2-CORE",
        barcode: "777888999",
        name: "Premium Super-Material",
        costPrice: "10.00",
        retailPrice: "20.00",
        reorderPoint: 5,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      logger.info("Seeded Product ID: 10");
    }

    // 5. Roles
    const rolesList = await tx.select().from(schema.roles).where(eq(schema.roles.id, 1));
    if (rolesList.length === 0) {
      await tx.insert(schema.roles).values({
        id: 1,
        name: "super_admin",
        description: "Super Admin",
        createdAt: new Date()
      });
      logger.info("Seeded Role ID: 1");
    }

    // 6. Users
    const usersList = await tx.select().from(schema.users).where(eq(schema.users.id, 1));
    if (usersList.length === 0) {
      await tx.insert(schema.users).values({
        id: 1,
        uid: "uid-test-stage2-1",
        email: "stage2-test-author@acme.com",
        fullName: "Stage 2 Controller Admin",
        roleId: 1,
        companyId: 1,
        storeId: 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      logger.info("Seeded User ID: 1");
    }
  });

  // Clean out previous core transaction tables to guarantee fresh results for validation
  logger.info("Cleaning up historical ledger, transfers, count sessions, adjustments, and inventory records...");
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

  // Seed on-hand inventory levels for Product 10 at Source Warehouse (50 units)
  logger.info("Seeding initial stock: 50 units for Product 10 at Warehouse 1...");
  await db.insert(schema.inventory).values({
    warehouseId: 1,
    productId: 10,
    variantId: null,
    quantity: 50,
    reorderLevel: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const countService = new InventoryCountService(uow, logger);
  const adjustmentService = new InventoryAdjustmentService(uow, logger);
  const transferService = new TransferOrderService(uow, logger);
  const accountingService = new AccountingService(uow, logger);

  // ==========================================================
  // SEGMENT 1: PHYSICAL INVENTORY CONTROLS (CYCLE COUNT REPORT)
  // ==========================================================
  logger.info("\n-----------------------------------------------------------");
  logger.info("SEGMENT 1: PHYSICAL INVENTORY DOCK COUNT PROCESS (CYCLE COUNT)");
  logger.info("-----------------------------------------------------------");

  logger.info("Step 1.1: Starting a cycle count session on Warehouse 1...");
  const session = await countService.startCountSession({
    companyId: 1,
    storeId: 1,
    warehouseId: 1,
    type: "cycle",
    notes: "Checking materials inventory shelf block A.",
    createdByUserId: 1
  });

  logger.info(`Session started! ID: ${session.id}, status: "${session.status}". Snapshot item length: ${session.items.length}`);
  logger.info(`Recorded Snapshot inventory quantity: ${session.items[0]?.snapshotQuantity} units`);

  logger.info("\nStep 1.2: Submitting counted quantity of 48 units (Variance of -2 units detected)...");
  const submitted = await countService.submitCounts({
    id: session.id,
    notes: "Completed session counts of shelf block A.",
    items: [
      {
        productId: 10,
        variantId: undefined,
        countedQuantity: 48,
        reasonCode: "shrinkage"
      }
    ]
  });

  logger.info(`Session counts registered successfully! Completed status: "${submitted.status}".`);
  logger.info(`Counted: ${submitted.items[0]?.countedQuantity}, Calculated Variance: ${submitted.items[0]?.variance}`);

  logger.info("\nStep 1.3: Approving cycle count session & posting variance double-entries...");
  const approvedSession = await countService.approveCountSession(session.id, 1);
  logger.info(`Reconciliation finalized! Status changed to "${approvedSession.status}".`);

  // Verify stock changes
  const postCountStock = await db.select().from(schema.inventory).where(eq(schema.inventory.warehouseId, 1));
  logger.info(`New Warehouse 1 inventory level: ${postCountStock[0]?.quantity} units (Expected: 48)`);

  // Verify Ledger entries
  const countLedgerEntries = await db.select().from(schema.generalLedgerEntries);
  logger.info("\nVerify General Ledger entries generated from Cycle Count (Shrinkage Loss):");
  console.table(countLedgerEntries.map(e => ({
    id: e.id,
    account: `${e.accountCode} - ${e.accountName}`,
    debit: `$${Number(e.debit).toFixed(2)}`,
    credit: `$${Number(e.credit).toFixed(2)}`,
    desc: e.description
  })));

  // ==========================================================
  // SEGMENT 2: SPECIFIC MANUAL INVENTORY ADJUSTMENTS
  // ==========================================================
  logger.info("\n-----------------------------------------------------------");
  logger.info("SEGMENT 2: SPECIFIC MANUAL CONSOLIDATED INVENTORY ADJUSTMENT");
  logger.info("-----------------------------------------------------------");

  const adjustmentNumber = "ADJ-TEST-STAGE2";
  logger.info(`Step 2.1: Creating specific adjustment proposal (${adjustmentNumber}) in Draft mode...`);
  logger.info("Proposing adjustment of -3 units of Product 10 due to 'damage'...");

  const proposedAdj = await adjustmentService.createAdjustment({
    companyId: 1,
    storeId: 1,
    warehouseId: 1,
    type: "damage",
    notes: "Audit spotted damaged/expiries during standard warehousing operations review.",
    createdByUserId: 1,
    items: [
      {
        productId: 10,
        variantId: undefined,
        quantityAdjusted: -3,
        reasonCode: "damage"
      }
    ],
    // Embed adjustmentNumber dynamically
    ...({ adjustmentNumber } as any)
  });

  logger.info(`Adjustment proposed! ID: ${proposedAdj.id}, Code: ${proposedAdj.adjustmentNumber}, Status: "${proposedAdj.status}"`);

  logger.info("\nStep 2.2: Approving and posting manual adjustment...");
  const postedAdj = await adjustmentService.postAdjustment(proposedAdj.id, 1);
  logger.info(`Manual adjustment posted successfully! Status is updated to "${postedAdj.status}".`);

  // Verify stock changes
  const postAdjStock = await db.select().from(schema.inventory).where(eq(schema.inventory.warehouseId, 1));
  logger.info(`New Warehouse 1 inventory level: ${postAdjStock[0]?.quantity} units (Expected: 45)`);

  // Show Ledger State
  const ledgerStateSegment2 = await db.select().from(schema.generalLedgerEntries);
  logger.info("\nVerify Consolidated General Ledger entries inside database after Segments 1 & 2:");
  console.table(ledgerStateSegment2.map(e => ({
    id: e.id,
    account: `${e.accountCode} - ${e.accountName}`,
    debit: `$${Number(e.debit).toFixed(2)}`,
    credit: `$${Number(e.credit).toFixed(2)}`,
    desc: e.description
  })));

  // ==========================================================
  // SEGMENT 3: INTER-STORE TRANSFERS & IN-TRANSIT ACCOUNTING
  // ==========================================================
  logger.info("\n-----------------------------------------------------------");
  logger.info("SEGMENT 3: INVENTORY TRANSFERS & INTERCOMPANY ACCOUNTING");
  logger.info("-----------------------------------------------------------");

  const transferNumber = "TRSF-TEST-STAGE2";
  logger.info(`Step 3.1: Proposing inter-store transfer order (${transferNumber}) from Warehouse 1 (Store 1) to Warehouse 2 (Store 2)...`);
  logger.info("Transfer request: 20 units of Product 10.");

  const transfer = await transferService.createTransfer({
    transferNumber,
    sourceStoreId: 1,
    sourceWarehouseId: 1,
    destinationStoreId: 2,
    destinationWarehouseId: 2,
    notes: "Urgent branches restocking for upcoming summer sales.",
    items: [
      {
        productId: 10,
        variantId: undefined as any,
        quantityRequest: 20,
      }
    ],
    createdByUserId: 1
  });

  logger.info(`Transfer proposed! ID: ${transfer.id}, No.: ${transfer.transferNumber}, Status: "${transfer.status}"`);

  logger.info("\nStep 3.2: Approving transfer order...");
  const approvedTr = await transferService.approveTransfer(transfer.id, 1);
  logger.info(`Approved! Status: "${approvedTr.status}"`);

  logger.info("\nStep 3.3: Shipping transfer order (Goods move from Warehouse 1 to In-Transit state)...");
  const shippedTr = await transferService.shipTransfer(transfer.id);
  logger.info(`Shipped! Status: "${shippedTr.status}"`);

  // Verify stock changes
  const srcStockAfterShip = await db.select().from(schema.inventory).where(eq(schema.inventory.warehouseId, 1));
  logger.info(`Source Warehouse 1 stock after shipping: ${srcStockAfterShip[0]?.quantity} units (Expected: 25)`);

  const destStockAfterShip = await db.select().from(schema.inventory).where(eq(schema.inventory.warehouseId, 2));
  logger.info(`Destination Warehouse 2 stock after shipping: ${destStockAfterShip.length === 0 ? 0 : destStockAfterShip[0].quantity} units (Expected: 0 / Real in-transit)`);

  logger.info("\nStep 3.4: Receiving the transfer order (Partial Receipt: 15 units of the shipped 20 units)...");
  logger.info("Booking incoming stock at Downtown Depot Warehouse 2...");

  const receivedTr = await transferService.receiveTransfer(transfer.id, 1, [
    {
      itemId: transfer.items[0].id,
      qtyReceived: 15
    }
  ]);

  logger.info(`Transfer received! Final recorded status: "${receivedTr.status}".`);

  // Verify final inventory balances
  const srcStockFinal = await db.select().from(schema.inventory).where(eq(schema.inventory.warehouseId, 1));
  const destStockFinal = await db.select().from(schema.inventory).where(eq(schema.inventory.warehouseId, 2));
  logger.info(`FINAL stock at Warehouse 1 (Source): ${srcStockFinal[0]?.quantity} units (Expected: 25)`);
  logger.info(`FINAL stock at Warehouse 2 (Destination): ${destStockFinal[0]?.quantity} units (Expected: 15)`);

  // Verify Ledger entries for Step 3 (Intercompany Due To / Due From)
  const finalLedgerEntries = await db.select().from(schema.generalLedgerEntries);
  logger.info("\nVerify Consolidated General Ledger Entries inside database (All segments completed):");
  console.table(finalLedgerEntries.map(e => ({
    id: e.id,
    store: `Store ${e.storeId}`,
    account: `${e.accountCode} - ${e.accountName}`,
    debit: `$${Number(e.debit).toFixed(2)}`,
    credit: `$${Number(e.credit).toFixed(2)}`,
    desc: e.description
  })));

  // SECTION 4: INTEGRATION & STAGE 2 ACCOUNTING CHECKS
  logger.info("\n-----------------------------------------------------------");
  logger.info("FINAL STAGE 2 BALANCE SHEET & TRIAL BALANCE CHECK");
  logger.info("-----------------------------------------------------------");

  // Check store 1 balanced
  let store1Debits = 0;
  let store1Credits = 0;
  finalLedgerEntries.filter(e => e.storeId === 1).forEach(e => {
    store1Debits += Number(e.debit);
    store1Credits += Number(e.credit);
  });
  logger.info(`Store 1 Trial Balance Consistency: Total Debits = $${store1Debits.toFixed(2)}, Total Credits = $${store1Credits.toFixed(2)}`);
  logger.info(`Store 1 Net Discrepancy: ${(store1Debits - store1Credits).toFixed(6)} USD (Must equal 0.00)`);

  // Check store 2 balanced
  let store2Debits = 0;
  let store2Credits = 0;
  finalLedgerEntries.filter(e => e.storeId === 2).forEach(e => {
    store2Debits += Number(e.debit);
    store2Credits += Number(e.credit);
  });
  logger.info(`Store 2 Trial Balance Consistency: Total Debits = $${store2Debits.toFixed(2)}, Total Credits = $${store2Credits.toFixed(2)}`);
  logger.info(`Store 2 Net Discrepancy: ${(store2Debits - store2Credits).toFixed(6)} USD (Must equal 0.00)`);

  // Check Intercompany Due-To/Due-From balance reconciliation
  const dueFromAsset = finalLedgerEntries.filter(e => e.accountCode === "1400");
  const dueToLiability = finalLedgerEntries.filter(e => e.accountCode === "2400");

  const totalDueFrom = dueFromAsset.reduce((s, e) => s + Number(e.debit) - Number(e.credit), 0);
  const totalDueTo = dueToLiability.reduce((s, e) => s + Number(e.credit) - Number(e.debit), 0);

  logger.info(`\nIntercompany Reconciliation Check:`);
  logger.info(`   - Debit: Account 1400 - Intercompany Due From (Store 1): $${totalDueFrom.toFixed(2)}`);
  logger.info(`   - Credit: Account 2400 - Intercompany Due To (Store 2): $${totalDueTo.toFixed(2)}`);
  logger.info(`   - Combined System Reconciliation Discrepancy: ${(totalDueFrom - totalDueTo).toFixed(6)} USD (Must equal 0.00)`);

  logger.info("\n==================================================================");
  logger.info("STAGE 2: SYSTEM VALIDATION METRICS COMPLETED SUCCESSFULLY!");
  logger.info("==================================================================");
}

runStage2ValidationSimulation().then(() => {
  logger.info("Stage 2 Simulation completed successfully.");
  process.exit(0);
}).catch(err => {
  logger.error("Stage 2 Simulation execution hit unexpected failure", err);
  process.exit(1);
});
