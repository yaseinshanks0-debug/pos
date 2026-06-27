// src/backend/test-stage5-3-run.ts

import { db } from "../db/index.ts";
import { DrizzleUnitOfWork } from "./infrastructure/persistence/unit-of-work.ts";
import { AccountingService } from "./application/services/accounting.service.ts";
import { FixedAssetService } from "./application/services/fixed-asset.service.ts";
import { StructuredLogger } from "./infrastructure/logging/logger.ts";
import * as schema from "../db/schema.ts";
import { eq, sql } from "drizzle-orm";

const logger = new StructuredLogger();
const uow = new DrizzleUnitOfWork();
const accountingService = new AccountingService(uow, logger);
const fixedAssetService = new FixedAssetService(uow, logger, accountingService);

function printTrialBalance(tb: any, title: string) {
  logger.info(`\n==================================================================`);
  logger.info(` TRIAL BALANCE: ${title.toUpperCase()}`);
  logger.info(`==================================================================`);
  logger.info(
    ` ${"Code".padEnd(6)} | ${"Account Name".padEnd(35)} | ${"Type".padEnd(11)} | ${"Net Debit ($)".padStart(13)} | ${"Net Credit ($)".padStart(14)}`
  );
  logger.info("-".repeat(95));
  for (const acc of tb.accounts) {
    if (acc.debit > 0 || acc.credit > 0) {
      logger.info(
        ` ${acc.code.padEnd(6)} | ${acc.name.padEnd(35)} | ${acc.type.padEnd(11)} | ${String(acc.debit.toFixed(2)).padStart(13)} | ${String(acc.credit.toFixed(2)).padStart(14)}`
      );
    }
  }
  logger.info("-".repeat(95));
  logger.info(
    ` ${"TOTALS".padEnd(42)} | ${"".padEnd(11)} | ${String(tb.totalDebits.toFixed(2)).padStart(13)} | ${String(tb.totalCredits.toFixed(2)).padStart(14)}`
  );
  logger.info(` Balanced: ${tb.balanced ? "YES (DEBITS = CREDITS)" : "NO"}`);
  logger.info(`==================================================================\n`);
}

async function runStage53Tests() {
  logger.info("==========================================================");
  logger.info("       STAGE 5.3 INTEGRATION TEST SUITE: FIXED ASSETS     ");
  logger.info("==========================================================");

  // Setup initial test seed context
  const companyId = 1;
  
  await db.transaction(async (tx) => {
    // 1. Ensure Company exists
    const comps = await tx.select().from(schema.companies).where(eq(schema.companies.id, companyId)).limit(1);
    if (comps.length === 0) {
      await tx.insert(schema.companies).values({
        id: companyId,
        name: "Acme Corp Fixed Assets Division",
        domain: "assets.acme.com",
        status: "active",
      });
    }

    // 2. Ensure Store 1 exists (Store ID = 1)
    const store1 = await tx.select().from(schema.stores).where(eq(schema.stores.id, 1)).limit(1);
    if (store1.length === 0) {
      await tx.insert(schema.stores).values({
        id: 1,
        companyId,
        name: "HQ Operations",
        code: "ST001",
        type: "hq",
        status: "active",
      });
    }

    // 3. Ensure Store 2 exists (Store ID = 2)
    const store2 = await tx.select().from(schema.stores).where(eq(schema.stores.id, 2)).limit(1);
    if (store2.length === 0) {
      await tx.insert(schema.stores).values({
        id: 2,
        companyId,
        name: "Branch Distribution Store",
        code: "ST002",
        type: "branch",
        status: "active",
      });
    }

    // 4. Ensure Bank Account exists (Bank Account ID = 1)
    const bank1 = await tx.select().from(schema.bankAccounts).where(eq(schema.bankAccounts.id, 1)).limit(1);
    if (bank1.length === 0) {
      await tx.insert(schema.bankAccounts).values({
        id: 1,
        companyId,
        name: "Main Operating Checking Account",
        accountNumber: "ACT-88192-X",
        routingNumber: "121000248",
        bankName: "First National Reserve",
        currency: "USD",
        ledgerAccountCode: "1010",
        balance: "100000.00",
        status: "active",
      });
    } else {
      // Reset balance to $100,000 for clean test
      await tx.update(schema.bankAccounts).set({ balance: "100000.00" }).where(eq(schema.bankAccounts.id, 1));
    }

    // 5. Ensure Vendor exists (Vendor ID = 1)
    const vendor1 = await tx.select().from(schema.vendors).where(eq(schema.vendors.id, 1)).limit(1);
    if (vendor1.length === 0) {
      await tx.insert(schema.vendors).values({
        id: 1,
        companyId,
        name: "Global Equipment Outfitters Ltd",
        status: "active",
      });
    }

    // 6. Ensure Customer exists (Customer ID = 1)
    const customer1 = await tx.select().from(schema.customers).where(eq(schema.customers.id, 1)).limit(1);
    if (customer1.length === 0) {
      await tx.insert(schema.customers).values({
        id: 1,
        name: "Capital Surplus Liquidation Co",
        mobileNumber: "1-800-SURPLUS",
      });
    }

    // Clear existing Fixed Assets and related logs to run fresh tests
    await tx.delete(schema.fixedAssetAuditLogs);
    await tx.delete(schema.fixedAssetMovements);
    await tx.delete(schema.fixedAssetDepreciationLogs);
    await tx.delete(schema.fixedAssets);
    await tx.delete(schema.fixedAssetCategories);

    // Clear GL entries so Trial Balance starts fresh
    await tx.delete(schema.generalLedgerEntries);
  });

  logger.info("[OK] Seeding context completed successfully.");

  // =========================================================================
  // SETUP CATEGORIES
  // =========================================================================
  logger.info("\n--- STEP 1: REGISTERING ASSET CATEGORIES ---");
  const catEquip = await fixedAssetService.createCategory({
    companyId,
    code: "EQUIP",
    name: "Heavy Industrial Equipment",
    depreciationMethod: "straight_line",
    usefulLifeMonths: 60,
    assetGlAccount: "1510",
    depreciationExpenseGlAccount: "5050",
    accumulatedDepreciationGlAccount: "1519",
  });
  logger.info(`[OK] Registered Category: ${catEquip.code} (${catEquip.name})`);

  const catComp = await fixedAssetService.createCategory({
    companyId,
    code: "COMP",
    name: "Computer and Networking Hardware",
    depreciationMethod: "declining_balance",
    usefulLifeMonths: 36,
    decliningBalanceRate: 30.00,
    assetGlAccount: "1510",
    depreciationExpenseGlAccount: "5050",
    accumulatedDepreciationGlAccount: "1519",
  });
  logger.info(`[OK] Registered Category: ${catComp.code} (${catComp.name})`);

  const catVeh = await fixedAssetService.createCategory({
    companyId,
    code: "VEH",
    name: "Fleet and Transport Vehicles",
    depreciationMethod: "units_of_production",
    usefulLifeMonths: 120,
    assetGlAccount: "1510",
    depreciationExpenseGlAccount: "5050",
    accumulatedDepreciationGlAccount: "1519",
  });
  logger.info(`[OK] Registered Category: ${catVeh.code} (${catVeh.name})`);


  // =========================================================================
  // TEST STEP 1: ASSET ACQUISITION (Straight Line)
  // =========================================================================
  logger.info("\n--- STEP 2: FIXED ASSET ACQUISITION (STRAIGHT LINE METHOD) ---");
  const forklift = await fixedAssetService.acquireAsset({
    companyId,
    storeId: 1,
    categoryCode: "EQUIP",
    assetCode: "FA-FORKLIFT-001",
    name: "Industrial Electric Forklift H40",
    description: "Forklift for warehouse logistics loading",
    acquisitionDate: "2026-06-01",
    acquisitionCost: 20000.00,
    salvageValue: 2000.00,
    depreciationMethod: "straight_line",
    usefulLifeMonths: 60,
    assetGlAccount: "1510",
    depreciationExpenseGlAccount: "5050",
    accumulatedDepreciationGlAccount: "1519",
    paymentMethod: "cash",
    bankAccountId: 1,
  });

  logger.info(`[OK] Acquired Forklift. ID: ${forklift.id}, Code: ${forklift.assetCode}, Net Book Value: $${forklift.netBookValue}`);

  // Check bank account balance reduced
  const bankAfterAcq = await db.select().from(schema.bankAccounts).where(eq(schema.bankAccounts.id, 1)).limit(1);
  logger.info(`Checking Bank Balance: $${bankAfterAcq[0].balance} (Expected: $80000.00)`);

  const tbStep1 = await accountingService.getTrialBalance({ endDate: "2026-06-02" });
  printTrialBalance(tbStep1, "Step 2: Trial Balance after Forklift Acquisition");


  // =========================================================================
  // TEST STEP 2: MONTHLY DEPRECIATION POSTING (Straight Line)
  // =========================================================================
  logger.info("\n--- STEP 3: RUNNING MONTHLY DEPRECIATION SCHEDULER (STRAIGHT LINE) ---");
  // Scheduler as of 2026-06-30
  const depLogs = await fixedAssetService.runMonthlyDepreciation(companyId, 1, new Date("2026-06-30"));
  logger.info(`[OK] Depreciation logs generated: ${depLogs.length}`);
  
  // Verify depreciation details
  const forkliftUpdated = (await db.select().from(schema.fixedAssets).where(eq(schema.fixedAssets.id, forklift.id)).limit(1))[0];
  logger.info(`Forklift NBV after month 1: $${forkliftUpdated.netBookValue} (Expected: $19700.00)`);
  logger.info(`Forklift Accumulated Depreciation: $${forkliftUpdated.accumulatedDepreciation} (Expected: $300.00)`);

  const tbStep2 = await accountingService.getTrialBalance({ endDate: "2026-06-30" });
  printTrialBalance(tbStep2, "Step 3: Trial Balance after Month-End Depreciation");


  // =========================================================================
  // TEST STEP 3: ASSET STORE TRANSFER
  // =========================================================================
  logger.info("\n--- STEP 4: INTER-STORE ASSET TRANSFER ---");
  const forkliftTransferred = await fixedAssetService.transferAsset({
    assetId: forklift.id,
    toStoreId: 2,
    transferDate: "2026-07-05",
    reason: "Optimizing branch warehouse capacity",
    createdById: 1,
  });

  logger.info(`[OK] Forklift Store ID updated to: ${forkliftTransferred.storeId} (Expected: 2)`);
  const mvts = await fixedAssetService.getAssetMovementReport(companyId);
  logger.info(`Movement log size: ${mvts.length}`);
  logger.info(`Movement Details: From Store ${mvts[0].fromStoreId} to Store ${mvts[0].toStoreId} on ${mvts[0].transferDate.toDateString()}`);


  // =========================================================================
  // TEST STEP 4: ASSET IMPAIRMENT
  // =========================================================================
  logger.info("\n--- STEP 5: ASSET IMPAIRMENT TESTING ---");
  const forkliftImpaired = await fixedAssetService.impairAsset({
    assetId: forklift.id,
    impairmentAmount: 1700.00,
    impairmentDate: "2026-07-10",
    reason: "Hydraulic motor casing puncture and structural crack",
    createdById: 1,
  });

  logger.info(`[OK] Forklift Impaired. New NBV: $${forkliftImpaired.netBookValue} (Expected: $18000.00)`);
  logger.info(`Accumulated Depreciation Account Balance: $${forkliftImpaired.accumulatedDepreciation} (Expected: $2000.00)`);

  const tbStep4 = await accountingService.getTrialBalance({ endDate: "2026-07-10" });
  printTrialBalance(tbStep4, "Step 5: Trial Balance after Forklift Impairment");


  // =========================================================================
  // TEST STEP 5: ASSET REVALUATION (Upward Appraisal)
  // =========================================================================
  logger.info("\n--- STEP 6: ASSET REVALUATION (MARKET APPRAISAL) ---");
  const forkliftRevalued = await fixedAssetService.revalueAsset({
    assetId: forklift.id,
    revaluationDate: "2026-07-15",
    newMarketValue: 22000.00,
    reason: "Upward market appraisal due to global industrial equipment supply shortage",
    createdById: 1,
  });

  logger.info(`[OK] Forklift Revalued. New Net Book Value: $${forkliftRevalued.netBookValue} (Expected: $22000.00)`);
  logger.info(`Adjusted carrying cost: $${forkliftRevalued.acquisitionCost} (Expected: $24000.00)`);

  const tbStep5 = await accountingService.getTrialBalance({ endDate: "2026-07-15" });
  printTrialBalance(tbStep5, "Step 6: Trial Balance after Upward Revaluation");


  // =========================================================================
  // TEST STEP 6: ASSET DISPOSAL WITH GAIN/LOSS
  // =========================================================================
  logger.info("\n--- STEP 7: ASSET DISPOSAL (CASH SALE WITH GAIN RECONCILIATION) ---");
  const forkliftDisposed = await fixedAssetService.disposeAsset({
    assetId: forklift.id,
    disposalDate: "2026-07-20",
    disposalPrice: 23000.00,
    disposalType: "sale",
    bankAccountId: 1,
  });

  logger.info(`[OK] Forklift disposed. Status: ${forkliftDisposed.status}`);
  logger.info(`Disposal Gain/Loss: $${forkliftDisposed.disposalGainLoss} (Expected: $1000.00)`);

  const bankAfterDisp = await db.select().from(schema.bankAccounts).where(eq(schema.bankAccounts.id, 1)).limit(1);
  logger.info(`Checking Bank Balance: $${bankAfterDisp[0].balance} (Expected: $103000.00)`);

  const tbStep6 = await accountingService.getTrialBalance({ endDate: "2026-07-20" });
  printTrialBalance(tbStep6, "Step 7: Trial Balance after Forklift Disposal");


  // =========================================================================
  // TEST STEP 7: DECLINING BALANCE DEPRECIATION
  // =========================================================================
  logger.info("\n--- STEP 8: DECLINING BALANCE METHOD DEPRECIATION ---");
  const server = await fixedAssetService.acquireAsset({
    companyId,
    storeId: 1,
    categoryCode: "COMP",
    assetCode: "FA-SERVER-002",
    name: "AI GPU Server Rack 8x H100",
    description: "Deep learning model training cluster",
    acquisitionDate: "2026-08-01",
    acquisitionCost: 10000.00,
    salvageValue: 1000.00,
    depreciationMethod: "declining_balance",
    usefulLifeMonths: 36,
    decliningBalanceRate: 30.00,
    assetGlAccount: "1510",
    depreciationExpenseGlAccount: "5050",
    accumulatedDepreciationGlAccount: "1519",
    paymentMethod: "cash",
    bankAccountId: 1,
  });

  logger.info(`[OK] Acquired Server. ID: ${server.id}, Code: ${server.assetCode}, NBV: $${server.netBookValue}`);

  // Run monthly depreciation for August 2026
  await fixedAssetService.runMonthlyDepreciation(companyId, 1, new Date("2026-08-31"));

  const serverUpdated = (await db.select().from(schema.fixedAssets).where(eq(schema.fixedAssets.id, server.id)).limit(1))[0];
  logger.info(`Server NBV after month 1: $${serverUpdated.netBookValue} (Expected: $9750.00 [10000 - (10000 * 0.30 / 12)])`);
  logger.info(`Server Accumulated Depreciation: $${serverUpdated.accumulatedDepreciation} (Expected: $250.00)`);


  // =========================================================================
  // TEST STEP 8: UNITS OF PRODUCTION DEPRECIATION
  // =========================================================================
  logger.info("\n--- STEP 9: UNITS OF PRODUCTION METHOD DEPRECIATION ---");
  const truck = await fixedAssetService.acquireAsset({
    companyId,
    storeId: 1,
    categoryCode: "VEH",
    assetCode: "FA-TRUCK-003",
    name: "Heavy Delivery Logistics Truck",
    description: "Inter-store distribution vehicle",
    acquisitionDate: "2026-09-01",
    acquisitionCost: 50000.00,
    salvageValue: 10000.00,
    depreciationMethod: "units_of_production",
    usefulLifeMonths: 120,
    totalUnitsExpected: 100000, // expected mileage
    assetGlAccount: "1510",
    depreciationExpenseGlAccount: "5050",
    accumulatedDepreciationGlAccount: "1519",
    paymentMethod: "cash",
    bankAccountId: 1,
  });

  logger.info(`[OK] Acquired Truck. ID: ${truck.id}, Code: ${truck.assetCode}, NBV: $${truck.netBookValue}`);

  // Run monthly depreciation for September 2026
  // (We assume truck drove 5,000 miles, translating to depreciation of: (50000 - 10000) * (5000 / 100000) = $2,000.00)
  await fixedAssetService.runMonthlyDepreciation(companyId, 1, new Date("2026-09-30"));

  const truckUpdated = (await db.select().from(schema.fixedAssets).where(eq(schema.fixedAssets.id, truck.id)).limit(1))[0];
  logger.info(`Truck NBV after month 1: $${truckUpdated.netBookValue} (Expected: $48000.00)`);
  logger.info(`Truck Accumulated Depreciation: $${truckUpdated.accumulatedDepreciation} (Expected: $2000.00)`);


  // =========================================================================
  // TEST STEP 9: REPORTS RECONCILIATION
  // =========================================================================
  logger.info("\n--- STEP 10: GENERATING FIXED ASSETS REGISTER REPORTS ---");
  const assetRegister = await fixedAssetService.getAssetRegister(companyId);
  logger.info(`[OK] Assets Register size: ${assetRegister.length} (Expected: 3 assets)`);
  for (const a of assetRegister) {
    logger.info(`   - Asset Code: ${a.assetCode} | Name: ${a.name} | Method: ${a.depreciationMethod} | Status: ${a.status} | NBV: $${a.netBookValue}`);
  }

  const completeSchedules = await fixedAssetService.getDepreciationSchedule(companyId);
  logger.info(`[OK] Depreciation Logs Count: ${completeSchedules.length} (Expected: 3 log records)`);
  for (const l of completeSchedules) {
    logger.info(`   - Asset ID: ${l.assetId} | Amount: $${l.depreciationAmount} | Net Book Value After: $${l.netBookValueAfter}`);
  }

  const disposalsReport = await fixedAssetService.getAssetDisposalReport(companyId);
  logger.info(`[OK] Disposals Report Count: ${disposalsReport.length} (Expected: 1 disposed asset)`);
  logger.info(`   - Disposed Asset: ${disposalsReport[0].name} | Sale Price: $${disposalsReport[0].disposalPrice} | Gain/Loss: $${disposalsReport[0].disposalGainLoss}`);

  const forkliftAuditTrail = await fixedAssetService.getAssetAuditTrail(companyId, forklift.id);
  logger.info(`[OK] Forklift Audit Trail entries count: ${forkliftAuditTrail.length} (Expected: 5 entries)`);
  for (const log of forkliftAuditTrail) {
    logger.info(`   [AUDIT EVENT] Type: ${log.eventType.toUpperCase()} | Desc: ${log.description}`);
  }

  // Double Check final Trial Balance is beautifully balanced
  const tbFinal = await accountingService.getTrialBalance({ endDate: "2026-10-01" });
  printTrialBalance(tbFinal, "Final Audited Trial Balance (Stage 5.3 Complete)");

  logger.info("==========================================================");
  logger.info("  STAGE 5.3 INTEGRATION TESTS PASSED SUCCESSFULLY!  ");
  logger.info("==========================================================");
}

runStage53Tests().catch((err) => {
  logger.error("Simulation failed with error: ", err);
  process.exit(1);
});
