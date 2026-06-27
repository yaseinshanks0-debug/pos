// src/backend/audit-ap-ar.ts
import { db } from "../db/index.ts";
import { DrizzleUnitOfWork } from "./infrastructure/persistence/unit-of-work.ts";
import { AccountingService } from "./application/services/accounting.service.ts";
import { Stage5Service } from "./application/services/stage5.service.ts";
import { StructuredLogger } from "./infrastructure/logging/logger.ts";
import * as schema from "../db/schema.ts";
import { eq, and, inArray } from "drizzle-orm";

const logger = new StructuredLogger();
const uow = new DrizzleUnitOfWork();

async function runReconciliationAudit() {
  logger.info("\n==================================================================");
  logger.info("AP/AR SUBLEDGER RECONCILIATION AUDIT");
  logger.info("==================================================================");

  const accountingService = new AccountingService(uow, logger);
  const stage5Service = new Stage5Service(uow, logger, accountingService);

  const companyId = 1;

  // 1. Fetch AP Subledger Outstanding Balances
  // Fetch posted/partially paid vendor invoices
  const openVendorInvoices = await db
    .select()
    .from(schema.vendorInvoices)
    .where(
      and(
        eq(schema.vendorInvoices.companyId, companyId),
        inArray(schema.vendorInvoices.status, ["posted", "partially_paid"])
      )
    );

  let totalOpenAP = 0;
  logger.info("\n--- AP SUBLEDGER DETAIL (OPEN VENDOR INVOICES) ---");
  logger.info(` ${"Invoice No".padEnd(20)} | ${"Date".padEnd(12)} | ${"Total ($)".padStart(12)} | ${"Paid ($)".padStart(12)} | ${"Outstanding ($)".padStart(15)}`);
  logger.info("-".repeat(82));
  
  for (const inv of openVendorInvoices) {
    const outstanding = Number(inv.totalAmount) - Number(inv.paidAmount);
    totalOpenAP += outstanding;
    const dateStr = inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().slice(0, 10) : "";
    logger.info(` ${inv.invoiceNumber.padEnd(20)} | ${dateStr.padEnd(12)} | ${Number(inv.totalAmount).toFixed(2).padStart(12)} | ${Number(inv.paidAmount).toFixed(2).padStart(12)} | ${outstanding.toFixed(2).padStart(15)}`);
  }
  logger.info("-".repeat(82));
  logger.info(` ${"TOTAL AP SUBLEDGER OUTSTANDING".padEnd(49)} | ${totalOpenAP.toFixed(2).padStart(15)}`);

  // 2. Fetch GL AP Control Account (2010) Balance
  // Liability accounts are credit-normal: Balance = Credit - Debit
  const apEntries = await db
    .select()
    .from(schema.generalLedgerEntries)
    .where(
      and(
        eq(schema.generalLedgerEntries.companyId, companyId),
        eq(schema.generalLedgerEntries.accountCode, "2010")
      )
    );

  let apGLBalance = 0;
  for (const entry of apEntries) {
    apGLBalance += Number(entry.credit) - Number(entry.debit);
  }

  const apVariance = Math.abs(totalOpenAP - apGLBalance);

  // 3. Fetch AR Subledger Outstanding Balances
  // Fetch posted/partially paid customer invoices
  const openCustomerInvoices = await db
    .select()
    .from(schema.customerInvoices)
    .where(
      and(
        eq(schema.customerInvoices.companyId, companyId),
        inArray(schema.customerInvoices.status, ["posted", "partially_paid"])
      )
    );

  let totalOpenAR = 0;
  logger.info("\n--- AR SUBLEDGER DETAIL (OPEN CUSTOMER INVOICES) ---");
  logger.info(` ${"Invoice No".padEnd(25)} | ${"Date".padEnd(12)} | ${"Total ($)".padStart(12)} | ${"Paid ($)".padStart(12)} | ${"Outstanding ($)".padStart(15)}`);
  logger.info("-".repeat(87));

  for (const inv of openCustomerInvoices) {
    const outstanding = Number(inv.totalAmount) - Number(inv.paidAmount);
    totalOpenAR += outstanding;
    const dateStr = inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().slice(0, 10) : "";
    logger.info(` ${inv.invoiceNumber.padEnd(25)} | ${dateStr.padEnd(12)} | ${Number(inv.totalAmount).toFixed(2).padStart(12)} | ${Number(inv.paidAmount).toFixed(2).padStart(12)} | ${outstanding.toFixed(2).padStart(15)}`);
  }
  logger.info("-".repeat(87));
  logger.info(` ${"TOTAL AR SUBLEDGER OUTSTANDING".padEnd(54)} | ${totalOpenAR.toFixed(2).padStart(15)}`);

  // 4. Fetch GL AR Control Account (1200) Balance
  // Asset accounts are debit-normal: Balance = Debit - Credit
  const arEntries = await db
    .select()
    .from(schema.generalLedgerEntries)
    .where(
      and(
        eq(schema.generalLedgerEntries.companyId, companyId),
        eq(schema.generalLedgerEntries.accountCode, "1200")
      )
    );

  let arGLBalance = 0;
  for (const entry of arEntries) {
    arGLBalance += Number(entry.debit) - Number(entry.credit);
  }

  const arVariance = Math.abs(totalOpenAR - arGLBalance);

  // 5. Output Summary Report
  logger.info("\n==================================================================");
  logger.info(" RECONCILIATION SUMMARY REPORT");
  logger.info("==================================================================");
  logger.info(` ${"Category".padEnd(30)} | ${"Subledger ($)".padStart(15)} | ${"GL Account ($)".padStart(15)} | ${"Variance ($)".padStart(12)}`);
  logger.info("-".repeat(81));
  logger.info(` ${"Accounts Payable (AP - 2010)".padEnd(30)} | ${totalOpenAP.toFixed(2).padStart(15)} | ${apGLBalance.toFixed(2).padStart(15)} | ${apVariance.toFixed(2).padStart(12)}`);
  logger.info(` ${"Accounts Receivable (AR - 1200)".padEnd(30)} | ${totalOpenAR.toFixed(2).padStart(15)} | ${arGLBalance.toFixed(2).padStart(15)} | ${arVariance.toFixed(2).padStart(12)}`);
  logger.info("==================================================================");

  // 6. Variance Analysis & Final Status
  let passed = true;
  if (apVariance > 0.01) {
    logger.warn(`[WARNING] AP Control Account mismatch! Variance: $${apVariance.toFixed(2)}`);
    passed = false;
  }
  if (arVariance > 0.01) {
    logger.warn(`[WARNING] AR Control Account mismatch! Variance: $${arVariance.toFixed(2)}`);
    passed = false;
  }

  logger.info(`\nFINAL AUDIT STATUS: ${passed ? "PASSED" : "FAILED"}`);
  logger.info("==================================================================\n");

  if (!passed) {
    logger.error("Audit failed. Variance detected between Subledger and GL Control Accounts.");
    process.exit(1);
  } else {
    logger.info("Audit passed. Subledger matches GL perfectly with $0.00 variance.");
    process.exit(0);
  }
}

runReconciliationAudit()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    logger.error("Audit script failed with error:");
    logger.error(err.stack || err.message || err);
    process.exit(1);
  });
