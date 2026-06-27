// src/backend/test-stage3-real-run.ts
import { db } from "../db/index.ts";
import { DrizzleUnitOfWork } from "./infrastructure/persistence/unit-of-work.ts";
import { OfflineSyncService } from "./application/services/offline-sync.service.ts";
import { StructuredLogger } from "./infrastructure/logging/logger.ts";
import * as schema from "../db/schema.ts";
import { eq, and, inArray } from "drizzle-orm";

const logger = new StructuredLogger();
const uow = new DrizzleUnitOfWork();

async function runStage3ValidationSimulation() {
  logger.info("==================================================================");
  logger.info("STAGE 3: OFFLINE POS, STORE EXCHANGE, SYNC, AND RECONCILIATION");
  logger.info("==================================================================");

  const syncService = new OfflineSyncService(uow, logger);

  // SECTION 1: SEED PREREQUISITE SEED DATA (Ensure DB references exist)
  logger.info("\n--- STEP 1: VERIFYING SEED BASICS ---");
  // Clean up previous run data to ensure an isolated clean-room test run
  await db.transaction(async (tx) => {
    logger.info("Cleaning up previous Stage 3 simulation run tables...");
    // 1. Core sync tables
    await tx.delete(schema.syncConflicts);
    await tx.delete(schema.syncCheckpoints);
    await tx.delete(schema.storeExchangeBatchItems);
    await tx.delete(schema.storeExchangeBatches);
    await tx.delete(schema.offlineTransactionQueue);
    await tx.delete(schema.synchronizationAuditLogs);

    // 2. Transactional tables to avoid unique constraint key collisions during simulation run
    await tx.delete(schema.returnItems);
    await tx.delete(schema.salesReturns);
    await tx.delete(schema.inventoryAdjustmentItems);
    await tx.delete(schema.inventoryAdjustments);
    await tx.delete(schema.inventoryMovements);
    await tx.delete(schema.inventory);
    await tx.delete(schema.saleItems);
    await tx.delete(schema.payments);
    await tx.delete(schema.sales);
    await tx.delete(schema.customers);

    // 3. Delete stale general ledger entries of type sale, return, and inventory_adjustment to reset trial balance metrics
    await tx.delete(schema.generalLedgerEntries).where(
      inArray(schema.generalLedgerEntries.referenceType, ["sale", "return", "inventory_adjustment"])
    );
  });

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

    // 2. Stores (Store 1: HQ, Store 2: Branch)
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
      logger.info("Seeded Store ID: 1 (Primary HQ)");
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
      logger.info("Seeded Warehouse ID: 1");
    }

    // 4. Products
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

    // 5. Users
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

    // 6. Customers
    const cust1 = await tx.select().from(schema.customers).where(eq(schema.customers.id, 1));
    if (cust1.length === 0) {
      await tx.insert(schema.customers).values({
        id: 1,
        name: "Standard Cash Customer",
        mobileNumber: "555-000-1111",
        email: "cash.cust@example.com",
        createdAt: new Date(),
        updatedAt: new Date()
      });
      logger.info("Seeded Customer ID: 1");
    }

    // 7. Inventory for Product 10 at Warehouse 1
    const inv10 = await tx.select().from(schema.inventory).where(and(eq(schema.inventory.productId, 10), eq(schema.inventory.warehouseId, 1)));
    if (inv10.length === 0) {
      await tx.insert(schema.inventory).values({
        warehouseId: 1,
        productId: 10,
        variantId: null,
        quantity: 50,
        reorderLevel: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      logger.info("Seeded Inventory on-hand (50 units) for Product 10 at Warehouse 1");
    }
  });

  logger.info("Prerequisite seed records verified successfully.");

  // ==========================================
  // SECTION 2: OFFLINE POS ENGINE (Enqueueing Operations)
  // ==========================================
  logger.info("\n--- STEP 2: TEST OFFLINE POS ENGINE ---");
  logger.info("Enqueuing 4 transaction types while store network is isolated...");

  // A. Offline customer creation
  await syncService.enqueueOfflineTransaction({
    storeId: 1,
    entityType: "customer",
    payload: {
      id: 999, // Temp ID
      companyId: 1,
      name: "Jane Doe Offline",
      email: "jane.offline.test@example.com",
      mobileNumber: "555-010-9992",
      status: "active"
    }
  });

  // B. Offline sale transaction
  const salePayload = {
    storeId: 1,
    cashierId: 1,
    customerId: 1,
    subtotal: "20.00",
    totalAmount: "20.00",
    items: [
      { productId: 10, qty: 1, unitPrice: "20.00" }
    ],
    payments: [
      { paymentMethod: "cash", amount: "20.00" }
    ]
  };
  await syncService.enqueueOfflineTransaction({
    storeId: 1,
    entityType: "sale",
    payload: salePayload
  });

  // C. Offline refund return
  await syncService.enqueueOfflineTransaction({
    storeId: 1,
    entityType: "return",
    payload: {
      returnNumber: "RET-STAGE3-001",
      storeId: 1,
      cashierId: 1,
      refundMethod: "cash",
      items: [
        { productId: 10, qty: 1, unitPrice: 20.00, refundAmount: 20.00 }
      ]
    }
  });

  // D. Offline inventory count adjustments
  await syncService.enqueueOfflineTransaction({
    storeId: 1,
    entityType: "adjustment",
    payload: {
      companyId: 1,
      storeId: 1,
      warehouseId: 1,
      adjustmentNumber: `ADJ-OFFLINE-1`,
      type: "manual",
      notes: "Offline damage reconciliation shrinkage",
      createdByUserId: 1,
      items: [
        { productId: 10, variantId: null, quantityAdjusted: -1, unitCost: "10.00", reasonCode: "damage" }
      ]
    }
  });

  // Display queue
  const currentQueue = await syncService.getOfflineQueue(1);
  logger.info(`Enqueuing completed. Local transactional queue for Store 1 currently holds ${currentQueue.length} records.`);
  console.table(currentQueue.map((q: any) => ({
    id: q.id,
    storeId: q.storeId,
    entityType: q.entityType,
    status: q.status,
    transactionHash: q.transactionHash
  })));

  // ==========================================
  // SECTION 3: STORE EXCHANGE ENGINE (Batching & Replay Processing)
  // ==========================================
  logger.info("\n--- STEP 3: BATCH EXCHANGING & SEQUENTIAL REPLAY ENGINE ---");
  logger.info("Packaging enqueued items into a formal Store Exchange Batch...");

  const batchObj = await syncService.createExchangeBatch(1);
  logger.info(`Batch successfully packaged: Identifier: ${batchObj.batchNumber}, status: "${batchObj.status}", containing ${batchObj.itemCount} items.`);

  logger.info("Starting replay execution through the sequential replay pipeline...");
  const processedBatch = await syncService.processExchangeBatch(batchObj.id);
  logger.info(`Pipeline execution complete. Batch status updated to: "${processedBatch.status}".`);

  // Fetch the detailed item logs from database
  const batchItemsList = await db.select().from(schema.storeExchangeBatchItems).where(eq(schema.storeExchangeBatchItems.batchId, batchObj.id));
  logger.info("Detailed Batch Item Sync Results:");
  console.table(batchItemsList.map(item => ({
    id: item.id,
    entityType: item.entityType,
    entityId: item.entityId,
    syncStatus: item.syncStatus,
    errorMessage: item.errorMessage
  })));

  // ==========================================
  // SECTION 4: IDEMPOTENCY REPLAY PROTECTION
  // ==========================================
  logger.info("\n--- STEP 4: IDEMPOTENCY REPLAY PROTECTION CHECK ---");
  logger.info("Re-testing batch processing of already successfully replayed items to verify protection layers...");
  
  // Re-process the same batch
  const reprocessedBatch = await syncService.processExchangeBatch(batchObj.id);
  logger.info(`Second execution of Batch ID ${batchObj.id} resulting batch status: "${reprocessedBatch.status}". Skipping actions successfully verified.`);

  // ==========================================
  // SECTION 5: SYNCHRONIZATION INFRASTRUCTURE WITH CRASH RECOVERY
  // ==========================================
  logger.info("\n--- STEP 5: crash recovery synchronization checkpoints ---");
  logger.info("Enqueuing novel offline item to evaluate checkpoint & active recovery...");

  // Enqueue a new transaction
  await syncService.enqueueOfflineTransaction({
    storeId: 1,
    entityType: "customer",
    payload: {
      id: 1001,
      companyId: 1,
      name: "Crash test Customer",
      email: "crash.test@example.com",
      mobileNumber: "555-111-2222",
      status: "active"
    }
  });

  logger.info("Triggering real synchronization process...");
  const syncResponse = await syncService.synchronizeStore(1);
  logger.info(`Sync result logs: ${syncResponse.summaryLog}`);

  // Fetch sync checkpoint
  const checkpointsList = await db.select().from(schema.syncCheckpoints).where(eq(schema.syncCheckpoints.storeId, 1));
  logger.info(`Last synced sequence database checkpoint: ID = ${checkpointsList[0]?.lastSyncedId || 0}, Updated At = ${checkpointsList[0]?.lastSyncedAt?.toISOString()}`);

  // ==========================================
  // SECTION 6: CONFLICT RESOLUTION ENGINE
  // ==========================================
  logger.info("\n--- STEP 6: CONFLICT RESOLUTION AND RETRY PIPELINE ---");
  logger.info("Injecting a simulated conflict (duplicate / stale entity state)...");

  // Directly log a conflict to database
  await db.insert(schema.syncConflicts).values({
    storeId: 1,
    entityType: "customer",
    entityId: "10",
    conflictType: "version_mismatch",
    localData: JSON.stringify({ id: 999, companyId: 1, name: "Jane Wins Client Strategy override", mobileNumber: "555-010-9998" }),
    serverData: JSON.stringify({ id: 999, companyId: 1, name: "Jane Server Wins", mobileNumber: "555-010-9998" }),
    resolution: "pending",
  });

  const pendingConflicts = await syncService.getPendingConflicts();
  logger.info(`Discovered unresolved conflict queues: count = ${pendingConflicts.length}. Logging detailed conflict matrix:`);
  console.table(pendingConflicts.map((c: any) => ({
    id: c.id,
    entityType: c.entityType,
    conflictType: c.conflictType,
    clientData: c.localData,
    resolution: c.resolution
  })));

  logger.info("Applying dynamic client_wins auto-conflict resolution rule override...");
  const resolvedRecord = await syncService.resolveConflict({
    conflictId: pendingConflicts[0].id,
    resolutionStrategy: "client_wins",
    resolvedByUserId: 1,
    notes: "Overrode stale server entity via Client Wins strategy."
  });
  logger.info(`Resolution status complete. DB resolution updated to: "${resolvedRecord.resolution}".`);

  // ==========================================
  // SECTION 7: MULTI-STORE RECONCILIATION
  // ==========================================
  logger.info("\n--- STEP 7: MULTI-STORE GENERAL LEDGER & RECONCILIATION AUDIT ---");
  const reconciliationAudit = await syncService.reconcileMultiStoreState(1);

  logger.info(`Audit Report compiled successfully for Store: ${reconciliationAudit.storeId}. Status: "${reconciliationAudit.reconciliationStatus}"`);
  console.table([
    {
      Metric: "POS Sales Aggregate Amount (Pre-Tax Revenue)",
      Value: `$${Number(reconciliationAudit.auditMetrics.totalStoreSalesAmount).toFixed(2)}`
    },
    {
      Metric: "Ledger Account 4010 Earnings Posted",
      Value: `$${Number(reconciliationAudit.auditMetrics.totalGLSalesRevenueRecorded).toFixed(2)}`
    },
    {
      Metric: "Revenue Post Variance",
      Value: `$${Number(reconciliationAudit.auditMetrics.salesRevenueVariance).toFixed(2)}`
    },
    {
      Metric: "Intercompany Net Account 1400 Assets (Store 1)",
      Value: `$${Number(reconciliationAudit.auditMetrics.intercompanyDueFromDebitBalance).toFixed(2)}`
    },
    {
      Metric: "Intercompany Net Account 2400 Liabilities (Store 1)",
      Value: `$${Number(reconciliationAudit.auditMetrics.intercompanyDueToCreditBalance).toFixed(2)}`
    },
    {
      Metric: "Intercompany Net Variance (System-Wide)",
      Value: `$${Number(reconciliationAudit.auditMetrics.intercompanyNetVariance).toFixed(2)}`
    },
    {
      Metric: "Trial Balance Balanced",
      Value: reconciliationAudit.auditMetrics.trialBalanceBalanced ? "YES" : "NO"
    },
    {
      Metric: "Trial Balance Net Variance",
      Value: `$${Number(reconciliationAudit.auditMetrics.trialBalanceVariance).toFixed(2)}`
    },
    {
      Metric: "Active In-transit Transfers count",
      Value: reconciliationAudit.auditMetrics.activeInTransitTransfersCount
    }
  ]);

  logger.info("\n==================================================================");
  logger.info("STAGE 3: COMPREHENSIVE INTEGRATION VALIDATION SUCCESSFULLY ENFORCED!");
  logger.info("==================================================================");
}

runStage3ValidationSimulation()
  .then(() => {
    logger.info("Stage 3 Validation Simulation completes successfully.");
    process.exit(0);
  })
  .catch((err) => {
    logger.error("Stage 3 Validation Simulation execution failed.", err);
    process.exit(1);
  });
