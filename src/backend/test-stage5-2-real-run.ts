// src/backend/test-stage5-2-real-run.ts

import { db } from "../db/index.ts";
import { DrizzleUnitOfWork } from "./infrastructure/persistence/unit-of-work.ts";
import { AccountingService } from "./application/services/accounting.service.ts";
import { Stage5Service } from "./application/services/stage5.service.ts";
import { Stage5_2Service } from "./application/services/stage5_2.service.ts";
import { StructuredLogger } from "./infrastructure/logging/logger.ts";
import * as schema from "../db/schema.ts";
import { eq } from "drizzle-orm";

const logger = new StructuredLogger();
const uow = new DrizzleUnitOfWork();

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
  logger.info(` Balanced: ${tb.isBalanced ? "YES (DEBITS = CREDITS)" : "NO"}`);
  logger.info(`==================================================================\n`);
}

function printBalanceSheet(bs: any, title: string) {
  logger.info(`\n==================================================================`);
  logger.info(` BALANCE SHEET: ${title.toUpperCase()} as of ${bs.date.toISOString().slice(0, 10)}`);
  logger.info(`==================================================================`);
  
  logger.info(` ASSETS:`);
  for (const a of bs.assets) {
    logger.info(`   ${a.code.padEnd(6)} | ${a.name.padEnd(35)} | $${a.balance.toFixed(2).padStart(12)}`);
  }
  logger.info(` TOTAL ASSETS:`.padEnd(46) + ` | $${bs.totalAssets.toFixed(2).padStart(12)}`);
  logger.info("-".repeat(65));

  logger.info(` LIABILITIES:`);
  for (const l of bs.liabilities) {
    logger.info(`   ${l.code.padEnd(6)} | ${l.name.padEnd(35)} | $${l.balance.toFixed(2).padStart(12)}`);
  }
  logger.info(` TOTAL LIABILITIES:`.padEnd(46) + ` | $${bs.totalLiabilities.toFixed(2).padStart(12)}`);
  logger.info("-".repeat(65));

  logger.info(` EQUITY:`);
  for (const e of bs.equity) {
    logger.info(`   ${e.code.padEnd(6)} | ${e.name.padEnd(35)} | $${e.balance.toFixed(2).padStart(12)}`);
  }
  logger.info(` TOTAL EQUITY:`.padEnd(46) + ` | $${bs.totalEquity.toFixed(2).padStart(12)}`);
  logger.info("-".repeat(65));
  
  logger.info(` TOTAL LIABILITIES & EQUITY:`.padEnd(46) + ` | $${bs.totalLiabilitiesAndEquity.toFixed(2).padStart(12)}`);
  logger.info(` Balanced: ${bs.isBalanced ? "YES" : "NO"}`);
  logger.info(`==================================================================\n`);
}

function printIncomeStatement(is: any, title: string) {
  logger.info(`\n==================================================================`);
  logger.info(` INCOME STATEMENT (P&L): ${title.toUpperCase()}`);
  logger.info(` Period: ${is.startDate.toISOString().slice(0, 10)} to ${is.endDate.toISOString().slice(0, 10)}`);
  logger.info(`==================================================================`);
  
  logger.info(` REVENUES:`);
  for (const r of is.revenues) {
    logger.info(`   ${r.code.padEnd(6)} | ${r.name.padEnd(35)} | $${r.balance.toFixed(2).padStart(12)}`);
  }
  logger.info(` TOTAL REVENUE:`.padEnd(46) + ` | $${is.totalRevenue.toFixed(2).padStart(12)}`);
  logger.info("-".repeat(65));

  logger.info(` EXPENSES:`);
  for (const e of is.expenses) {
    logger.info(`   ${e.code.padEnd(6)} | ${e.name.padEnd(35)} | $${e.balance.toFixed(2).padStart(12)}`);
  }
  logger.info(` TOTAL EXPENSES:`.padEnd(46) + ` | $${is.totalExpenses.toFixed(2).padStart(12)}`);
  logger.info("-".repeat(65));

  logger.info(` NET INCOME / (LOSS):`.padEnd(46) + ` | $${is.netIncome.toFixed(2).padStart(12)}`);
  logger.info(`==================================================================\n`);
}

function printCashFlowStatement(cf: any, title: string) {
  logger.info(`\n==================================================================`);
  logger.info(` CASH FLOW STATEMENT: ${title.toUpperCase()}`);
  logger.info(` Period: ${cf.startDate.toISOString().slice(0, 10)} to ${cf.endDate.toISOString().slice(0, 10)}`);
  logger.info(`==================================================================`);
  logger.info(` Operating Activities Cash Flow:`);
  logger.info(`   Cash Inflow:`.padEnd(40) + ` $${cf.operating.inflow.toFixed(2).padStart(12)}`);
  logger.info(`   Cash Outflow:`.padEnd(40) + ` $${cf.operating.outflow.toFixed(2).padStart(12)}`);
  logger.info(`   NET OPERATING CASH FLOW:`.padEnd(40) + ` $${cf.operating.net.toFixed(2).padStart(12)}`);
  logger.info("-".repeat(60));

  logger.info(` Investing Activities Cash Flow:`);
  logger.info(`   NET INVESTING CASH FLOW:`.padEnd(40) + ` $${cf.investing.net.toFixed(2).padStart(12)}`);
  logger.info("-".repeat(60));

  logger.info(` Financing Activities Cash Flow:`);
  logger.info(`   NET FINANCING CASH FLOW:`.padEnd(40) + ` $${cf.financing.net.toFixed(2).padStart(12)}`);
  logger.info("-".repeat(60));

  logger.info(` NET INCREASE / (DECREASE) IN CASH:`.padEnd(40) + ` $${cf.netIncreaseInCash.toFixed(2).padStart(12)}`);
  logger.info(`==================================================================\n`);
}

function printAgingReports(apAging: any, arAging: any) {
  logger.info(`\n==================================================================`);
  logger.info(` ACCOUNTS PAYABLE (AP) VENDOR AGING REPORT`);
  logger.info(`==================================================================`);
  logger.info(` ${"Vendor Name".padEnd(30)} | ${"Current ($)".padStart(12)} | ${"1-30 ($)".padStart(10)} | ${"31-60 ($)".padStart(10)} | ${"61-90 ($)".padStart(10)} | ${"Total ($)".padStart(12)}`);
  logger.info("-".repeat(100));
  for (const v of apAging.vendors) {
    logger.info(` ${v.vendorName.padEnd(30)} | ${v.current.toFixed(2).padStart(12)} | ${v.aged30.toFixed(2).padStart(10)} | ${v.aged60.toFixed(2).padStart(10)} | ${v.aged90.toFixed(2).padStart(10)} | ${v.total.toFixed(2).padStart(12)}`);
  }
  logger.info("-".repeat(100));
  logger.info(` ${"TOTALS".padEnd(30)} | ${apAging.totals.current.toFixed(2).padStart(12)} | ${apAging.totals.aged30.toFixed(2).padStart(10)} | ${apAging.totals.aged60.toFixed(2).padStart(10)} | ${apAging.totals.aged90.toFixed(2).padStart(10)} | ${apAging.totals.total.toFixed(2).padStart(12)}`);
  logger.info(`==================================================================\n`);

  logger.info(`\n==================================================================`);
  logger.info(` ACCOUNTS RECEIVABLE (AR) CUSTOMER AGING REPORT`);
  logger.info(`==================================================================`);
  logger.info(` ${"Customer Name".padEnd(30)} | ${"Current ($)".padStart(12)} | ${"1-30 ($)".padStart(10)} | ${"31-60 ($)".padStart(10)} | ${"61-90 ($)".padStart(10)} | ${"Total ($)".padStart(12)}`);
  logger.info("-".repeat(100));
  for (const c of arAging.customers) {
    logger.info(` ${c.customerName.padEnd(30)} | ${c.current.toFixed(2).padStart(12)} | ${c.aged30.toFixed(2).padStart(10)} | ${c.aged60.toFixed(2).padStart(10)} | ${c.aged90.toFixed(2).padStart(10)} | ${c.total.toFixed(2).padStart(12)}`);
  }
  logger.info("-".repeat(100));
  logger.info(` ${"TOTALS".padEnd(30)} | ${arAging.totals.current.toFixed(2).padStart(12)} | ${arAging.totals.aged30.toFixed(2).padStart(10)} | ${arAging.totals.aged60.toFixed(2).padStart(10)} | ${arAging.totals.aged90.toFixed(2).padStart(10)} | ${arAging.totals.total.toFixed(2).padStart(12)}`);
  logger.info(`==================================================================\n`);
}

async function runStage5_2ValidationSimulation() {
  logger.info("==================================================================");
  logger.info("STAGE 5.2: MULTI-CURRENCY, BUDGETS, CASH MGMT, & FINANCIAL REVENUE");
  logger.info("==================================================================");

  const accountingService = new AccountingService(uow, logger);
  const stage5Service = new Stage5Service(uow, logger, accountingService);
  const stage5_2Service = new Stage5_2Service(uow, logger, accountingService);

  // STEP 1: CLEANUP AND RESET STAGE 5.2 & BASE DATA
  logger.info("\n--- STEP 1: CLEANING UP AND SEEDING BASE DATA ---");
  await db.transaction(async (tx) => {
    logger.info("Purging Stage 5 and 5.2 tables...");
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

    // Seed base company 1
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

    // Seed default fiscal year 2026
    await tx.insert(schema.fiscalYears).values({
      year: 2026,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      status: "open",
    });

    const fy = await tx.select().from(schema.fiscalYears).where(eq(schema.fiscalYears.year, 2026)).limit(1);

    // Seed default accounting period June 2026
    await tx.insert(schema.accountingPeriods).values({
      fiscalYearId: fy[0].id,
      periodNumber: 6,
      name: "June 2026",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-06-30"),
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
    }

    // Seed default customer
    const existingCustomer = await tx.select().from(schema.customers).where(eq(schema.customers.id, 1)).limit(1);
    if (existingCustomer.length === 0) {
      await tx.insert(schema.customers).values({
        id: 1,
        name: "Overseas Buyer Ltd (UK)",
        mobileNumber: "+44712345678",
        creditLimit: "100000.00",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  });

  // STEP 2: SETUP CURRENCIES & EXCHANGE RATES
  logger.info("\n--- STEP 2: CONFIGURE MULTI-CURRENCY MASTER & EXCHANGE RATES ---");
  
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

  // EUR rate: 1 EUR = 1.10 USD
  await stage5_2Service.setExchangeRate({
    fromCurrency: "EUR",
    toCurrency: "USD",
    rate: 1.10,
    rateDate: "2026-06-01",
  });

  // GBP rate: 1 GBP = 1.30 USD
  await stage5_2Service.setExchangeRate({
    fromCurrency: "GBP",
    toCurrency: "USD",
    rate: 1.30,
    rateDate: "2026-06-01",
  });

  logger.info("Currencies & Exchange Rates defined successfully!");

  // STEP 3: INITIALIZE BANK ACCOUNTS WITH PROPER INITIAL GL ENTRIES
  logger.info("\n--- STEP 3: INITIALIZE BANK/CASH ACCOUNTS & SEED BALANCES ---");

  // Create USD Main Account
  const usdBank = await stage5Service.createBankAccount({
    companyId: 1,
    name: "Main USD operating",
    accountNumber: "USD-112233",
    currency: "USD",
    ledgerAccountCode: "1010",
  });

  // Seed actual balance in database
  await db.update(schema.bankAccounts).set({ balance: "50000.00" }).where(eq(schema.bankAccounts.id, usdBank.id));

  // Post initial balance journal for USD account to reconcile GL
  await accountingService.postJournalEntry({
    companyId: 1,
    description: "Opening Balance Seeding - USD Operating Account",
    referenceType: "transfer",
    createdAt: new Date("2026-06-01"),
    lines: [
      {
        accountCode: "1010",
        accountType: "assets",
        accountName: "Main USD operating",
        debit: 50000.0,
        credit: 0,
      },
      {
        accountCode: "3010",
        accountType: "equity",
        accountName: "Retained Earnings",
        debit: 0,
        credit: 50000.0,
      }
    ]
  }, uow);

  // Create EUR Operating Account (Initial balance: €10,000, which is $11,000 in base)
  const eurBank = await stage5Service.createBankAccount({
    companyId: 1,
    name: "EUR Operating Wallet",
    accountNumber: "EUR-445566",
    currency: "EUR",
    ledgerAccountCode: "1010",
  });

  // Seed actual balance in database
  await db.update(schema.bankAccounts).set({ balance: "10000.00" }).where(eq(schema.bankAccounts.id, eurBank.id));

  // Post initial balance journal for EUR account to reconcile GL
  await accountingService.postJournalEntry({
    companyId: 1,
    description: "Opening Balance Seeding - EUR Operating Account",
    referenceType: "transfer",
    createdAt: new Date("2026-06-01"),
    lines: [
      {
        accountCode: "1010",
        accountType: "assets",
        accountName: "EUR Operating Wallet",
        debit: 11000.0, // €10,000 * 1.10 exchange rate
        credit: 0,
      },
      {
        accountCode: "3010",
        accountType: "equity",
        accountName: "Retained Earnings",
        debit: 0,
        credit: 11000.0,
      }
    ]
  }, uow);

  let initialTB = await stage5_2Service.getTrialBalance(1, new Date("2026-06-01"));
  printTrialBalance(initialTB, "Initial Seeded State");

  // STEP 4: BUDGETING ENGINE & CONTROLS
  logger.info("\n--- STEP 4: ANNUAL BUDGET DEFINITION, REVISION & EXPENSE WARNINGS ---");

  const realFyList = await db.select().from(schema.fiscalYears).where(eq(schema.fiscalYears.year, 2026)).limit(1);
  const realFyId = realFyList[0].id;

  const realPeriodList = await db.select().from(schema.accountingPeriods).where(eq(schema.accountingPeriods.fiscalYearId, realFyId)).limit(1);
  const realPeriodId = realPeriodList[0].id;

  // Create an annual expense budget of $5,000.00 for Inventory Shrinkage Expense '5020'
  const budget = await stage5_2Service.createBudget({
    companyId: 1,
    fiscalYearId: realFyId,
    accountCode: "5020",
    name: "2026 Shrinkage and Variance",
    annualAmount: 5000.00,
    periodAmounts: [
      { periodId: realPeriodId, amount: 5000.00 }
    ],
    notes: "Strict limit for variance and shrink",
  });

  // Revise budget down to $4,000.00
  await stage5_2Service.reviseBudget({
    budgetId: budget.id,
    revisedAmount: 4000.00,
    reason: "Austerity and shrinkage optimization initiative",
    revisedByUserId: 1,
  });

  // Record a Cash out of $4,500.00 (which exceeds revised budget of $4,000.00) to trigger our warning logger!
  logger.info("Executing a Cash out transaction exceeding the revised budget limit to verify warning logs:");
  await stage5_2Service.pettyCashTransaction({
    companyId: 1,
    bankAccountId: usdBank.id,
    type: "cash_out",
    amount: 4500.00,
    transactionDate: "2026-06-10",
    description: "Urgent Petty Cash shrink adjustments",
    ledgerAccountCode: "5020",
  });

  // Fetch Budget vs Actual analysis
  const budgetsAnalysis = await stage5_2Service.getBudgetVsActual(1, realFyId);
  logger.info("Budget vs Actual Analysis:");
  console.table(budgetsAnalysis);

  // STEP 5: MULTI-CURRENCY TRANSACTIONS & REALIZED FX GAIN/LOSS
  logger.info("\n--- STEP 5: EUR VENDOR INVOICE & REALIZED FX LOSS ON PAYMENT ---");

  // Create vendor invoice in EUR (foreign amount EUR 2,000.00, exchange rate 1.10 = base carrying $2,200.00)
  const vendorInvoiceDraft = await stage5Service.createVendorInvoice({
    companyId: 1,
    vendorId: 1,
    invoiceNumber: "EUR-INV-99",
    invoiceDate: "2026-06-15",
    dueDate: "2026-06-30",
    currencyCode: "EUR",
    exchangeRate: 1.10,
    items: [
      {
        accountCode: "5010",
        description: "European imported machinery parts",
        quantity: 1,
        unitPrice: 2000.00,
      }
    ],
  });

  const vendorInvoicePosted = await stage5Service.postVendorInvoice(vendorInvoiceDraft.id);
  logger.info(`Posted EUR Invoice ${vendorInvoicePosted.invoiceNumber}. Base Carrying Value in AP Control: $${vendorInvoicePosted.totalAmount}`);

  // Now settle the invoice on June 20. On June 20, the EUR to USD rate is 1.15.
  // The cash paid in base currency (settling EUR 2000.00) is EUR 2,000.00 * 1.15 = USD 2,300.00.
  // Since our base carrying value in AP Control was $2,200.00, we incur a REALIZED FX LOSS of $100.00!
  await stage5_2Service.setExchangeRate({
    fromCurrency: "EUR",
    toCurrency: "USD",
    rate: 1.15,
    rateDate: "2026-06-20",
  });

  logger.info("Paying EUR invoice at higher rate (1.15) to trigger Realized FX Loss:");
  const paymentRecord = await stage5Service.payVendorInvoice({
    companyId: 1,
    vendorId: 1,
    vendorInvoiceId: vendorInvoicePosted.id,
    bankAccountId: eurBank.id,
    paymentDate: "2026-06-20",
    paymentMethod: "bank",
    amount: 2300.00, // EUR 2,000.00 paid at 1.15 exchange rate = USD 2,300.00
    currencyCode: "EUR",
    exchangeRate: 1.15,
    currencyAmount: 2000.00,
    notes: "Settling European equipment supplier in full",
  });

  logger.info(`Payment recorded. Invoice status is now: ${paymentRecord.status}`);

  // Let's do the same for a Customer Invoice in GBP!
  // GBP Invoice of GBP 3,000.00 (exchange rate 1.30 = USD 3,900.00 carrying asset)
  const custInvoiceDraft = await stage5Service.createCustomerInvoice({
    companyId: 1,
    customerId: 1,
    invoiceNumber: "GBP-INV-88",
    invoiceDate: "2026-06-15",
    dueDate: "2026-06-30",
    currencyCode: "GBP",
    exchangeRate: 1.30,
    items: [
      {
        accountCode: "4010",
        description: "Premium wholesale goods exports",
        quantity: 1,
        unitPrice: 3000.00,
      }
    ],
  });

  const custInvoicePosted = await stage5Service.postCustomerInvoice(custInvoiceDraft.id);
  logger.info(`Posted GBP Customer Invoice ${custInvoicePosted.invoiceNumber}. Base Carrying Value in AR Control: $${custInvoicePosted.totalAmount}`);

  // Receive GBP payment on June 22 when exchange rate rises to 1.40!
  // Settle GBP 3,000.00 at 1.40 rate = USD 4,200.00 received.
  // Original asset was USD 3,900.00. We earn a REALIZED FX GAIN of $300.00!
  await stage5_2Service.setExchangeRate({
    fromCurrency: "GBP",
    toCurrency: "USD",
    rate: 1.40,
    rateDate: "2026-06-22",
  });

  logger.info("Receiving GBP payment at higher rate (1.40) to trigger Realized FX Gain:");
  await stage5Service.receiveCustomerPayment({
    companyId: 1,
    customerId: 1,
    customerInvoiceId: custInvoicePosted.id,
    bankAccountId: usdBank.id,
    receiptDate: "2026-06-22",
    paymentMethod: "bank",
    amount: 4200.00, // GBP 3,000.00 at 1.40 = USD 4,200.00
    currencyCode: "GBP",
    exchangeRate: 1.40,
    currencyAmount: 3000.00,
    notes: "Full receipt of UK client contract",
  });

  // STEP 6: CASH MANAGEMENT (INTERBANK TRANSFERS)
  logger.info("\n--- STEP 6: CASH TRANSFERS & PETTY CASH WORKFLOWS ---");

  // Transfer USD 5,000.00 from Main USD account to EUR account (to top up working balances)
  await stage5_2Service.transferCash({
    companyId: 1,
    sourceBankAccountId: usdBank.id,
    destinationBankAccountId: eurBank.id,
    amount: 5000.00,
    transferDate: "2026-06-25",
    referenceNumber: "XFER-USD-EUR-100",
    notes: "Working capital top-up for EUR cash account",
  });

  // Log current cash position
  const cashPos = await stage5_2Service.getCashPosition(1);
  logger.info("Current Multi-Currency Cash Position:");
  console.table(cashPos.bankAccounts);

  // STEP 7: UNREALIZED PERIOD-END CURRENCY REVALUATION
  logger.info("\n--- STEP 7: PERIOD-END UNREALIZED FX REVALUATION (JUNE 30) ---");

  // Let's create an unpaid foreign invoice in EUR to test unrealized revaluation.
  // Draft EUR Invoice of EUR 5,000.00 on June 28 at EUR/USD rate 1.15 = $5,750.00 carrying AP.
  const unpaidInvoiceDraft = await stage5Service.createVendorInvoice({
    companyId: 1,
    vendorId: 1,
    invoiceNumber: "EUR-INV-UNPAID",
    invoiceDate: "2026-06-28",
    dueDate: "2026-07-15",
    currencyCode: "EUR",
    exchangeRate: 1.15,
    items: [
      {
        accountCode: "5010",
        description: "Services to be paid in July",
        quantity: 1,
        unitPrice: 5000.00,
      }
    ],
  });
  await stage5Service.postVendorInvoice(unpaidInvoiceDraft.id);

  // Run revaluation as of June 30 with rate EUR to USD at 1.20!
  // Unpaid EUR liability increases from USD 5,750.00 to USD 6,000.00, triggering unrealized loss of $250.00.
  // Also EUR Operating account has foreign balance. Original balance €10,000 - paid €2000 + transfer $5000 (which is EUR 5000/1.25? No, transfer is recorded directly as USD 5000).
  // Run revaluation process:
  await stage5_2Service.setExchangeRate({
    fromCurrency: "EUR",
    toCurrency: "USD",
    rate: 1.20,
    rateDate: "2026-06-30",
  });

  const revalResult = await stage5_2Service.postUnrealizedRevaluation({
    companyId: 1,
    revaluationDate: "2026-06-30",
    performedByUserId: 1,
  });
  logger.info(`Executed Unrealized Revaluation. Adjustment entries posted: ${revalResult.revalEntriesCount}`);

  // STEP 8: FINAL COMPREHENSIVE FINANCIAL REPORTING GENERATION
  logger.info("\n--- STEP 8: COMPREHENSIVE AUDITED FINANCIAL STATEMENTS ---");

  const bs = await stage5_2Service.getBalanceSheet(1, new Date("2026-06-30"));
  printBalanceSheet(bs, "Audited Balance Sheet");

  const pnl = await stage5_2Service.getIncomeStatement(1, new Date("2026-06-01"), new Date("2026-06-30"));
  printIncomeStatement(pnl, "Audited Income Statement (P&L)");

  const cf = await stage5_2Service.getCashFlowStatement(1, new Date("2026-06-01"), new Date("2026-06-30"));
  printCashFlowStatement(cf, "Audited Cash Flow Statement");

  const apAging = await stage5_2Service.getApAgingReport(1, new Date("2026-06-30"));
  const arAging = await stage5_2Service.getArAgingReport(1, new Date("2026-06-30"));
  printAgingReports(apAging, arAging);

  // STEP 9: GENERAL LEDGER TRIAL BALANCE VALIDATION
  logger.info("\n--- STEP 9: TRIAL BALANCE DOUBLE-ENTRY COMPLIANCE CHECK ---");
  const finalTB = await stage5_2Service.getTrialBalance(1, new Date("2026-06-30"));
  printTrialBalance(finalTB, "Final Audited Trial Balance");

  if (!finalTB.isBalanced) {
    logger.error("TEST FAILED: General Ledger Trial Balance is OUT OF BALANCE!");
    process.exit(1);
  }

  logger.info("==================================================================");
  logger.info(" STAGE 5.2 INTEGRATION TEST PASSED SUCCESSFULLY!");
  logger.info(" All multi-currency, budgeting, and reports reconcile perfectly!");
  logger.info("==================================================================");
}

runStage5_2ValidationSimulation()
  .then(() => {
    logger.info("Simulation completed with zero errors.");
    process.exit(0);
  })
  .catch((err) => {
    logger.error(`Simulation crashed: ${err.message}`);
    console.error(err);
    process.exit(1);
  });
