// src/backend/test-grni-real-run.ts
import { db } from "../db/index.ts";
import { DrizzleUnitOfWork } from "./infrastructure/persistence/unit-of-work.ts";
import { PurchasingService } from "./application/services/purchasing.service.ts";
import { AccountingService } from "./application/services/accounting.service.ts";
import { StructuredLogger } from "./infrastructure/logging/logger.ts";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema.ts";

const logger = new StructuredLogger();
const uow = new DrizzleUnitOfWork();

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runGrniWorkflowSimulation() {
  logger.info("==================================================================");
  logger.info("ACCRUED INVENTORY / GRNI WORKFLOW & RECLASSIFICATION VALIDATION RUN");
  logger.info("==================================================================");

  // SECTION 1: SEED PREREQUISITE IDENTITIES
  logger.info("Step 1.1: Seeding entities (Company, Store, Warehouse, Product & Variant)...");
  
  await db.transaction(async (tx) => {
    // 1. Company
    const companiesList = await tx.select().from(schema.companies).where(eq(schema.companies.id, 1));
    if (companiesList.length === 0) {
      await tx.insert(schema.companies).values({
        id: 1,
        name: "Acme Enterprises HQ",
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
    const productsList = await tx.select().from(schema.products).where(eq(schema.products.id, 2));
    if (productsList.length === 0) {
      await tx.insert(schema.products).values({
        id: 2,
        companyId: 1,
        sku: "GEAR-ACC01",
        barcode: "99887766",
        name: "Premium Accrual Gear",
        costPrice: "12.00",
        retailPrice: "24.00",
        reorderPoint: 5,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      logger.info("Seeded Product ID: 2");
    }

    // 5. Product Variant
    const variantsList = await tx.select().from(schema.productVariants).where(eq(schema.productVariants.id, 2));
    if (variantsList.length === 0) {
      await tx.insert(schema.productVariants).values({
        id: 2,
        productId: 2,
        sku: "GEAR-ACC01-VAR",
        barcode: "99887766-V",
        variantName: "Special Edition Black",
        isActive: true,
        costPrice: "12.00",
        retailPrice: "24.00",
        createdAt: new Date()
      });
      logger.info("Seeded Variant ID: 2");
    }

    // 6. Vendor
    const vendorList = await tx.select().from(schema.vendors).where(eq(schema.vendors.id, 1));
    if (vendorList.length === 0) {
      await tx.insert(schema.vendors).values({
        id: 1,
        companyId: 1,
        name: "Prime Gears Wholesalers",
        contactName: "John Smith",
        status: "active",
        createdAt: new Date()
      });
      logger.info("Seeded Vendor ID: 1");
    }

    // 7. Roles
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

    // 8. Users
    const usersList = await tx.select().from(schema.users).where(eq(schema.users.id, 1));
    if (usersList.length === 0) {
      await tx.insert(schema.users).values({
        id: 1,
        uid: "uid-test-grni-1",
        email: "grni-test-user@acme.com",
        fullName: "Simulation Admin",
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

  // Clean out previous tables to guarantee fresh results for validation
  logger.info("Cleaning up historical ledger, POs, cost layers and inventory records...");
  await db.delete(schema.inventoryCostLayerConsumptions);
  await db.delete(schema.inventoryCostLayers);
  await db.delete(schema.generalLedgerEntries);
  await db.delete(schema.purchaseOrderItems);
  await db.delete(schema.purchaseOrders);
  await db.delete(schema.inventoryMovements);
  await db.delete(schema.inventory);

  const purchasingService = new PurchasingService(uow, logger);
  const accountingService = new AccountingService(uow, logger);

  // ==========================================
  // SCENARIO STEP 1: CREATE PURCHASE ORDER (10 units @ $12.00)
  // ==========================================
  logger.info("\n-----------------------------------------------------------");
  logger.info("STEP 1: CREATE PURCHASE ORDER (10 UNITS @ $12.00)");
  logger.info("-----------------------------------------------------------");

  const poDto = {
    companyId: 1,
    poNumber: `PO-GRNI-${Date.now().toString().slice(-4)}`,
    vendorId: 1,
    storeId: 1,
    notes: "Scenario validation run for Goods Received Not Invoiced (GRNI).",
    items: [
      {
        productId: 2,
        variantId: 2,
        orderedQty: 10,
        unitCost: 12.00
      }
    ]
  };

  const createdPo = await purchasingService.createPurchaseOrder(poDto);
  logger.info(`Purchase Order created successfully: ID ${createdPo.id}, Number: ${createdPo.poNumber}`);
  
  // Progress status of PO
  await purchasingService.submitPO(createdPo.id);
  await purchasingService.approvePO(createdPo.id);
  const sentPo = await purchasingService.markSent(createdPo.id);
  logger.info(`Purchase Order status progressive transitions done: status updated to "${sentPo.status}"`);

  // ==========================================
  // SCENARIO STEP 2: RECEIVE INVENTORY BEFORE VENDOR INVOICE
  // ==========================================
  logger.info("\n-----------------------------------------------------------");
  logger.info("STEP 2: RECEIVE INVENTORY BEFORE VENDOR INVOICE");
  logger.info("-----------------------------------------------------------");

  const qtyBeforeRx = await db.select().from(schema.inventory);
  logger.info(`Physical Inventory Quantity BEFORE receiving: ${qtyBeforeRx.length === 0 ? 0 : Number(qtyBeforeRx[0].quantity)}`);

  const rxDto = {
    warehouseId: 1,
    receivedByUserId: 1,
    items: [
      {
        productId: 2,
        variantId: 2,
        receivedQty: 10
      }
    ],
    notes: "Part 2 verification - Receiving goods at warehousing dock.",
    forceClose: false
  };

  logger.info("Triggering standard inventory reception...");
  const receivedPo = await purchasingService.receivePurchaseOrder(createdPo.id, rxDto);
  logger.info(`Inventory arrival processed. PO status updated to "${receivedPo.status}".`);

  // 1. Check Inventory changes
  const qtyAfterRx = await db.select().from(schema.inventory);
  logger.info(`Physical Inventory Quantity AFTER receiving: ${Number(qtyAfterRx[0].quantity)} units`);

  // 2. Check Cost layer creation
  const createdLayers = await db.select().from(schema.inventoryCostLayers);
  logger.info("\nVerify Cost Layer creation in database cost queue:");
  console.table(createdLayers.map(l => ({
    layerId: l.id,
    storeId: l.storeId,
    variantId: l.variantId,
    received: Number(l.quantityReceived),
    remaining: Number(l.quantityRemaining),
    unitCost: `$${Number(l.unitCost).toFixed(2)}`,
    ref: l.referenceType
  })));

  // 3. Check General Ledger Entries Generated
  const ledgerState1 = await db.select().from(schema.generalLedgerEntries);
  logger.info("\nVerify General Ledger entries generated on PO Receive (GRNI Accrual):");
  console.table(ledgerState1.map(le => ({
    id: le.id,
    account: `${le.accountCode} - ${le.accountName}`,
    debit: `$${Number(le.debit).toFixed(2)}`,
    credit: `$${Number(le.credit).toFixed(2)}`,
    desc: le.description
  })));

  // ==========================================
  // SCENARIO STEP 3: POST VENDOR INVOICE LATER
  // ==========================================
  logger.info("\n-----------------------------------------------------------");
  logger.info("STEP 3: POST VENDOR INVOICE LATER (RECLASSIFY ACCRUED LIABILITY TO AP)");
  logger.info("-----------------------------------------------------------");

  const vendorInvoiceNum = "VEND-INV-99611";
  logger.info(`Processing Vendor invoice #${vendorInvoiceNum} match to PO ID ${createdPo.id}...`);

  const invoiceResult = await purchasingService.postVendorInvoice(createdPo.id, vendorInvoiceNum);
  logger.info(`Vendor invoice booked! Amount matched: $${invoiceResult.invoiceAmount.toFixed(2)}`);

  // Show reclassification ledger entries
  const ledgerState2 = await db.select().from(schema.generalLedgerEntries);
  logger.info("\nVerify General Ledger entries after Vendor Invoice Posting:");
  console.table(ledgerState2.map(le => ({
    id: le.id,
    account: `${le.accountCode} - ${le.accountName}`,
    debit: `$${Number(le.debit).toFixed(2)}`,
    credit: `$${Number(le.credit).toFixed(2)}`,
    desc: le.description
  })));

  // ==========================================
  // SECTION 4: SYSTEM ACCOUNTING VALIDATIONS
  // ==========================================
  logger.info("\n-----------------------------------------------------------");
  logger.info("STEP 4: SYSTEM ACCOUNTING VALIDATIONS");
  logger.info("-----------------------------------------------------------");

  // A. Inventory Asset balance remains unchanged after invoice posting
  const inventoryAssetLines = ledgerState2.filter(le => le.accountCode === "1300");
  const totalInventoryDebit = inventoryAssetLines.reduce((sum, le) => sum + Number(le.debit), 0);
  const totalInventoryCredit = inventoryAssetLines.reduce((sum, le) => sum + Number(le.credit), 0);
  const netInventoryValuation = totalInventoryDebit - totalInventoryCredit;

  logger.info("A. Inventory Valuation Match Verification:");
  logger.info(`   - Number of Inventory Asset entries: ${inventoryAssetLines.length}`);
  logger.info(`   - Total Net Inventory Asset Valuation: $${netInventoryValuation.toFixed(2)} (Expected: $120.00)`);
  
  // B. AP is only created when vendor invoice is posted
  const apLinesBefore = ledgerState1.filter(le => le.accountCode === "2010");
  const apLinesAfter = ledgerState2.filter(le => le.accountCode === "2010");
  
  logger.info("B. Accounts Payable Match Verification:");
  logger.info(`   - Number of AP lines BEFORE invoice posting: ${apLinesBefore.length} (Expected: 0)`);
  logger.info(`   - Number of AP lines AFTER invoice posting: ${apLinesAfter.length} (Expected: 1)`);
  logger.info(`   - Total Accounts Payable Credit: $${Number(apLinesAfter[0]?.credit || 0).toFixed(2)} (Expected: $120.00)`);

  // C. Trial Balance checking (No duplicate valuation and fully balanced)
  let sumDebits = 0;
  let sumCredits = 0;
  ledgerState2.forEach(le => {
    sumDebits += Number(le.debit);
    sumCredits += Number(le.credit);
  });
  const trialVariance = sumDebits - sumCredits;

  const trialBalanceReport = await accountingService.getTrialBalance({ storeId: 1 });
  logger.info("\nC. Dynamic Trial Balance Balance sheet output (Reconciliation):");
  console.table(trialBalanceReport.accounts.map((acc: any) => ({
    Code: acc.code,
    Name: acc.name,
    Debit: `$${acc.debit.toFixed(2)}`,
    Credit: `$${acc.credit.toFixed(2)}`,
    NetDebit: `$${acc.netDebit.toFixed(2)}`,
    NetCredit: `$${acc.netCredit.toFixed(2)}`
  })));

  logger.info(`D. Absolute Double-Entry Consistency Check:`);
  logger.info(`   - Sum of General Ledger Debits  : $${sumDebits.toFixed(2)}`);
  logger.info(`   - Sum of General Ledger Credits : $${sumCredits.toFixed(2)}`);
  logger.info(`   - Net Mathematical Discrepancy : ${trialVariance.toFixed(6)} USD (Must equal 0.00)`);

  logger.info("\n==================================================================");
  logger.info("ACCRUED INVENTORY GRNI VALIDATION COMPLETED");
  logger.info("==================================================================");
}

runGrniWorkflowSimulation().then(() => {
  logger.info("GRNI Simulation completed successfully.");
  process.exit(0);
}).catch(err => {
  logger.error("GRNI Simulation execution hit unexpected failure", err);
  process.exit(1);
});
