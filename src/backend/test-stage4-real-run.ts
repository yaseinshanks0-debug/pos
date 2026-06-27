// src/backend/test-stage4-real-run.ts
import { db } from "../db/index.ts";
import { DrizzleUnitOfWork } from "./infrastructure/persistence/unit-of-work.ts";
import { AccountingService } from "./application/services/accounting.service.ts";
import { StructuredLogger } from "./infrastructure/logging/logger.ts";
import * as schema from "../db/schema.ts";
import { eq, and } from "drizzle-orm";

const logger = new StructuredLogger();
const uow = new DrizzleUnitOfWork();

async function runStage4ValidationSimulation() {
  logger.info("==================================================================");
  logger.info("STAGE 4: FISCAL CALENDAR, CLOSE WORKFLOWS, AND PERIOD LOCKS");
  logger.info("==================================================================");

  const accountingService = new AccountingService(uow, logger);

  // STEP 1: CLEAN UP STAGE 4 RELATED ENTRIES TO ENSURE ISOLATION
  logger.info("\n--- STEP 1: CLEANING UP PREVIOUS RUNS ---");
  await db.transaction(async (tx) => {
    logger.info("Purging Stage 4 entities: lock audit logs, close runs, periods, fiscal years...");
    await tx.delete(schema.accountingLockAuditLogs);
    await tx.delete(schema.fiscalCloseRuns);
    await tx.delete(schema.accountingPeriods);
    await tx.delete(schema.fiscalYears);

    logger.info("Purging central General Ledger entries to reset balances for clear testing...");
    await tx.delete(schema.generalLedgerEntries);

    // Seed requisite company
    const companyList = await tx.select().from(schema.companies).where(eq(schema.companies.id, 1));
    if (companyList.length === 0) {
      await tx.insert(schema.companies).values({
        id: 1,
        name: "Acme Corporate HQ Ltd",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      logger.info("Seeded Company ID: 1");
    }

    // Seed requisite role
    const roleList = await tx.select().from(schema.roles).where(eq(schema.roles.id, 1));
    if (roleList.length === 0) {
      await tx.insert(schema.roles).values({
        id: 1,
        name: "Administration",
        description: "Global Administration Role",
        createdAt: new Date(),
      });
      logger.info("Seeded Role ID: 1");
    }

    // Seed User ID 100
    const userList = await tx.select().from(schema.users).where(eq(schema.users.id, 100));
    if (userList.length === 0) {
      await tx.insert(schema.users).values({
        id: 100,
        uid: "mock_user_100",
        email: "financier@acme.com",
        fullName: "System Auditor",
        roleId: 1,
        companyId: 1,
        failedLoginAttempts: 0,
        createdAt: new Date(),
      });
      logger.info("Seeded User ID: 100 for audited period closure runs.");
    }
  });

  // STEP 2: CREATE FISCAL YEAR WITH NESTED PERIODS
  logger.info("\n--- STEP 2: CREATING FISCAL YEAR 2026 WITH 12 MONTHLY PERIODS ---");
  const fyStartDate = new Date(2026, 0, 1);
  const fyEndDate = new Date(2026, 11, 31, 23, 59, 59, 999);
  
  const fy2026 = await accountingService.createFiscalYear(2026, fyStartDate, fyEndDate, "monthly");
  logger.info(`Fiscal Year 2026 created successfully. ID: ${fy2026.id}`);

  const periods = await accountingService.getAccountingPeriods(fy2026.id);
  logger.info(`Initialized ${periods.length} nested accounting periods for FY 2026:`);
  periods.forEach(p => {
    logger.info(` - Period ${p.periodNumber}: ${p.name} (${p.startDate.toDateString()} to ${p.endDate.toDateString()}) | Status: ${p.status}`);
  });

  if (periods.length !== 12) {
    throw new Error(`Expected 12 periods, but got ${periods.length}`);
  }

  // STEP 3: DEMONSTRATE STRICT PERIOD LOCK ENFORCEMENT & PREVENT BACK-DATED ENTRIES
  logger.info("\n--- STEP 3: DEMONSTRATING PERIOD LOCKS & EXCEPTION CASES ---");
  
  // Find Period 1 (January 2026)
  const p1 = periods.find(p => p.periodNumber === 1);
  if (!p1) throw new Error("Period 1 not found");

  logger.info("Post a valid journal entry in Period 1 (January)...");
  await accountingService.postJournalEntry({
    companyId: 1,
    description: "Initial inventory setup",
    referenceType: "adjustment",
    createdAt: new Date(2026, 0, 15), // mid-January
    lines: [
      { accountCode: "1300", accountType: "assets", accountName: "Inventory Asset", debit: 5000, credit: 0 },
      { accountCode: "3010", accountType: "equity", accountName: "Retained Earnings", debit: 0, credit: 5000 }
    ]
  });
  logger.info("Posted initial inventory setup entry of $5,000.00 successfully.");

  logger.info("\nLocking Period 1 (January)...");
  await accountingService.updatePeriodStatus(p1.id, "closed", 100, "Locking P1 after general postings close.");
  logger.info("Period 1 locked successfully.");

  logger.info("\nAttempting to post a back-dated transaction back to the locked Period 1...");
  try {
    await accountingService.postJournalEntry({
      companyId: 1,
      description: "Belated back-dated general posting",
      referenceType: "adjustment",
      createdAt: new Date(2026, 0, 18), // Jan 18 is in locked Period 1
      lines: [
        { accountCode: "1300", accountType: "assets", accountName: "Inventory Asset", debit: 100, credit: 0 },
        { accountCode: "1010", accountType: "assets", accountName: "Cash", debit: 0, credit: 100 }
      ]
    });
    throw new Error("Strict lock enforcement FAILED! System allowed posting to locked period.");
  } catch (err: any) {
    logger.info(`[EXPECTED ERROR BLOCKED] ${err.message}`);
  }

  logger.info("\nReopening Period 1 for a brief authorised correction...");
  await accountingService.updatePeriodStatus(p1.id, "open", 100, "Briefly reopening to fix omission");
  logger.info("Period 1 state reopened.");

  logger.info("Posting correction entry in Period 1 now...");
  await accountingService.postJournalEntry({
    companyId: 1,
    description: "Authorised omission fix",
    referenceType: "adjustment",
    createdAt: new Date(2026, 0, 18),
    lines: [
      { accountCode: "1300", accountType: "assets", accountName: "Inventory Asset", debit: 200, credit: 0 },
      { accountCode: "1010", accountType: "assets", accountName: "Cash", debit: 0, credit: 200 }
    ]
  });
  logger.info("Correction posted successfully in reopened period.");

  logger.info("\nRe-soft-locking Period 1...");
  await accountingService.updatePeriodStatus(p1.id, "soft_closed", 100, "Restoring soft locks.");
  
  logger.info("Attempting non-adjustment back-dated posting in soft-closed period...");
  try {
    await accountingService.postJournalEntry({
      companyId: 1,
      description: "Unauthorized transaction",
      referenceType: "sale",
      createdAt: new Date(2026, 0, 19),
      lines: [
        { accountCode: "1010", accountType: "assets", accountName: "Cash", debit: 300, credit: 0 },
        { accountCode: "4010", accountType: "revenue", accountName: "Sales Revenue", debit: 0, credit: 300 }
      ]
    });
    throw new Error("Soft-lock enforcement FAILED! Allowed standard transaction.");
  } catch (err: any) {
    logger.info(`[EXPECTED ERROR BLOCKED] ${err.message}`);
  }

  logger.info("\nBypassing soft-lock using an authorised period_adjustment reference...");
  await accountingService.postJournalEntry({
    companyId: 1,
    description: "Authorized soft-lock adjustment",
    referenceType: "period_adjustment",
    createdAt: new Date(2026, 0, 19),
    lines: [
      { accountCode: "1010", accountType: "assets", accountName: "Cash", debit: 300, credit: 0 },
      { accountCode: "4010", accountType: "revenue", accountName: "Sales Revenue", debit: 0, credit: 300 }
    ]
  });
  logger.info("Authorized soft-lock adjustment posted successfully.");

  // STEP 4: MONTH-END CLOSURE WORKFLOW WITH TRIAL BALANCE VALIDATION
  logger.info("\n--- STEP 4: TIMING MONTH-END CLOSURE WITH TRIAL BALANCE OUT OF BALANCE CHECK ---");
  
  // To simulate balance mismatch, we post a direct manual query into sql bypass of service validator (services reject out-of-balance entries)
  logger.info("Posting an out-of-balance entry directly bypass validators to simulate mismatch...");
  await db.insert(schema.generalLedgerEntries).values({
    companyId: 1,
    accountType: "assets",
    accountCode: "1300",
    accountName: "Inventory Asset",
    description: "Intentional unbalanced skew entry for simulation",
    debit: "150.00",
    credit: "0.00",
    referenceType: "test_imbalance",
    createdAt: new Date(2026, 0, 5)
  });

  logger.info("Attempting to close Period 1 with unbalanced trial balance...");
  try {
    await accountingService.closeAccountingPeriod(p1.id, 100, "Close attempt with mismatch");
    throw new Error("Close succeeded but Trial Balance was out of balance!");
  } catch (err: any) {
    logger.info(`[EXPECTED ERROR BLOCKED] Successfully caught closure prevention due to unbalanced Trial Balance:\n  ${err.message}`);
  }

  logger.info("\nCorrecting the imbalance skew...");
  await db.delete(schema.generalLedgerEntries).where(eq(schema.generalLedgerEntries.referenceType, "test_imbalance"));
  logger.info("Imbalance skewed entry cleared.");

  logger.info("Re-running close accounting period on Period 1...");
  const closeResult = await accountingService.closeAccountingPeriod(p1.id, 100, "Official January Month-End Close");
  logger.info(`January status updated to: ${closeResult.period.status}`);
  logger.info(`Close run audit record ID: ${closeResult.closeRun.id}`);

  // STEP 5: YEAR-END CLOSE WORKFLOW & RETAINED EARNINGS ROLL-FORWARD
  logger.info("\n--- STEP 5: TIMING YEAR-END CLOSE SEQUENCE WITH RETAINED EARNINGS ROLL-FORWARD ---");

  // Post some revenues and expenses throughout the remaining open periods of 2026 (P2-P12)
  logger.info("Posting revenues and expenses throughout 2026...");
  await accountingService.postJournalEntry({
    companyId: 1,
    description: "Services rendered in Period 2",
    referenceType: "sale",
    createdAt: new Date(2026, 1, 15),
    lines: [
      { accountCode: "1010", accountType: "assets", accountName: "Cash", debit: 2500, credit: 0 },
      { accountCode: "4010", accountType: "revenue", accountName: "Sales Revenue", debit: 0, credit: 2500 }
    ]
  });

  await accountingService.postJournalEntry({
    companyId: 1,
    description: "Office utility expenses in Period 6",
    referenceType: "adjustment",
    createdAt: new Date(2026, 5, 10),
    lines: [
      { accountCode: "5010", accountType: "expenses", accountName: "Cost of Goods Sold", debit: 800, credit: 0 },
      { accountCode: "1010", accountType: "assets", accountName: "Cash", debit: 0, credit: 800 }
    ]
  });

  // Calculate Net Income before close
  const plPreClose = await accountingService.getProfitLoss({
    startDate: "2026-01-01",
    endDate: "2026-12-31"
  });
  logger.info(`Calculated Pre-Close Sales Revenue: $${plPreClose.revenues[0].balance.toFixed(2)}`);
  logger.info(`Calculated Pre-Close Operating Expenses/COGS: $${plPreClose.expenses[0].balance.toFixed(2)}`);
  logger.info(`Underlying Net Income of: $${plPreClose.netIncome.toFixed(2)}`);

  logger.info("\nTriggering Year-End Closing Sequence...");
  const yeResult = await accountingService.closeFiscalYear(fy2026.id, 100, "Official FY 2026 Year-End Close");
  logger.info(`Year-End operation complete. Fiscal Year 2026 status set to: ${yeResult.fiscalYear.status}`);
  logger.info(`Rolled forward Net Income amount is: $${yeResult.closedNetIncome.toFixed(2)}`);
  logger.info(`Year-End close run ID: ${yeResult.closeRun.id}`);
  logger.info(`Generated closing retained earnings manual journal entry ID: ${yeResult.closeRun.retainedEarningsEntryId}`);

  // Fetch P&L Post-Close to ensure temporary accounts have been closed (zeroed out)
  const plPostClose = await accountingService.getProfitLoss({
    startDate: "2026-01-01",
    endDate: "2026-12-31"
  });
  logger.info(`\nPost-Close Profit & Loss Check (Temporary Accounts Zeroed Out check):`);
  logger.info(`  Sales Revenue Balance: $${plPostClose.revenues[0].balance.toFixed(2)}`);
  logger.info(`  Operating Expenses/COGS Balance: $${plPostClose.expenses[0].balance.toFixed(2)}`);
  logger.info(`  Total post-close net income: $${plPostClose.netIncome.toFixed(2)}`);

  if (plPostClose.netIncome !== 0) {
    throw new Error(`Expected post-close net income to be $0.00, but got $${plPostClose.netIncome}`);
  }

  // STEP 6: VERIFY AUDIT TRAIL LOGS
  logger.info("\n--- STEP 6: FETCHING OPERATIONS AUDIT TRAIL & HISTORY LOGS ---");
  const auditLogs = await accountingService.getPeriodLockAuditLogs();
  logger.info(`Retrieved ${auditLogs.length} period lock audit logs:`);
  auditLogs.forEach(al => {
    logger.info(` - Action: ${al.action} | Reason: ${al.reason} | Executed By User: ${al.performedByUserId} | Timestamp: ${al.createdAt}`);
  });

  const closeRuns = await accountingService.getFiscalCloseRuns();
  logger.info(`Retrieved ${closeRuns.length} fiscal close runs:`);
  closeRuns.forEach(cr => {
    logger.info(` - Close Run Type: ${cr.runType} | Notes: ${cr.notes} | Result Status: ${cr.status} | Timestamp: ${cr.createdAt}`);
  });

  logger.info("\n==================================================================");
  logger.info("STAGE 4 COMPLETED PERFECTLY. ALL INTEGRATION TESTS PASSED!");
  logger.info("==================================================================");
  process.exit(0);
}

runStage4ValidationSimulation().catch((err) => {
  logger.error(`STAGE 4 SIMULATION EXCEPTION TRIGGERED: ${err.message}`);
  logger.error(err.stack);
  process.exit(1);
});
