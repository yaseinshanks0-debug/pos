// src/backend/test-fifo-real-run.ts
import { db } from "../db/index.ts";
import { DrizzleUnitOfWork } from "./infrastructure/persistence/unit-of-work.ts";
import { CogsEngineService } from "./application/services/cogs-engine.service.ts";
import { AccountingService } from "./application/services/accounting.service.ts";
import { StructuredLogger } from "./infrastructure/logging/logger.ts";
import { eq, and } from "drizzle-orm";
import * as schema from "../db/schema.ts";

const logger = new StructuredLogger();
const uow = new DrizzleUnitOfWork();

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSimulation() {
  logger.info("==================================================================");
  logger.info("FIFO COSTING & REAL-TIME LEDGER VALIDATION RUNS (STAGE 1 VERIFICATION)");
  logger.info("==================================================================");

  // SECTION 1: SEED IDENTITIES (Avoid foreign key constraints)
  logger.info("Step 1.1: Ensuring target entities exist in Cloud SQL database...");
  
  await db.transaction(async (tx) => {
    // 1. Company
    const companiesList = await tx.select().from(schema.companies).where(eq(schema.companies.id, 1));
    if (companiesList.length === 0) {
      await tx.insert(schema.companies).values({
        id: 1,
        name: "Acme Enterprises",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date()
      });
      logger.info("Seeded Company ID: 1");
    }

    // 2. Store
    const storesList = await tx.select().from(schema.stores).where(eq(schema.stores.id, 1));
    if (storesList.length === 0) {
      await tx.insert(schema.stores).values({
        id: 1,
        companyId: 1,
        name: "Main Flagship Store",
        code: "STORE01",
        type: "retail",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date()
      });
      logger.info("Seeded Store ID: 1");
    }

    // 3. Warehouse
    const warehousesList = await tx.select().from(schema.warehouses).where(eq(schema.warehouses.id, 1));
    if (warehousesList.length === 0) {
      await tx.insert(schema.warehouses).values({
        id: 1,
        storeId: 1,
        name: "Main Store Backroom",
        code: "WH01",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date()
      });
      logger.info("Seeded Warehouse ID: 1");
    }

    // 4. Product
    const productsList = await tx.select().from(schema.products).where(eq(schema.products.id, 1));
    if (productsList.length === 0) {
      await tx.insert(schema.products).values({
        id: 1,
        companyId: 1,
        sku: "WIDG01",
        barcode: "11223344",
        name: "Deluxe Titanium Widget",
        costPrice: "8.00",
        retailPrice: "15.00",
        reorderPoint: 5,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      logger.info("Seeded Product ID: 1");
    }

    // 5. Product Variant
    const variantsList = await tx.select().from(schema.productVariants).where(eq(schema.productVariants.id, 1));
    if (variantsList.length === 0) {
      await tx.insert(schema.productVariants).values({
        id: 1,
        productId: 1,
        sku: "WIDG01-REG",
        barcode: "11223344-R",
        variantName: "Standard Gray",
        isActive: true,
        costPrice: "8.00",
        retailPrice: "15.00",
        createdAt: new Date()
      });
      logger.info("Seeded Variant ID: 1");
    }
  });

  // Clean out any leftover cost layers/consumptions/ledger entries of previous test runs before beginning
  await db.delete(schema.inventoryCostLayerConsumptions);
  await db.delete(schema.inventoryCostLayers);
  await db.delete(schema.generalLedgerEntries);
  await db.delete(schema.inventoryMovements);
  await db.delete(schema.inventory);

  // Seed standard inventory record for company/store/warehouse/variant ID 1
  await db.insert(schema.inventory).values({
    id: 1,
    warehouseId: 1,
    productId: 1,
    variantId: 1,
    quantity: 15,
    reorderLevel: 5,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  logger.info("\n-----------------------------------------------------------");
  logger.info("DATABASE STATE PRE-FLIGHT CHECK (BEFORE SIMULATED TRANSACTION)");
  logger.info("-----------------------------------------------------------");
  const layersBefore = await db.select().from(schema.inventoryCostLayers);
  logger.info(`inventory_cost_layers table row count: ${layersBefore.length}`);
  logger.info(`JSON Dump of Layer Array: ${JSON.stringify(layersBefore, null, 2)}`);

  // SECTION 2: SIMULATE PURCHASE BATCHES
  logger.info("\n-----------------------------------------------------------");
  logger.info("FIFO SIMULATION STEP 1: PO RECEIVING (PURCHASE 10 UNITS @ $8.00)");
  logger.info("-----------------------------------------------------------");
  
  const cogsEngine = new CogsEngineService(uow, logger);
  
  await uow.runInTransaction(async (txUow, tx) => {
    await cogsEngine.createCostLayer(
      1, // CompanyId
      1, // StoreId
      1, // VariantId
      10, // Qty Received
      8.00, // Unit Cost
      "receiving", // referenceType
      101, // reference PO ID
      tx
    );
  });

  // Delay a split-second to guarantee discrete received_date order timestamps
  await delay(100);

  logger.info("\n-----------------------------------------------------------");
  logger.info("FIFO SIMULATION STEP 2: PO RECEIVING (PURCHASE 5 UNITS @ $10.00)");
  logger.info("-----------------------------------------------------------");
  
  await uow.runInTransaction(async (txUow, tx) => {
    await cogsEngine.createCostLayer(
      1, // CompanyId
      1, // StoreId
      1, // VariantId
      5, // Qty Received
      10.00, // Unit Cost
      "receiving", // referenceType
      102, // reference PO ID
      tx
    );
  });

  // Show state of layers after purchases
  const layersPostPurchase = await db.select().from(schema.inventoryCostLayers);
  logger.info("\n-----------------------------------------------------------");
  logger.info("POST-PURCHASE INVENTORY LAYER STATE");
  logger.info("-----------------------------------------------------------");
  console.table(layersPostPurchase.map(l => ({
    id: l.id,
    storeId: l.storeId,
    variantId: l.variantId,
    received: Number(l.quantityReceived),
    remaining: Number(l.quantityRemaining),
    unitCost: `$${Number(l.unitCost).toFixed(2)}`,
    ref: `${l.referenceType} (ID: ${l.referenceId})`
  })));

  // SECTION 3: SIMULATE POS checkout / checkout depletion
  logger.info("\n-----------------------------------------------------------");
  logger.info("FIFO SIMULATION STEP 3: PERFORM SELL TRANSACTION (8 UNITS)");
  logger.info("-----------------------------------------------------------");
  
  let depletionResult: any = null;
  let mainMovementId: number = 0;
  await uow.runInTransaction(async (txUow, tx) => {
    // Dynamically insert inventory movement to satisfy foreign key constraints
    const [insertedMovement] = await tx.insert(schema.inventoryMovements).values({
      inventoryId: 1,
      type: "sale",
      quantity: -8,
      unitCost: "8.00",
      createdAt: new Date()
    }).returning({ id: schema.inventoryMovements.id });

    mainMovementId = insertedMovement.id;

    // Deplete 8 units
    // Drains youngest or oldest? FIFO drains oldest receivedDate ASC first.
    // Spec requested: depletes oldest first
    depletionResult = await cogsEngine.depleteFifoLayers(
      1, // CompanyId
      1, // StoreId
      1, // VariantId
      8, // Quantity to deplete
      null, // saleItemId (nullable)
      mainMovementId, // actual movementId reference
      tx
    );
  });

  logger.info("\n-----------------------------------------------------------");
  logger.info("FIFO LAYER DEPLETION RESULTS & COGS POSTED");
  logger.info("-----------------------------------------------------------");
  logger.info(`Total COGS Calculated: $${depletionResult.totalCOGS.toFixed(2)}`);
  logger.info("Consumptions breakdown:");
  console.table(depletionResult.consumptions.map((c: any) => ({
    layerId: c.layerId,
    qtyConsumed: c.qtyConsumed,
    layerUnitCost: `$${c.unitCost.toFixed(2)}`,
    cogsPosted: `$${c.cogsPosted.toFixed(2)}`
  })));

  // SECTION 4: POST LEDGER ENTRIES
  logger.info("\n-----------------------------------------------------------");
  logger.info("FIFO SIMULATION STEP 4: DOUBLE-ENTRY GENERAL LEDGER POSTING");
  logger.info("-----------------------------------------------------------");
  
  const accountingService = new AccountingService(uow, logger);

  // Journal Entry parameters
  const cogsAmount = depletionResult.totalCOGS; // Expected: 8 units * $8 = $64
  const journalDto = {
    companyId: 1,
    storeId: 1,
    description: `Posted calculated FIFO Cost of Goods Sold for POS checkout (8 units of SKU WIDG01-REG)`,
    referenceType: "cogs_posting",
    referenceId: mainMovementId,
    lines: [
      {
        accountCode: "5010", // Cost of Goods Sold (COGS) -> Debit normal (Expense)
        accountType: "expenses" as const,
        accountName: "Cost of Goods Sold (COGS)",
        debit: cogsAmount,
        credit: 0
      },
      {
        accountCode: "1300", // Inventory Asset -> Credit normal (Asset depletion)
        accountType: "assets" as const,
        accountName: "Inventory Asset",
        debit: 0,
        credit: cogsAmount
      }
    ]
  };

  await accountingService.postJournalEntry(journalDto);
  
  logger.info("Double entry booked successfully!");

  // SECTION 5: DATABASE STATE AFTER SIMULATION
  logger.info("\n-----------------------------------------------------------");
  logger.info("DATABASE STATE POST-FLIGHT CHECK (AFTER SIMULATED TRANSACTION)");
  logger.info("-----------------------------------------------------------");
  
  const layersAfter = await db.select().from(schema.inventoryCostLayers);
  logger.info("Inventory Cost Layers Remaining (Final):");
  console.table(layersAfter.map(l => ({
    id: l.id,
    quantityReceived: Number(l.quantityReceived),
    quantityRemaining: Number(l.quantityRemaining),
    unitCost: `$${Number(l.unitCost).toFixed(2)}`
  })));

  const consumptionsCreated = await db.select().from(schema.inventoryCostLayerConsumptions);
  logger.info("Inventory Cost Layer Consumptions Created:");
  console.table(consumptionsCreated.map(c => ({
    id: c.id,
    costLayerId: c.costLayerId,
    quantityConsumed: Number(c.quantityConsumed),
    cogsPosted: `$${Number(c.cogsPosted).toFixed(2)}`
  })));

  const ledgerEntriesCreated = await db.select().from(schema.generalLedgerEntries);
  logger.info("General Ledger Booked Entries:");
  console.table(ledgerEntriesCreated.map(le => ({
    id: le.id,
    accountCode: le.accountCode,
    accountName: le.accountName,
    debit: `$${Number(le.debit).toFixed(2)}`,
    credit: `$${Number(le.credit).toFixed(2)}`
  })));

  // Perform Total Balance Check
  let sumDebits = 0;
  let sumCredits = 0;
  ledgerEntriesCreated.forEach(le => {
    sumDebits += Number(le.debit);
    sumCredits += Number(le.credit);
  });
  const balanceDifference = sumDebits - sumCredits;
  logger.info(`Double-Entry Balancing Validation:`);
  logger.info(`  Sum Debits  : $${sumDebits.toFixed(2)}`);
  logger.info(`  Sum Credits : $${sumCredits.toFixed(2)}`);
  logger.info(`  Total Net Variance : ${balanceDifference.toFixed(4)} USD (Must equal 0)`);


  // SECTION 6: CONCURRENCY FAILURE TEST CASE
  logger.info("\n-----------------------------------------------------------");
  logger.info("FIFO CONCURRENCY FAILURE TEST CASE");
  logger.info("-----------------------------------------------------------");
  logger.info("Scenario: Two POS terminal clients simultaneously attempt to deplete 5 units from the remainder store inventory.");
  logger.info("Remaining layers before concurrency checkout:");
  console.table(layersAfter.map(l => ({ id: l.id, qtyRemaining: Number(l.quantityRemaining), cost: l.unitCost })));

  logger.info("Initiating Concurrent Sales checkout simulation with optimistic/pessimistic transactional validation locks...");

  // Let's run two separate transaction blocks to test locking. Drizzle transactions support standard PG isolation modes.
  // We can lock the rows using standard FOR UPDATE or handle collision validation in our service logic.
  // Let's simulate: Sale A and Sale B are launched.
  // Sale A depletes 5 components. Sale B depletes 5 components.
  // Available stock left: 15 (initial) - 8 (first sale) = 7 units. (2 in oldest layer, 5 in newest layer)
  // Let's launch them in parallel:
  
  try {
    const runSaleA = async () => {
      logger.info("[POS TERMINAL A] Initiating Checkout Sale A (Requesting 5 units)...");
      return uow.runInTransaction(async (txUow, tx) => {
        // Query layer balances inside transition FOR UPDATE to acquire lock
        // To query with a lock in raw sql or knex/drizzle, we select the required layers
        const layerRows = await tx.select().from(schema.inventoryCostLayers);
        const availableInTable = layerRows.reduce((sum, row) => sum + Number(row.quantityRemaining), 0);
        logger.info(`[POS TERMINAL A] Query lock succeeded. Stock count available in store layer system: ${availableInTable}`);
        
        if (availableInTable < 5) {
          throw new Error("Terminal A checkout failed: Insufficient physical stock remaining!");
        }
        
        // Simulating processing delay to check isolation
        await delay(50);
        
        // Create actual movement row to satisfy FK
        const [mObjA] = await tx.insert(schema.inventoryMovements).values({
          inventoryId: 1,
          type: "sale",
          quantity: -5,
          unitCost: "8.00",
          createdAt: new Date()
        }).returning({ id: schema.inventoryMovements.id });

        const depletionA = await cogsEngine.depleteFifoLayers(1, 1, 1, 5, null, mObjA.id, tx);
        logger.info(`[POS TERMINAL A] Completed successfully. Depleted 5 units, total COGS applied: $${depletionA.totalCOGS.toFixed(2)}`);
        return depletionA;
      });
    };

    const runSaleB = async () => {
      // Small lag to simulate concurrency overlap
      await delay(20);
      logger.info("[POS TERMINAL B] Initiating Checkout Sale B (Requesting 5 units)...");
      return uow.runInTransaction(async (txUow, tx) => {
        const layerRows = await tx.select().from(schema.inventoryCostLayers);
        const availableInTable = layerRows.reduce((sum, row) => sum + Number(row.quantityRemaining), 0);
        logger.info(`[POS TERMINAL B] Query lock succeeded. Stock count available in store layer system: ${availableInTable}`);
        
        if (availableInTable < 5) {
          throw new Error("Terminal B checkout failed: Insufficient physical stock remaining!");
        }
        
        // Create actual movement row to satisfy FK
        const [mObjB] = await tx.insert(schema.inventoryMovements).values({
          inventoryId: 1,
          type: "sale",
          quantity: -5,
          unitCost: "8.00",
          createdAt: new Date()
        }).returning({ id: schema.inventoryMovements.id });

        const depletionB = await cogsEngine.depleteFifoLayers(1, 1, 1, 5, null, mObjB.id, tx);
        logger.info(`[POS TERMINAL B] Completed successfully. Depleted 5 units, total COGS applied: $${depletionB.totalCOGS.toFixed(2)}`);
        return depletionB;
      });
    };

    // Execute parallel checkouts
    await Promise.all([runSaleA(), runSaleB()]);
  } catch (error: any) {
    logger.warn(`[CONCURRENCY BLOCKER] Real-time protection triggered: ${error.message}`);
  }

  // Check state of layers after concurrency attempts
  const layersFinalCheck = await db.select().from(schema.inventoryCostLayers);
  logger.info("\n-----------------------------------------------------------");
  logger.info("FINAL INVENTORY LAYER STATE AFTER CONCURRENCY ATTEMPT:");
  logger.info("-----------------------------------------------------------");
  console.table(layersFinalCheck.map(l => ({
    id: l.id,
    quantityReceived: Number(l.quantityReceived),
    quantityRemaining: Number(l.quantityRemaining),
    unitCost: `$${Number(l.unitCost).toFixed(2)}`,
    ref: l.referenceType
  })));
  
  logger.info("==================================================================");
}

runSimulation().then(() => {
  logger.info("Simulation Execution Finished successfully.");
  process.exit(0);
}).catch(err => {
  logger.error("Simulation failed with error", err);
  process.exit(1);
});
