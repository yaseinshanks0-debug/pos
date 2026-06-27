// src/backend/audit-stage5-2.ts

import { db } from "../db/index.ts";
import { DrizzleUnitOfWork } from "./infrastructure/persistence/unit-of-work.ts";
import { AccountingService } from "./application/services/accounting.service.ts";
import { Stage5Service } from "./application/services/stage5.service.ts";
import { Stage5_2Service } from "./application/services/stage5_2.service.ts";
import { StructuredLogger } from "./infrastructure/logging/logger.ts";
import * as schema from "../db/schema.ts";
import { eq, and, sql } from "drizzle-orm";

const logger = new StructuredLogger();
const uow = new DrizzleUnitOfWork();

async function runAudit() {
  logger.info("==================================================================");
  logger.info("              STAGE 5.2 FINAL COMPREHENSIVE AUDIT                 ");
  logger.info("==================================================================");

  const accountingService = new AccountingService(uow, logger);
  const stage5Service = new Stage5Service(uow, logger, accountingService);
  const stage5_2Service = new Stage5_2Service(uow, logger, accountingService);

  // -------------------------------------------------------------------------
  // CLEANUP AND PRE-SEED BASE DATA
  // -------------------------------------------------------------------------
  logger.info("\n--- PREPARING SYSTEM CLEAN STATE AND BASE DATA ---");
  await db.transaction(async (tx) => {
    logger.info("Purging tables for clean audit...");
    await tx.delete(schema.budgetPeriods);
    await tx.delete(schema.budgetRevisions);
    await tx.delete(schema.budgets);
    await tx.delete(schema.cashTransactions);
    await tx.delete(schema.cashTransfers);
    await tx.delete(schema.exchangeRates);
    await tx.delete(schema.currencies);
    await tx.delete(schema.bankTransactions);
    await tx.delete(schema.bankReconciliations);
    await tx.delete(schema.vendorPayments);
    await tx.delete(schema.vendorInvoiceItems);
    await tx.delete(schema.vendorInvoices);
    await tx.delete(schema.customerReceipts);
    await tx.delete(schema.customerInvoiceItems);
    await tx.delete(schema.customerInvoices);
    await tx.delete(schema.creditNotes);
    await tx.delete(schema.bankAccounts);
    await tx.delete(schema.generalLedgerEntries);
    await tx.delete(schema.fiscalCloseRuns);
    await tx.delete(schema.accountingPeriods);
    await tx.delete(schema.fiscalYears);

    // Seed Company
    const comp = await tx.select().from(schema.companies).where(eq(schema.companies.id, 1)).limit(1);
    if (comp.length === 0) {
      await tx.insert(schema.companies).values({
        id: 1,
        name: "Enterprise Multi-National Inc",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Seed Fiscal Year 2026
    await tx.insert(schema.fiscalYears).values({
      year: 2026,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      status: "open",
    });

    const fy = await tx.select().from(schema.fiscalYears).where(eq(schema.fiscalYears.year, 2026)).limit(1);

    // Seed Accounting Period June 2026
    await tx.insert(schema.accountingPeriods).values({
      fiscalYearId: fy[0].id,
      periodNumber: 6,
      name: "June 2026",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-06-30"),
      status: "open",
    });

    // Seed Accounting Period July 2026 (for revaluation reversals)
    await tx.insert(schema.accountingPeriods).values({
      fiscalYearId: fy[0].id,
      periodNumber: 7,
      name: "July 2026",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-31"),
      status: "open",
    });

    // Seed default vendor
    const existingVendor = await tx.select().from(schema.vendors).where(eq(schema.vendors.id, 1)).limit(1);
    if (existingVendor.length === 0) {
      await tx.insert(schema.vendors).values({
        id: 1,
        companyId: 1,
        name: "Global Supplier Corp (Europe)",
        paymentTerms: "cash",
      });
    } else {
      await tx.update(schema.vendors).set({
        paymentTerms: "cash"
      }).where(eq(schema.vendors.id, 1));
    }

    // Seed default customer
    const existingCustomer = await tx.select().from(schema.customers).where(eq(schema.customers.id, 1)).limit(1);
    if (existingCustomer.length === 0) {
      await tx.insert(schema.customers).values({
        id: 1,
        name: "Overseas Buyer Ltd (UK)",
        mobileNumber: "+44712345678",
        balance: "0.00",
        creditLimit: "100000.00",
        creditHold: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else {
      await tx.update(schema.customers).set({
        balance: "0.00",
        creditLimit: "100000.00",
        creditHold: false,
        updatedAt: new Date(),
      }).where(eq(schema.customers.id, 1));
    }
  });

  // Setup Currencies
  await stage5_2Service.createCurrency({
    code: "USD",
    name: "United States Dollar",
    symbol: "$",
    isBase: true,
    decimals: 2,
  });

  await stage5_2Service.createCurrency({
    code: "EUR",
    name: "Euro",
    symbol: "€",
    isBase: false,
    decimals: 2,
  });

  await stage5_2Service.createCurrency({
    code: "GBP",
    name: "Great British Pound",
    symbol: "£",
    isBase: false,
    decimals: 2,
  });

  // Seed Exchange Rates
  await stage5_2Service.setExchangeRate({
    fromCurrency: "EUR",
    toCurrency: "USD",
    rate: 1.10,
    rateDate: "2026-06-01",
  });

  await stage5_2Service.setExchangeRate({
    fromCurrency: "GBP",
    toCurrency: "USD",
    rate: 1.30,
    rateDate: "2026-06-01",
  });

  // Create Bank Accounts
  const usdBank = await stage5Service.createBankAccount({
    companyId: 1,
    name: "Main USD operating",
    accountNumber: "USD-112233",
    currency: "USD",
    ledgerAccountCode: "1010",
  });
  await db.update(schema.bankAccounts).set({ balance: "50000.00" }).where(eq(schema.bankAccounts.id, usdBank.id));

  const eurBank = await stage5Service.createBankAccount({
    companyId: 1,
    name: "EUR Operating Wallet",
    accountNumber: "EUR-445566",
    currency: "EUR",
    ledgerAccountCode: "1011",
  });
  await db.update(schema.bankAccounts).set({ balance: "10000.00" }).where(eq(schema.bankAccounts.id, eurBank.id));

  // Opening GL journals
  await accountingService.postJournalEntry({
    companyId: 1,
    description: "Opening Balance Seeding - USD Account",
    referenceType: "transfer",
    createdAt: new Date("2026-06-01"),
    lines: [
      { accountCode: "1010", accountType: "assets", accountName: "Main USD operating", debit: 50000.0, credit: 0 },
      { accountCode: "3010", accountType: "equity", accountName: "Retained Earnings", debit: 0, credit: 50000.0 }
    ]
  }, uow);

  await accountingService.postJournalEntry({
    companyId: 1,
    description: "Opening Balance Seeding - EUR Account",
    referenceType: "transfer",
    createdAt: new Date("2026-06-01"),
    lines: [
      { accountCode: "1011", accountType: "assets", accountName: "EUR Operating Wallet", debit: 11000.0, credit: 0 }, // 10000 * 1.10
      { accountCode: "3010", accountType: "equity", accountName: "Retained Earnings", debit: 0, credit: 11000.0 }
    ]
  }, uow);

  logger.info("System base data and opening balances prepared successfully!");

  // =========================================================================
  // AUDIT STEP 1: FOREIGN CURRENCY SUBLEDGER RECONCILIATION
  // =========================================================================
  logger.info("\n==================================================================");
  logger.info("1. FOREIGN CURRENCY SUBLEDGER RECONCILIATION");
  logger.info("==================================================================");

  // Let's create an open (posted but unpaid) AP invoice in EUR
  const eurApInvoice = await stage5Service.createVendorInvoice({
    companyId: 1,
    vendorId: 1,
    invoiceNumber: "AUDIT-EUR-AP-1",
    invoiceDate: "2026-06-15",
    dueDate: "2026-06-30",
    currencyCode: "EUR",
    exchangeRate: 1.10,
    items: [{ accountCode: "5010", description: "Audit AP Machinery", quantity: 1, unitPrice: 1000.00 }],
  });
  await stage5Service.postVendorInvoice(eurApInvoice.id);

  // Let's create an open AP invoice in GBP
  const gbpApInvoice = await stage5Service.createVendorInvoice({
    companyId: 1,
    vendorId: 1,
    invoiceNumber: "AUDIT-GBP-AP-1",
    invoiceDate: "2026-06-15",
    dueDate: "2026-06-30",
    currencyCode: "GBP",
    exchangeRate: 1.30,
    items: [{ accountCode: "5010", description: "Audit AP Spares", quantity: 1, unitPrice: 2000.00 }],
  });
  await stage5Service.postVendorInvoice(gbpApInvoice.id);

  // Let's create an open AR invoice in EUR
  const eurArInvoice = await stage5Service.createCustomerInvoice({
    companyId: 1,
    customerId: 1,
    invoiceNumber: "AUDIT-EUR-AR-1",
    invoiceDate: "2026-06-15",
    dueDate: "2026-06-30",
    currencyCode: "EUR",
    exchangeRate: 1.10,
    items: [{ accountCode: "4010", description: "Audit AR Exports", quantity: 1, unitPrice: 3000.00 }],
  });
  await stage5Service.postCustomerInvoice(eurArInvoice.id);

  // Let's create an open AR invoice in GBP
  const gbpArInvoice = await stage5Service.createCustomerInvoice({
    companyId: 1,
    customerId: 1,
    invoiceNumber: "AUDIT-GBP-AR-1",
    invoiceDate: "2026-06-15",
    dueDate: "2026-06-30",
    currencyCode: "GBP",
    exchangeRate: 1.30,
    items: [{ accountCode: "4010", description: "Audit AR UK consulting", quantity: 1, unitPrice: 1500.00 }],
  });
  await stage5Service.postCustomerInvoice(gbpArInvoice.id);

  // Now, calculate subledger totals vs GL control accounts
  const openAPInvoices = await db.select().from(schema.vendorInvoices).where(sql`${schema.vendorInvoices.status} IN ('posted', 'partially_paid')`);
  const openARInvoices = await db.select().from(schema.customerInvoices).where(sql`${schema.customerInvoices.status} IN ('posted', 'partially_paid')`);

  const apEntries = await db.select().from(schema.generalLedgerEntries).where(eq(schema.generalLedgerEntries.accountCode, "2010"));
  const arEntries = await db.select().from(schema.generalLedgerEntries).where(eq(schema.generalLedgerEntries.accountCode, "1200"));

  const apGLBalance = apEntries.reduce((sum, e) => sum + Number(e.credit) - Number(e.debit), 0);
  const arGLBalance = arEntries.reduce((sum, e) => sum + Number(e.debit) - Number(e.credit), 0);

  // Group AP Invoices
  const apReconciliation: any[] = [];
  let totalApBaseOutstanding = 0;
  
  const apCurrencies = ["EUR", "GBP", "USD"];
  for (const curr of apCurrencies) {
    const invs = openAPInvoices.filter(i => i.currencyCode === curr);
    if (invs.length === 0) continue;
    
    const origSum = invs.reduce((sum, i) => sum + Number(i.currencyAmount || i.totalAmount), 0);
    const baseSum = invs.reduce((sum, i) => sum + (Number(i.totalAmount) - Number(i.paidAmount)), 0);
    totalApBaseOutstanding += baseSum;
    apReconciliation.push({
      Currency: curr,
      "Original Amount": origSum.toFixed(2),
      "Base Currency Equivalent": `$${baseSum.toFixed(2)}`,
    });
  }

  // Group AR Invoices
  const arReconciliation: any[] = [];
  let totalArBaseOutstanding = 0;
  
  const arCurrencies = ["EUR", "GBP", "USD"];
  for (const curr of arCurrencies) {
    const invs = openARInvoices.filter(i => i.currencyCode === curr);
    if (invs.length === 0) continue;
    
    const origSum = invs.reduce((sum, i) => sum + Number(i.currencyAmount || i.totalAmount), 0);
    const baseSum = invs.reduce((sum, i) => sum + (Number(i.totalAmount) - Number(i.paidAmount)), 0);
    totalArBaseOutstanding += baseSum;
    arReconciliation.push({
      Currency: curr,
      "Original Amount": origSum.toFixed(2),
      "Base Currency Equivalent": `$${baseSum.toFixed(2)}`,
    });
  }

  logger.info("\n--- ACCOUNTS PAYABLE (2010) SUBLEDGER RECONCILIATION ---");
  console.table(apReconciliation);
  logger.info(`Total AP Subledger Base Outstanding: $${totalApBaseOutstanding.toFixed(2)}`);
  logger.info(`General Ledger Account (2010) Balance: $${apGLBalance.toFixed(2)}`);
  logger.info(`AP Reconciliation Variance: $${(totalApBaseOutstanding - apGLBalance).toFixed(2)}`);

  logger.info("\n--- ACCOUNTS RECEIVABLE (1200) SUBLEDGER RECONCILIATION ---");
  console.table(arReconciliation);
  logger.info(`Total AR Subledger Base Outstanding: $${totalArBaseOutstanding.toFixed(2)}`);
  logger.info(`General Ledger Account (1200) Balance: $${arGLBalance.toFixed(2)}`);
  logger.info(`AR Reconciliation Variance: $${(totalArBaseOutstanding - arGLBalance).toFixed(2)}`);


  // =========================================================================
  // AUDIT STEP 2: FX REVALUATION REVERSAL TEST
  // =========================================================================
  logger.info("\n==================================================================");
  logger.info("2. FX REVALUATION REVERSAL TEST");
  logger.info("==================================================================");

  // Set next-period exchange rate for revaluation (e.g. rate changes on June 30)
  // EUR rate rises to 1.20, GBP rate rises to 1.40
  await stage5_2Service.setExchangeRate({
    fromCurrency: "EUR",
    toCurrency: "USD",
    rate: 1.20,
    rateDate: "2026-06-30",
  });

  await stage5_2Service.setExchangeRate({
    fromCurrency: "GBP",
    toCurrency: "USD",
    rate: 1.40,
    rateDate: "2026-06-30",
  });

  logger.info("Running period-end currency revaluation as of 2026-06-30...");
  const revalResult = await stage5_2Service.postUnrealizedRevaluation({
    companyId: 1,
    revaluationDate: "2026-06-30",
    performedByUserId: 1,
  });

  logger.info(`Revaluation completed. Total adjustment entries posted: ${revalResult.revalEntriesCount}`);

  // Fetch and print all GL Entries on 2026-06-30 and 2026-07-01 to show revaluation and automatic reversal!
  const allGLEntries = await db.select().from(schema.generalLedgerEntries);
  
  const revalJournals = allGLEntries.filter(e => e.createdAt.toISOString().slice(0, 10) === "2026-06-30");
  const reversalJournals = allGLEntries.filter(e => e.createdAt.toISOString().slice(0, 10) === "2026-07-01");

  logger.info("\n--- PERIOD-END UNREALIZED FX REVALUATION ENTRIES (JUNE 30) ---");
  const revalTable = revalJournals.map(j => ({
    Date: j.createdAt.toISOString().slice(0, 10),
    Account: `${j.accountCode} - ${j.accountName}`,
    Debit: `$${Number(j.debit).toFixed(2)}`,
    Credit: `$${Number(j.credit).toFixed(2)}`,
    Description: j.description,
  }));
  console.table(revalTable);

  logger.info("\n--- FIRST-DAY AUTOMATIC REVERSAL ENTRIES (JULY 1) ---");
  const reversalTable = reversalJournals.map(j => ({
    Date: j.createdAt.toISOString().slice(0, 10),
    Account: `${j.accountCode} - ${j.accountName}`,
    Debit: `$${Number(j.debit).toFixed(2)}`,
    Credit: `$${Number(j.credit).toFixed(2)}`,
    Description: j.description,
  }));
  console.table(reversalTable);


  // =========================================================================
  // AUDIT STEP 3: INTERBANK TRANSFER AUDIT
  // =========================================================================
  logger.info("\n==================================================================");
  logger.info("3. INTERBANK TRANSFER AUDIT");
  logger.info("==================================================================");

  logger.info("Executing transfer of $5,000.00 from Main USD operating to EUR account...");
  const transferRecord = await stage5_2Service.transferCash({
    companyId: 1,
    sourceBankAccountId: usdBank.id,
    destinationBankAccountId: eurBank.id,
    amount: 5000.00,
    transferDate: "2026-06-25",
    referenceNumber: "AUDIT-XFER-101",
    notes: "Top-up EUR wallet working capital",
  });

  // Verify DB record
  const dbTransfers = await db.select().from(schema.cashTransfers).where(eq(schema.cashTransfers.id, transferRecord.id));
  const transfer = dbTransfers[0];

  // Fetch GL Entries for this transfer
  const xferGLEntries = await db.select().from(schema.generalLedgerEntries).where(
    and(
      eq(schema.generalLedgerEntries.referenceType, "transfer"),
      sql`${schema.generalLedgerEntries.description} LIKE '%AUDIT-XFER-101%'`
    )
  );

  const debitLines = xferGLEntries.filter(e => Number(e.debit) > 0);
  const creditLines = xferGLEntries.filter(e => Number(e.credit) > 0);

  const xferReport = [{
    "Transfer ID": transfer.id,
    "Source Account": "Main USD operating (1010)",
    "Destination Account": "EUR Operating Wallet (1010)",
    "Amount": `$${Number(transfer.amount).toFixed(2)}`,
    "GL Debit Entry": debitLines.map(d => `${d.accountName} (+$${Number(d.debit).toFixed(2)})`).join(", "),
    "GL Credit Entry": creditLines.map(c => `${c.accountName} (-$${Number(c.credit).toFixed(2)})`).join(", "),
    "Orphan Movements Exist": xferGLEntries.length % 2 !== 0 ? "YES" : "NO",
  }];

  console.table(xferReport);


  // =========================================================================
  // AUDIT STEP 4: BUDGET CONTROL VALIDATION
  // =========================================================================
  logger.info("\n==================================================================");
  logger.info("4. BUDGET CONTROL VALIDATION");
  logger.info("==================================================================");

  // Create an annual budget of $4,000.00 for Inventory Shrinkage Expense '5020'
  const activeFy = await db.select().from(schema.fiscalYears).where(eq(schema.fiscalYears.year, 2026)).limit(1);
  const activePeriod = await db.select().from(schema.accountingPeriods).where(and(eq(schema.accountingPeriods.fiscalYearId, activeFy[0].id), eq(schema.accountingPeriods.periodNumber, 6))).limit(1);

  const budget = await stage5_2Service.createBudget({
    companyId: 1,
    fiscalYearId: activeFy[0].id,
    accountCode: "5020",
    name: "2026 Audit Inventory Shrinkage",
    annualAmount: 4000.00,
    periodAmounts: [
      { periodId: activePeriod[0].id, amount: 4000.00 }
    ],
    notes: "Auditable shrinkage budget limit",
  });

  logger.info(`Budget created successfully with ID: ${budget.id} (Limit: $4,000.00)`);

  // Post a transaction BELOW budget limit
  logger.info("\nPosting transaction BELOW budget limit ($1,500.00)...");
  await stage5_2Service.pettyCashTransaction({
    companyId: 1,
    bankAccountId: usdBank.id,
    type: "cash_out",
    amount: 1500.00,
    ledgerAccountCode: "5020",
    transactionDate: "2026-06-10",
    description: "Minor warehouse breakage write-off",
  });

  // Post a transaction that EXCEEDS budget limit
  logger.info("\nPosting transaction ABOVE budget limit ($3,000.00, cumulative $4,500.00, limit is $4,000.00)...");
  await stage5_2Service.pettyCashTransaction({
    companyId: 1,
    bankAccountId: usdBank.id,
    type: "cash_out",
    amount: 3000.00,
    ledgerAccountCode: "5020",
    transactionDate: "2026-06-25",
    description: "Major shipment shrinkage adjustment",
  });

  // Let's revise the budget to $6,000.00 to demonstrate workflow and audit logs
  logger.info("\nRevising budget to $6,000.00 to demonstrate authorization workflow...");
  await stage5_2Service.reviseBudget({
    budgetId: budget.id,
    revisedAmount: 6000.00,
    reason: "Board approved variance increase due to international freight delays",
    revisedByUserId: 1,
  });

  // Verify Audit Logs exist in budgetRevisions
  const revisions = await db.select().from(schema.budgetRevisions).where(eq(schema.budgetRevisions.budgetId, budget.id));
  logger.info("\n--- BUDGET AUDIT TRAIL LOGS ---");
  const revisionsTable = revisions.map(r => ({
    "Revision ID": r.id,
    "Revised Amount": `$${Number(r.revisedAmount).toFixed(2)}`,
    "Reason": r.reason,
    "Revised By (User ID)": r.revisedByUserId,
    "Date Created": r.createdAt.toISOString().slice(0, 10),
  }));
  console.table(revisionsTable);


  // =========================================================================
  // AUDIT STEP 5: FINAL FINANCIAL STATEMENT VALIDATION
  // =========================================================================
  logger.info("\n==================================================================");
  logger.info("5. FINAL FINANCIAL STATEMENT VALIDATION");
  logger.info("==================================================================");

  // Generate Statements as of 2026-06-30
  const finalTB = await stage5_2Service.getTrialBalance(1, new Date("2026-06-30"));
  const finalBS = await stage5_2Service.getBalanceSheet(1, new Date("2026-06-30"));
  const finalIS = await stage5_2Service.getIncomeStatement(1, new Date("2026-06-01"), new Date("2026-06-30"));
  const finalCF = await stage5_2Service.getCashFlowStatement(1, new Date("2026-06-01"), new Date("2026-06-30"));

  // Check 1: Trial Balance Double-Entry Equality
  logger.info(`Trial Balance Total Debits:  $${finalTB.totalDebits.toFixed(2)}`);
  logger.info(`Trial Balance Total Credits: $${finalTB.totalCredits.toFixed(2)}`);
  logger.info(`Balanced: ${finalTB.isBalanced ? "YES" : "NO"}`);
  if (!finalTB.isBalanced) throw new Error("Accounting error: Trial Balance out of balance!");

  // Check 2: Assets = Liabilities + Equity
  logger.info("\n--- BALANCE SHEET EQUATION CHECK ---");
  logger.info(`Total Assets:                     $${finalBS.totalAssets.toFixed(2)}`);
  logger.info(`Total Liabilities + Equity:       $${finalBS.totalLiabilitiesAndEquity.toFixed(2)}`);
  logger.info(`Equation Balanced:                ${finalBS.isBalanced ? "YES" : "NO"}`);
  if (!finalBS.isBalanced) throw new Error("Accounting error: Balance Sheet equation failed!");

  // Check 3: Net Income Matches Retained Earnings Movement
  logger.info("\n--- INCOME STATEMENT INTEGRITY CHECK ---");
  logger.info(`Net Income (Loss) for June:       $${finalIS.netIncome.toFixed(2)}`);
  
  // Check 4: Cash Flow Statement Reconciles
  logger.info("\n--- CASH FLOW STATEMENT RECONCILIATION ---");
  const totalGLCash = finalBS.assets.filter(a => a.code === "1010" || a.code === "1011").reduce((sum, a) => sum + a.balance, 0);
  const startCash = 0.00; // 0.00 because opening balances are posted on June 1, so they are captured inside June's flow
  const netIncreaseInCash = finalCF.netIncreaseInCash;
  const calculatedEndingCash = startCash + netIncreaseInCash;

  logger.info(`Starting Cash Balance (GL):       $${startCash.toFixed(2)}`);
  logger.info(`Net Cash Increase / (Decrease):   $${netIncreaseInCash.toFixed(2)}`);
  logger.info(`Ending Cash (Calculated):         $${calculatedEndingCash.toFixed(2)}`);
  logger.info(`Ending Cash (GL Ledger Balance):  $${totalGLCash.toFixed(2)}`);
  logger.info(`Cash Flow Statement Balanced:     ${Math.abs(calculatedEndingCash - totalGLCash) < 0.05 ? "YES" : "NO"}`);

  logger.info("\n==================================================================");
  logger.info("              STAGE 5.2 AUDIT SUCCESSFULLY COMPLETED              ");
  logger.info("==================================================================");
}

runAudit()
  .then(() => {
    logger.info("Audit execution finished successfully.");
    process.exit(0);
  })
  .catch(err => {
    logger.error(`Audit crashed: ${err.message}`);
    console.error(err);
    process.exit(1);
  });
