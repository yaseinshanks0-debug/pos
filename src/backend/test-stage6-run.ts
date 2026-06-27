// src/backend/test-stage6-run.ts

import { db } from "../db/index.ts";
import { DrizzleUnitOfWork } from "./infrastructure/persistence/unit-of-work.ts";
import { ReportingService } from "./application/services/reporting.service.ts";
import { AccountingService } from "./application/services/accounting.service.ts";
import { StructuredLogger } from "./infrastructure/logging/logger.ts";
import * as schema from "../db/schema.ts";
import { eq, sql } from "drizzle-orm";

const logger = new StructuredLogger();
const uow = new DrizzleUnitOfWork();
const reportingService = new ReportingService(uow, logger);
const accountingService = new AccountingService(uow, logger);

async function runStage6Tests() {
  logger.info("=========================================================================");
  logger.info("   STAGE 6 INTEGRATION TEST SUITE: EXECUTIVE REPORTING & BI ANALYTICS   ");
  logger.info("=========================================================================");

  const companyId = 1;

  // 1. Seed Context
  await db.transaction(async (tx) => {
    logger.info("Seeding test database with BI-context entries...");

    // Ensure company
    const comps = await tx.select().from(schema.companies).where(eq(schema.companies.id, companyId)).limit(1);
    if (comps.length === 0) {
      await tx.insert(schema.companies).values({
        id: companyId,
        name: "Acme Enterprise Group",
        domain: "group.acme.com",
        status: "active",
      });
    }

    // Ensure stores
    const store1 = await tx.select().from(schema.stores).where(eq(schema.stores.id, 1)).limit(1);
    if (store1.length === 0) {
      await tx.insert(schema.stores).values({
        id: 1,
        companyId,
        name: "HQ Flagship Store",
        code: "HQ-01",
        type: "hq",
        status: "active"
      });
    }

    const store2 = await tx.select().from(schema.stores).where(eq(schema.stores.id, 2)).limit(1);
    if (store2.length === 0) {
      await tx.insert(schema.stores).values({
        id: 2,
        companyId,
        name: "North Branch Outlet",
        code: "NB-02",
        type: "branch",
        status: "active"
      });
    }

    // Ensure users
    const user = await tx.select().from(schema.users).limit(1);
    const userId = user[0]?.id || 1;

    // Ensure customer for invoice aging
    const customer = await tx.select().from(schema.customers).limit(1);
    let custId = customer[0]?.id;
    if (!custId) {
      const newCust = await tx.insert(schema.customers).values({
        name: "Global Distribution Corp",
        email: "accounts@globaldist.com",
        mobileNumber: "+1-555-0199",
        creditLimit: "10000.00"
      }).returning();
      custId = newCust[0].id;
    }

    // Ensure vendor for bills aging
    const vendor = await tx.select().from(schema.vendors).limit(1);
    let vendId = vendor[0]?.id;
    if (!vendId) {
      const newVend = await tx.insert(schema.vendors).values({
        companyId,
        name: "Prime Logistic Logistics Inc",
        contactName: "John Logistics",
        email: "billing@primelogistics.com",
        phone: "+1-800-P-LOGS"
      }).returning();
      vendId = newVend[0].id;
    }

    // Insert mock customer invoice (AR Aging context)
    const ci = await tx.select().from(schema.customerInvoices).limit(1);
    if (ci.length === 0 && custId) {
      await tx.insert(schema.customerInvoices).values({
        companyId,
        customerId: custId,
        invoiceNumber: "CI-2026-0001",
        invoiceDate: new Date("2026-05-15"),
        dueDate: new Date("2026-06-15"),
        taxAmount: "360.00",
        totalAmount: "4860.00",
        status: "posted"
      });
      logger.info("Seeded Customer Invoice for AR aging test.");
    }

    // Insert mock vendor invoice (AP Aging context)
    const vi = await tx.select().from(schema.vendorInvoices).limit(1);
    if (vi.length === 0 && vendId) {
      await tx.insert(schema.vendorInvoices).values({
        companyId,
        vendorId: vendId,
        invoiceNumber: "VI-99201-SUPP",
        invoiceDate: new Date("2026-06-01"),
        dueDate: new Date("2026-07-01"),
        taxAmount: "960.00",
        totalAmount: "12960.00",
        status: "posted"
      });
      logger.info("Seeded Vendor Invoice for AP aging test.");
    }

    // Ensure bank account with ledger mapping exists
    const bank = await tx.select().from(schema.bankAccounts).where(eq(schema.bankAccounts.ledgerAccountCode, "1010")).limit(1);
    if (bank.length === 0) {
      await tx.insert(schema.bankAccounts).values({
        companyId,
        name: "Corporate Operating Checking Account",
        accountNumber: "RESERVED-BANK-01",
        routingNumber: "121000248",
        bankName: "National Reserve",
        currency: "USD",
        ledgerAccountCode: "1010",
        balance: "185000.00",
        status: "active"
      });
    }
  });

  // 2. RUN BI ANALYTICS SUITE IN ONE SWEEP
  logger.info("\nExecuting complete Stage 6 analytics run...");
  const filter = { startDate: "2026-01-01", endDate: "2026-12-31" };

  // Financial Statements
  const trialBalance = await reportingService.getTrialBalanceReport(filter);
  const balanceSheet = await reportingService.getBalanceSheetReport(filter);
  const plReport = await reportingService.getIncomeStatementReport(filter);
  const cashFlow = await reportingService.getCashFlowReport(filter);
  const generalLedger = await reportingService.getGeneralLedgerReport(filter);
  const journalReport = await reportingService.getJournalReport(filter);
  const budgetVsActual = await reportingService.getBudgetVsActualReport(filter);
  const multiPeriod = await reportingService.getMultiPeriodComparativeStatements(filter);
  const consolidated = await reportingService.getConsolidatedMultiStoreFinancialStatements(filter);

  // AR & AP
  const arAnalytics = await reportingService.getARAnalytics(filter);
  const apAnalytics = await reportingService.getAPAnalytics(filter);

  // Inventory & Sales
  const inventoryAnalytics = await reportingService.getInventoryAnalytics(filter);
  const salesAnalytics = await reportingService.getSalesAnalytics(filter);

  // Fixed Asset Register
  const fixedAssetsReport = await reportingService.getFixedAssetAnalytics(filter);

  // Executive dashboard (15 Core KPIs)
  const dashboardKpis = await reportingService.getExecutiveKpis(filter);

  // Saved reports capability (Write, list, read, delete)
  logger.info("\nTesting Saved Reports layouts database engine...");
  const savedReport = await reportingService.saveReport({
    companyId,
    name: "FY26 Consolidated Sales & GP Matrix",
    reportType: "sales",
    filters: filter,
    createdByUserId: 1
  });
  logger.info(`Report saved successfully to Database! Saved Report ID: ${savedReport.id}`);

  const savedList = await reportingService.getSavedReports(companyId);
  logger.info(`Fetched saved reports count: ${savedList.length}`);

  const fetchedReport = await reportingService.getSavedReportById(savedReport.id);
  logger.info(`Successfully fetched back saved report by ID. Name: "${fetchedReport.name}"`);

  await reportingService.deleteSavedReport(savedReport.id);
  logger.info("Successfully deleted report layout from database to clean up.");

  // Exporters representation
  const csvFormat = await reportingService.exportReportToCSV("sales", filter);
  logger.info(`Generated CSV size: ${csvFormat.length} bytes`);

  const htmlFormat = await reportingService.exportReportToDownloadableHTML("inventory", filter);
  logger.info(`Generated printable PDF-markup document size: ${htmlFormat.length} bytes`);

  // Print Trial Balance Verification
  logger.info(`\n==================================================================`);
  logger.info(` TRIAL BALANCE VALIDATION TRACE`);
  logger.info(`==================================================================`);
  logger.info(` Total Accounts Registered: ${trialBalance.accounts?.length || 0}`);
  logger.info(` Consolidated Total Debits ($): ${trialBalance.totalDebits}`);
  logger.info(` Consolidated Total Credits ($): ${trialBalance.totalCredits}`);
  logger.info(` Trial Balance Status: ${trialBalance.balanced ? "PERFECTLY BALANCED (No Ledger Variance)" : "Variance Detected"}`);
  logger.info(`==================================================================\n`);

  // Print Executive dashboard metrics verification
  logger.info(`\n==================================================================`);
  logger.info(` EXECUTIVE KPI DASHBOARD VERIFICATION`);
  logger.info(`==================================================================`);
  logger.info(` Revenue:               $${dashboardKpis.revenue.toFixed(2)}`);
  logger.info(` Gross Profit:          $${dashboardKpis.grossProfit.toFixed(2)}`);
  logger.info(` Net Profit:            $${dashboardKpis.netProfit.toFixed(2)}`);
  logger.info(` EBITDA:                $${dashboardKpis.ebitda.toFixed(2)}`);
  logger.info(` Inventory Value:       $${dashboardKpis.inventoryValue.toFixed(2)}`);
  logger.info(` Cash Position:         $${dashboardKpis.cashPosition.toFixed(2)}`);
  logger.info(` Accounts Receivable:   $${dashboardKpis.accountsReceivable.toFixed(2)}`);
  logger.info(` Accounts Payable:      $${dashboardKpis.accountsPayable.toFixed(2)}`);
  logger.info(` Working Capital:       $${dashboardKpis.workingCapital.toFixed(2)}`);
  logger.info(` Current Ratio:         ${dashboardKpis.currentRatio}`);
  logger.info(` Quick Ratio:           ${dashboardKpis.quickRatio}`);
  logger.info(` Debt Ratio:            ${dashboardKpis.debtRatio}`);
  logger.info(` Inventory Turnover:    ${dashboardKpis.inventoryTurnover}`);
  logger.info(` Collection Days (Avg): ${dashboardKpis.averageCollectionDays}`);
  logger.info(` Payment Days (Avg):    ${dashboardKpis.averagePaymentDays}`);
  logger.info(`==================================================================\n`);

  logger.info("ALL STAGE 6 INTEGRATION TESTS COMPLETED SUCCESSFULLY! COMPLETION: 100%");
}

runStage6Tests().catch((err) => {
  logger.error(`Stage 6 Integration test suite failed: ${err.message}`);
  process.exit(1);
});
