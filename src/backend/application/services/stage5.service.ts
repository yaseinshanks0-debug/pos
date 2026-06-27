// src/backend/application/services/stage5.service.ts

import { and, eq, gte, lte, sql, desc } from "drizzle-orm";
import * as schema from "../../../db/schema.ts";
import { IUnitOfWork } from "../ports/unit-of-work.interface.ts";
import { ILogger } from "../ports/logger.interface.ts";
import { AccountingService } from "./accounting.service.ts";
import {
  CreateBankAccountDto,
  CreateVendorInvoiceDto,
  CreateVendorPaymentDto,
  CreateCustomerInvoiceDto,
  CreateCustomerReceiptDto,
  CreateCreditNoteDto,
  ImportBankTransactionsDto,
  MatchBankTransactionDto,
  PostReconciliationAdjustmentDto,
  ReconcileBankAccountDto
} from "../dtos/dtos.ts";
import { Validator } from "../dtos/validation.ts";
import { NotFoundException, BusinessRuleException } from "../../domain/exceptions.ts";

export class Stage5Service {
  constructor(
    private readonly uow: IUnitOfWork,
    private readonly logger: ILogger,
    private readonly accountingService: AccountingService
  ) {}

  // ==========================================
  // BANK ACCOUNTS
  // ==========================================

  public async createBankAccount(dto: CreateBankAccountDto): Promise<any> {
    this.logger.info(`Validating and creating bank account: ${dto.name}`);
    Validator.validateCreateBankAccount(dto);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const bankRepo = txUow.getRepository<any>("bankAccounts", tx);

      // Verify account number is unique
      const existing = await tx
        .select()
        .from(schema.bankAccounts)
        .where(eq(schema.bankAccounts.accountNumber, dto.accountNumber))
        .limit(1);

      if (existing.length > 0) {
        throw new BusinessRuleException(
          "BankAccountExists",
          `Bank account with number ${dto.accountNumber} already exists.`
        );
      }

      const account = await bankRepo.create({
        companyId: dto.companyId,
        name: dto.name,
        accountNumber: dto.accountNumber,
        routingNumber: dto.routingNumber || null,
        bankName: dto.bankName || null,
        currency: dto.currency || "USD",
        ledgerAccountCode: dto.ledgerAccountCode,
        balance: "0.00",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      this.logger.info(`Successfully created bank account ID: ${account.id}`);
      return account;
    });
  }

  public async getBankAccount(id: number): Promise<any> {
    const bankRepo = this.uow.getRepository<any>("bankAccounts");
    const account = await bankRepo.findById(id);
    if (!account) {
      throw new NotFoundException("BankAccount", id);
    }
    return account;
  }

  public async listBankAccounts(companyId: number): Promise<any[]> {
    const bankRepo = this.uow.getRepository<any>("bankAccounts");
    const all = await bankRepo.findAll();
    return all.filter((b: any) => b.companyId === companyId);
  }

  // ==========================================
  // ACCOUNTS PAYABLE (AP)
  // ==========================================

  public async createVendorInvoice(dto: CreateVendorInvoiceDto): Promise<any> {
    this.logger.info(`Validating and creating vendor invoice: ${dto.invoiceNumber}`);
    Validator.validateCreateVendorInvoice(dto);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const invoiceRepo = txUow.getRepository<any>("vendorInvoices", tx);
      const itemRepo = txUow.getRepository<any>("vendorInvoiceItems", tx);

      // Verify vendor exists
      const vendorList = await tx
        .select()
        .from(schema.vendors)
        .where(eq(schema.vendors.id, dto.vendorId))
        .limit(1);

      if (vendorList.length === 0) {
        throw new NotFoundException("Vendor", dto.vendorId);
      }

      // Calculate totals
      let totalAmount = 0;
      let taxAmount = dto.taxAmount ? Number(dto.taxAmount) : 0;

      const preparedItems = dto.items.map((item) => {
        const amount = Number(item.quantity) * Number(item.unitPrice);
        const itemTax = item.taxAmount ? Number(item.taxAmount) : 0;
        totalAmount += amount + itemTax;
        return {
          accountCode: item.accountCode,
          description: item.description || null,
          quantity: String(Number(item.quantity).toFixed(2)),
          unitPrice: String(Number(item.unitPrice).toFixed(2)),
          amount: String(amount.toFixed(2)),
          taxAmount: String(itemTax.toFixed(2)),
        };
      });

      // Check unique invoice number for vendor
      const dupInvoice = await tx
        .select()
        .from(schema.vendorInvoices)
        .where(
          and(
            eq(schema.vendorInvoices.vendorId, dto.vendorId),
            eq(schema.vendorInvoices.invoiceNumber, dto.invoiceNumber)
          )
        )
        .limit(1);

      if (dupInvoice.length > 0) {
        throw new BusinessRuleException(
          "DuplicateVendorInvoice",
          `Invoice ${dto.invoiceNumber} has already been registered for this vendor.`
        );
      }

      const isForeign = dto.currencyCode && dto.currencyCode !== "USD";
      const exchangeRate = dto.exchangeRate || 1.0;
      const currencyAmount = isForeign ? totalAmount : null;
      const baseTotalAmount = isForeign ? (totalAmount * exchangeRate) : totalAmount;
      const baseTaxAmount = isForeign ? (taxAmount * exchangeRate) : taxAmount;

      const invoice = await invoiceRepo.create({
        companyId: dto.companyId,
        vendorId: dto.vendorId,
        invoiceNumber: dto.invoiceNumber,
        invoiceDate: new Date(dto.invoiceDate),
        dueDate: new Date(dto.dueDate),
        totalAmount: String(baseTotalAmount.toFixed(2)),
        taxAmount: String(baseTaxAmount.toFixed(2)),
        paidAmount: "0.00",
        status: "draft",
        apControlAccountCode: dto.apControlAccountCode || "2010",
        currencyCode: dto.currencyCode || "USD",
        exchangeRate: String(exchangeRate.toFixed(6)),
        currencyAmount: currencyAmount ? String(currencyAmount.toFixed(2)) : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      for (const pItem of preparedItems) {
        await itemRepo.create({
          vendorInvoiceId: invoice.id,
          ...pItem,
          createdAt: new Date(),
        });
      }

      this.logger.info(`Vendor Invoice ${invoice.id} created as DRAFT.`);
      return { ...invoice, items: preparedItems };
    });
  }

  public async postVendorInvoice(invoiceId: number): Promise<any> {
    this.logger.info(`Posting vendor invoice ID: ${invoiceId}`);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const invoiceRepo = txUow.getRepository<any>("vendorInvoices", tx);
      const invoice = await invoiceRepo.findById(invoiceId);

      if (!invoice) {
        throw new NotFoundException("VendorInvoice", invoiceId);
      }

      if (invoice.status !== "draft") {
        throw new BusinessRuleException(
          "InvoiceNotDraft",
          `Invoice is already in state: ${invoice.status}`
        );
      }

      // Fetch items to compile posting lines
      const items = await tx
        .select()
        .from(schema.vendorInvoiceItems)
        .where(eq(schema.vendorInvoiceItems.vendorInvoiceId, invoiceId));

      const postingLines = [];
      let calculatedTotal = 0;

      // Group by account code for cleaner postings
      const groupedLines: Record<string, number> = {};
      for (const item of items) {
        const itemAmt = Number(item.amount) + Number(item.taxAmount);
        groupedLines[item.accountCode] = (groupedLines[item.accountCode] || 0) + itemAmt;
        calculatedTotal += itemAmt;
      }

      for (const [acctCode, amt] of Object.entries(groupedLines)) {
        postingLines.push({
          accountCode: acctCode,
          accountType: "expenses" as const, // will fallback to CHART_OF_ACCOUNTS type
          accountName: "Direct Expense Item",
          debit: amt,
          credit: 0,
        });
      }

      // Accounts Payable credit control account line
      postingLines.push({
        accountCode: invoice.apControlAccountCode,
        accountType: "liabilities" as const,
        accountName: "Accounts Payable Control",
        debit: 0,
        credit: calculatedTotal,
      });

      // Post double entry through Central Accounting Service
      // This enforces period locks, and records the journal entries
      await this.accountingService.postJournalEntry(
        {
          companyId: invoice.companyId,
          description: `Vendor Invoice Posting: ${invoice.invoiceNumber}`,
          referenceType: "purchase",
          referenceId: invoice.id,
          createdAt: invoice.invoiceDate,
          lines: postingLines,
        },
        txUow,
        tx
      );

      // Update invoice status to posted
      const updated = await invoiceRepo.update(invoiceId, {
        status: "posted",
        updatedAt: new Date(),
      });

      this.logger.info(`Vendor Invoice ${invoiceId} successfully POSTED to GL.`);
      return updated;
    });
  }

  public async payVendorInvoice(dto: CreateVendorPaymentDto): Promise<any> {
    this.logger.info(`Applying vendor payment of $${dto.amount} on invoice ID: ${dto.vendorInvoiceId || "Unapplied"}`);
    Validator.validateCreateVendorPayment(dto);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const paymentRepo = txUow.getRepository<any>("vendorPayments", tx);
      const invoiceRepo = txUow.getRepository<any>("vendorInvoices", tx);
      const bankRepo = txUow.getRepository<any>("bankAccounts", tx);

      // Verify Bank Account
      const bank = await bankRepo.findById(dto.bankAccountId);
      if (!bank) {
        throw new NotFoundException("BankAccount", dto.bankAccountId);
      }

      let targetInvoice: any = null;
      if (dto.vendorInvoiceId) {
        targetInvoice = await invoiceRepo.findById(dto.vendorInvoiceId);
        if (!targetInvoice) {
          throw new NotFoundException("VendorInvoice", dto.vendorInvoiceId);
        }
        if (targetInvoice.status !== "posted" && targetInvoice.status !== "partially_paid") {
          throw new BusinessRuleException(
            "InvoiceNotOpenForPayment",
            `Vendor invoice status is ${targetInvoice.status}. Only POSTED or PARTIALLY_PAID invoices can be paid.`
          );
        }

        const remainingAmt = Number(targetInvoice.totalAmount) - Number(targetInvoice.paidAmount);
        const isForeign = targetInvoice.currencyCode && targetInvoice.currencyCode !== "USD";
        if (!isForeign && Number(dto.amount) > remainingAmt + 0.01) {
          throw new BusinessRuleException(
            "OverpaymentNotAllowed",
            `Payment amount $${dto.amount} exceeds outstanding invoice balance of $${remainingAmt.toFixed(2)}.`
          );
        }
      }

      const paymentDate = new Date(dto.paymentDate);

      // Post Double-Entry to GL
      // Debit AP Control Account, Credit Cash/Bank Asset Account
      const apAccount = targetInvoice ? targetInvoice.apControlAccountCode : "2010";
      let debitAP = Number(dto.amount);
      let creditBank = Number(dto.amount);
      let amountSettle = Number(dto.amount);
      let fxGainLines: any[] = [];

      if (targetInvoice && targetInvoice.currencyCode && targetInvoice.currencyCode !== "USD") {
        const carryingSettle = Number(targetInvoice.totalAmount) - Number(targetInvoice.paidAmount);
        const diff = Number(dto.amount) - carryingSettle;
        debitAP = carryingSettle;
        amountSettle = carryingSettle;

        if (Math.abs(diff) > 0.005) {
          if (diff > 0) {
            // Realized Loss
            fxGainLines = [
              {
                accountCode: "8010",
                accountType: "expenses",
                accountName: "Realized FX Gain/Loss",
                debit: diff,
                credit: 0,
              }
            ];
          } else {
            // Realized Gain
            fxGainLines = [
              {
                accountCode: "8010",
                accountType: "expenses",
                accountName: "Realized FX Gain/Loss",
                debit: 0,
                credit: Math.abs(diff),
              }
            ];
          }
        }
      }

      await this.accountingService.postJournalEntry(
        {
          companyId: dto.companyId,
          description: dto.notes || `Vendor Payment Ref: ${dto.referenceNumber || "Cheque"}`,
          referenceType: "payment",
          createdAt: paymentDate,
          lines: [
            {
              accountCode: apAccount,
              accountType: "liabilities",
              accountName: "Accounts Payable Control",
              debit: debitAP,
              credit: 0,
            },
            ...fxGainLines,
            {
              accountCode: bank.ledgerAccountCode,
              accountType: "assets",
              accountName: "Bank Account Ledger",
              debit: 0,
              credit: creditBank,
            },
          ],
        },
        txUow,
        tx
      );

      // Create Payment Record
      const payment = await paymentRepo.create({
        companyId: dto.companyId,
        vendorId: dto.vendorId,
        vendorInvoiceId: dto.vendorInvoiceId || null,
        bankAccountId: dto.bankAccountId,
        paymentDate: paymentDate,
        paymentMethod: dto.paymentMethod,
        referenceNumber: dto.referenceNumber || null,
        amount: String(Number(dto.amount).toFixed(2)),
        notes: dto.notes || null,
        createdAt: new Date(),
      });

      // Update Invoice outstanding
      if (targetInvoice) {
        const nextPaid = Number(targetInvoice.paidAmount) + amountSettle;
        const nextStatus =
          Math.abs(nextPaid - Number(targetInvoice.totalAmount)) < 0.01
            ? "paid"
            : "partially_paid";

        await invoiceRepo.update(targetInvoice.id, {
          paidAmount: String(nextPaid.toFixed(2)),
          status: nextStatus,
          updatedAt: new Date(),
        });
      }

      // Update Bank Balance
      const nextBankBalance = Number(bank.balance) - Number(dto.amount);
      await bankRepo.update(bank.id, {
        balance: String(nextBankBalance.toFixed(2)),
        updatedAt: new Date(),
      });

      // Auto-insert a bank statement transaction for matching
      const ledgerRepo = txUow.getRepository<any>("bankTransactions", tx);
      await ledgerRepo.create({
        bankAccountId: bank.id,
        transactionDate: paymentDate,
        description: `Vendor payment to vendor ID ${dto.vendorId} (Ref: ${dto.referenceNumber || "Cheque"})`,
        amount: String((-Number(dto.amount)).toFixed(2)), // negative because it's a withdrawal
        referenceNumber: dto.referenceNumber || null,
        status: "unmatched",
        createdAt: new Date(),
      });

      this.logger.info(`Vendor payment applied successfully. Bank balance updated to: ${nextBankBalance.toFixed(2)}`);
      return payment;
    });
  }

  public async reverseVendorPayment(paymentId: number, reason: string): Promise<any> {
    this.logger.info(`Reversing vendor payment ID: ${paymentId}. Reason: ${reason}`);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const paymentRepo = txUow.getRepository<any>("vendorPayments", tx);
      const invoiceRepo = txUow.getRepository<any>("vendorInvoices", tx);
      const bankRepo = txUow.getRepository<any>("bankAccounts", tx);

      const payment = await paymentRepo.findById(paymentId);
      if (!payment) {
        throw new NotFoundException("VendorPayment", paymentId);
      }

      if (payment.reversalDate) {
        throw new BusinessRuleException("PaymentAlreadyReversed", `Payment ${paymentId} is already reversed.`);
      }

      const bank = await bankRepo.findById(payment.bankAccountId);
      if (!bank) {
        throw new NotFoundException("BankAccount", payment.bankAccountId);
      }

      // Reverse Journal Entries
      // Debit Cash/Bank Asset Account, Credit AP Control Account
      const invoice = payment.vendorInvoiceId
        ? await invoiceRepo.findById(payment.vendorInvoiceId)
        : null;
      const apAccount = invoice ? invoice.apControlAccountCode : "2010";

      await this.accountingService.postJournalEntry(
        {
          companyId: payment.companyId,
          description: `REVERSAL of Vendor Payment ${paymentId}. Reason: ${reason}`,
          referenceType: "payment_reversal",
          createdAt: new Date(),
          lines: [
            {
              accountCode: bank.ledgerAccountCode,
              accountType: "assets",
              accountName: "Bank Account Ledger",
              debit: Number(payment.amount),
              credit: 0,
            },
            {
              accountCode: apAccount,
              accountType: "liabilities",
              accountName: "Accounts Payable Control",
              debit: 0,
              credit: Number(payment.amount),
            },
          ],
        },
        txUow,
        tx
      );

      // Update Payment Record
      const updatedPayment = await paymentRepo.update(paymentId, {
        reversalDate: new Date(),
        reversalReason: reason,
      });

      // Adjust Invoice Balance
      if (invoice) {
        const nextPaid = Math.max(0, Number(invoice.paidAmount) - Number(payment.amount));
        const nextStatus = nextPaid === 0 ? "posted" : "partially_paid";
        await invoiceRepo.update(invoice.id, {
          paidAmount: String(nextPaid.toFixed(2)),
          status: nextStatus,
          updatedAt: new Date(),
        });
      }

      // Adjust Bank Balance
      const nextBankBalance = Number(bank.balance) + Number(payment.amount);
      await bankRepo.update(bank.id, {
        balance: String(nextBankBalance.toFixed(2)),
        updatedAt: new Date(),
      });

      // Insert matching positive correction transaction
      const btRepo = txUow.getRepository<any>("bankTransactions", tx);
      await btRepo.create({
        bankAccountId: bank.id,
        transactionDate: new Date(),
        description: `REVERSAL Vendor payment ID ${paymentId}`,
        amount: String(Number(payment.amount).toFixed(2)), // positive because it's adding money back
        referenceNumber: payment.referenceNumber || null,
        status: "unmatched",
        createdAt: new Date(),
      });

      this.logger.info(`Vendor payment ${paymentId} successfully reversed.`);
      return updatedPayment;
    });
  }

  public async getVendorAging(companyId: number): Promise<any[]> {
    this.logger.info(`Generating accounts payable vendor aging report for company: ${companyId}`);

    const invoices = await this.uow.getRepository<any>("vendorInvoices").findAll();
    const vendors = await this.uow.getRepository<any>("vendors").findAll();

    const openInvoices = invoices.filter(
      (inv: any) =>
        inv.companyId === companyId &&
        ["posted", "partially_paid"].includes(inv.status)
    );

    const now = new Date();

    const report = vendors
      .filter((v: any) => v.companyId === companyId)
      .map((vendor: any) => {
        const vendorInvs = openInvoices.filter((inv: any) => inv.vendorId === vendor.id);

        let current = 0;
        let p30 = 0;
        let p60 = 0;
        let p90 = 0;
        let total = 0;

        vendorInvs.forEach((inv: any) => {
          const outstanding = Number(inv.totalAmount) - Number(inv.paidAmount);
          const diffTime = Math.abs(now.getTime() - new Date(inv.invoiceDate).getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          total += outstanding;
          if (diffDays <= 30) {
            current += outstanding;
          } else if (diffDays <= 60) {
            p30 += outstanding;
          } else if (diffDays <= 90) {
            p60 += outstanding;
          } else {
            p90 += outstanding;
          }
        });

        return {
          vendorId: vendor.id,
          vendorName: vendor.name,
          current: Number(current.toFixed(2)),
          aging31To60: Number(p30.toFixed(2)),
          aging61To90: Number(p60.toFixed(2)),
          agingOver90: Number(p90.toFixed(2)),
          totalOutstanding: Number(total.toFixed(2)),
        };
      });

    return report;
  }

  // ==========================================
  // ACCOUNTS RECEIVABLE (AR) & CREDIT CONTROL
  // ==========================================

  public async createCustomerInvoice(dto: CreateCustomerInvoiceDto): Promise<any> {
    this.logger.info(`Validating and creating customer invoice: ${dto.invoiceNumber}`);
    Validator.validateCreateCustomerInvoice(dto);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const invoiceRepo = txUow.getRepository<any>("customerInvoices", tx);
      const itemRepo = txUow.getRepository<any>("customerInvoiceItems", tx);

      // Verify customer exists
      const customerList = await tx
        .select()
        .from(schema.customers)
        .where(eq(schema.customers.id, dto.customerId))
        .limit(1);

      if (customerList.length === 0) {
        throw new NotFoundException("Customer", dto.customerId);
      }

      // Calculate totals
      let totalAmount = 0;
      let taxAmount = dto.taxAmount ? Number(dto.taxAmount) : 0;

      const preparedItems = dto.items.map((item) => {
        const amount = Number(item.quantity) * Number(item.unitPrice);
        const itemTax = item.taxAmount ? Number(item.taxAmount) : 0;
        totalAmount += amount + itemTax;
        return {
          accountCode: item.accountCode,
          description: item.description || null,
          quantity: String(Number(item.quantity).toFixed(2)),
          unitPrice: String(Number(item.unitPrice).toFixed(2)),
          amount: String(amount.toFixed(2)),
          taxAmount: String(itemTax.toFixed(2)),
        };
      });

      // Check unique invoice number
      const dupInvoice = await tx
        .select()
        .from(schema.customerInvoices)
        .where(eq(schema.customerInvoices.invoiceNumber, dto.invoiceNumber))
        .limit(1);

      if (dupInvoice.length > 0) {
        throw new BusinessRuleException(
          "DuplicateCustomerInvoice",
          `Invoice ${dto.invoiceNumber} has already been registered.`
        );
      }

      const isForeign = dto.currencyCode && dto.currencyCode !== "USD";
      const exchangeRate = dto.exchangeRate || 1.0;
      const currencyAmount = isForeign ? totalAmount : null;
      const baseTotalAmount = isForeign ? (totalAmount * exchangeRate) : totalAmount;
      const baseTaxAmount = isForeign ? (taxAmount * exchangeRate) : taxAmount;

      const invoice = await invoiceRepo.create({
        companyId: dto.companyId,
        customerId: dto.customerId,
        invoiceNumber: dto.invoiceNumber,
        invoiceDate: new Date(dto.invoiceDate),
        dueDate: new Date(dto.dueDate),
        totalAmount: String(baseTotalAmount.toFixed(2)),
        taxAmount: String(baseTaxAmount.toFixed(2)),
        paidAmount: "0.00",
        status: "draft",
        arControlAccountCode: dto.arControlAccountCode || "1200",
        currencyCode: dto.currencyCode || "USD",
        exchangeRate: String(exchangeRate.toFixed(6)),
        currencyAmount: currencyAmount ? String(currencyAmount.toFixed(2)) : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      for (const pItem of preparedItems) {
        await itemRepo.create({
          customerInvoiceId: invoice.id,
          ...pItem,
          createdAt: new Date(),
        });
      }

      this.logger.info(`Customer Invoice ${invoice.id} created as DRAFT.`);
      return { ...invoice, items: preparedItems };
    });
  }

  public async postCustomerInvoice(invoiceId: number): Promise<any> {
    this.logger.info(`Posting customer invoice ID: ${invoiceId}`);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const invoiceRepo = txUow.getRepository<any>("customerInvoices", tx);
      const customerRepo = txUow.getRepository<any>("customers", tx);

      const invoice = await invoiceRepo.findById(invoiceId);
      if (!invoice) {
        throw new NotFoundException("CustomerInvoice", invoiceId);
      }

      if (invoice.status !== "draft") {
        throw new BusinessRuleException(
          "InvoiceNotDraft",
          `Invoice is already in state: ${invoice.status}`
        );
      }

      const customer = await customerRepo.findById(invoice.customerId);
      if (!customer) {
        throw new NotFoundException("Customer", invoice.customerId);
      }

      // --- CREDIT CONTROL ENFORCEMENT ---
      if (customer.creditHold) {
        throw new BusinessRuleException(
          "CreditHoldEnforced",
          `Cannot post invoice: Customer '${customer.name}' is on strict CREDIT HOLD.`
        );
      }

      const outstandingBalance = Number(customer.balance);
      const invoiceAmt = Number(invoice.totalAmount);
      const credLimit = Number(customer.creditLimit);

      if (credLimit > 0 && outstandingBalance + invoiceAmt > credLimit) {
        throw new BusinessRuleException(
          "CreditLimitExceeded",
          `Posting of $${invoiceAmt.toFixed(2)} exceeds customer's credit limit of $${credLimit.toFixed(2)} (Outstanding: $${outstandingBalance.toFixed(2)}).`
        );
      }

      // Fetch items to compile posting lines
      const items = await tx
        .select()
        .from(schema.customerInvoiceItems)
        .where(eq(schema.customerInvoiceItems.customerInvoiceId, invoiceId));

      const postingLines = [];
      let calculatedTotal = 0;

      // Group by account code for cleaner postings
      const groupedLines: Record<string, number> = {};
      for (const item of items) {
        const itemAmt = Number(item.amount) + Number(item.taxAmount);
        groupedLines[item.accountCode] = (groupedLines[item.accountCode] || 0) + itemAmt;
        calculatedTotal += itemAmt;
      }

      // Accounts Receivable debit control account line
      postingLines.push({
        accountCode: invoice.arControlAccountCode,
        accountType: "assets" as const,
        accountName: "Accounts Receivable Control",
        debit: calculatedTotal,
        credit: 0,
      });

      for (const [acctCode, amt] of Object.entries(groupedLines)) {
        postingLines.push({
          accountCode: acctCode,
          accountType: "revenue" as const, // will fallback to CHART_OF_ACCOUNTS type
          accountName: "Direct Revenue Item",
          debit: 0,
          credit: amt,
        });
      }

      // Post double entry through Central Accounting Service
      // This enforces period locks, and records the journal entries
      await this.accountingService.postJournalEntry(
        {
          companyId: invoice.companyId,
          description: `Customer Invoice Posting: ${invoice.invoiceNumber}`,
          referenceType: "sales",
          referenceId: invoice.id,
          createdAt: invoice.invoiceDate,
          lines: postingLines,
        },
        txUow,
        tx
      );

      // Update invoice status to posted
      const updated = await invoiceRepo.update(invoiceId, {
        status: "posted",
        updatedAt: new Date(),
      });

      // Update customer balance (A/R Outstanding increases)
      const nextCustBalance = outstandingBalance + invoiceAmt;
      await customerRepo.update(customer.id, {
        balance: String(nextCustBalance.toFixed(2)),
        updatedAt: new Date(),
      });

      this.logger.info(`Customer Invoice ${invoiceId} successfully POSTED to GL. Customer balance updated to: $${nextCustBalance.toFixed(2)}`);
      return updated;
    });
  }

  public async receiveCustomerPayment(dto: CreateCustomerReceiptDto): Promise<any> {
    this.logger.info(`Applying customer payment of $${dto.amount} from customer ID: ${dto.customerId}`);
    Validator.validateCreateCustomerReceipt(dto);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const receiptRepo = txUow.getRepository<any>("customerReceipts", tx);
      const invoiceRepo = txUow.getRepository<any>("customerInvoices", tx);
      const customerRepo = txUow.getRepository<any>("customers", tx);
      const bankRepo = txUow.getRepository<any>("bankAccounts", tx);

      // Verify Bank Account
      const bank = await bankRepo.findById(dto.bankAccountId);
      if (!bank) {
        throw new NotFoundException("BankAccount", dto.bankAccountId);
      }

      const customer = await customerRepo.findById(dto.customerId);
      if (!customer) {
        throw new NotFoundException("Customer", dto.customerId);
      }

      let targetInvoice: any = null;
      if (dto.customerInvoiceId) {
        targetInvoice = await invoiceRepo.findById(dto.customerInvoiceId);
        if (!targetInvoice) {
          throw new NotFoundException("CustomerInvoice", dto.customerInvoiceId);
        }
        if (targetInvoice.status !== "posted" && targetInvoice.status !== "partially_paid") {
          throw new BusinessRuleException(
            "InvoiceNotOpenForPayment",
            `Customer invoice status is ${targetInvoice.status}. Only POSTED or PARTIALLY_PAID invoices can receive payment.`
          );
        }

        const remainingAmt = Number(targetInvoice.totalAmount) - Number(targetInvoice.paidAmount);
        const isForeign = targetInvoice.currencyCode && targetInvoice.currencyCode !== "USD";
        if (!isForeign && Number(dto.amount) > remainingAmt + 0.01) {
          throw new BusinessRuleException(
            "OverpaymentNotAllowed",
            `Receipt amount $${dto.amount} exceeds outstanding invoice balance of $${remainingAmt.toFixed(2)}.`
          );
        }
      }

      const receiptDate = new Date(dto.receiptDate);

      // Post Double-Entry to GL
      // Debit Cash/Bank Asset Account, Credit AR Control Account
      const arAccount = targetInvoice ? targetInvoice.arControlAccountCode : "1200";
      let debitBank = Number(dto.amount);
      let creditAR = Number(dto.amount);
      let amountSettle = Number(dto.amount);
      let fxGainLines: any[] = [];

      if (targetInvoice && targetInvoice.currencyCode && targetInvoice.currencyCode !== "USD") {
        const carryingSettle = Number(targetInvoice.totalAmount) - Number(targetInvoice.paidAmount);
        const diff = Number(dto.amount) - carryingSettle;
        creditAR = carryingSettle;
        amountSettle = carryingSettle;

        if (Math.abs(diff) > 0.005) {
          if (diff > 0) {
            // Realized Gain (received more base than carrying value)
            fxGainLines = [
              {
                accountCode: "8010",
                accountType: "expenses",
                accountName: "Realized FX Gain/Loss",
                debit: 0,
                credit: diff,
              }
            ];
          } else {
            // Realized Loss (received less base than carrying value)
            fxGainLines = [
              {
                accountCode: "8010",
                accountType: "expenses",
                accountName: "Realized FX Gain/Loss",
                debit: Math.abs(diff),
                credit: 0,
              }
            ];
          }
        }
      }

      await this.accountingService.postJournalEntry(
        {
          companyId: dto.companyId,
          description: dto.notes || `Customer Receipt Ref: ${dto.referenceNumber || "Direct"}`,
          referenceType: "receipt",
          createdAt: receiptDate,
          lines: [
            {
              accountCode: bank.ledgerAccountCode,
              accountType: "assets",
              accountName: "Bank Account Ledger",
              debit: debitBank,
              credit: 0,
            },
            ...fxGainLines,
            {
              accountCode: arAccount,
              accountType: "assets",
              accountName: "Accounts Receivable Control",
              debit: 0,
              credit: creditAR,
            },
          ],
        },
        txUow,
        tx
      );

      // Create Receipt Record
      const receipt = await receiptRepo.create({
        companyId: dto.companyId,
        customerId: dto.customerId,
        customerInvoiceId: dto.customerInvoiceId || null,
        bankAccountId: dto.bankAccountId,
        receiptDate: receiptDate,
        paymentMethod: dto.paymentMethod,
        referenceNumber: dto.referenceNumber || null,
        amount: String(Number(dto.amount).toFixed(2)),
        notes: dto.notes || null,
        createdAt: new Date(),
      });

      // Update Invoice outstanding
      if (targetInvoice) {
        const nextPaid = Number(targetInvoice.paidAmount) + amountSettle;
        const nextStatus =
          Math.abs(nextPaid - Number(targetInvoice.totalAmount)) < 0.01
            ? "paid"
            : "partially_paid";

        await invoiceRepo.update(targetInvoice.id, {
          paidAmount: String(nextPaid.toFixed(2)),
          status: nextStatus,
          updatedAt: new Date(),
        });
      }

      // Update Customer outstanding balance (Accounts Receivable decreases)
      const nextCustBalance = Math.max(0, Number(customer.balance) - Number(dto.amount));
      await customerRepo.update(customer.id, {
        balance: String(nextCustBalance.toFixed(2)),
        updatedAt: new Date(),
      });

      // Update Bank Balance
      const nextBankBalance = Number(bank.balance) + Number(dto.amount);
      await bankRepo.update(bank.id, {
        balance: String(nextBankBalance.toFixed(2)),
        updatedAt: new Date(),
      });

      // Auto-insert a bank statement transaction for matching
      const btRepo = txUow.getRepository<any>("bankTransactions", tx);
      await btRepo.create({
        bankAccountId: bank.id,
        transactionDate: receiptDate,
        description: `Customer receipt from customer ID ${dto.customerId} (Ref: ${dto.referenceNumber || "Direct"})`,
        amount: String(Number(dto.amount).toFixed(2)), // positive because it's a deposit
        referenceNumber: dto.referenceNumber || null,
        status: "unmatched",
        createdAt: new Date(),
      });

      this.logger.info(`Customer payment received and allocated. Customer outstanding balance: $${nextCustBalance.toFixed(2)}. Bank balance: $${nextBankBalance.toFixed(2)}`);
      return receipt;
    });
  }

  public async reverseCustomerReceipt(receiptId: number, reason: string): Promise<any> {
    this.logger.info(`Reversing customer receipt ID: ${receiptId}. Reason: ${reason}`);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const receiptRepo = txUow.getRepository<any>("customerReceipts", tx);
      const invoiceRepo = txUow.getRepository<any>("customerInvoices", tx);
      const customerRepo = txUow.getRepository<any>("customers", tx);
      const bankRepo = txUow.getRepository<any>("bankAccounts", tx);

      const receipt = await receiptRepo.findById(receiptId);
      if (!receipt) {
        throw new NotFoundException("CustomerReceipt", receiptId);
      }

      if (receipt.reversalDate) {
        throw new BusinessRuleException("ReceiptAlreadyReversed", `Receipt ${receiptId} is already reversed.`);
      }

      const bank = await bankRepo.findById(receipt.bankAccountId);
      if (!bank) {
        throw new NotFoundException("BankAccount", receipt.bankAccountId);
      }

      const customer = await customerRepo.findById(receipt.customerId);
      if (!customer) {
        throw new NotFoundException("Customer", receipt.customerId);
      }

      // Reverse Journal Entries
      // Debit AR Control Account, Credit Cash/Bank Asset Account
      const invoice = receipt.customerInvoiceId
        ? await invoiceRepo.findById(receipt.customerInvoiceId)
        : null;
      const arAccount = invoice ? invoice.arControlAccountCode : "1200";

      await this.accountingService.postJournalEntry(
        {
          companyId: receipt.companyId,
          description: `REVERSAL of Customer Receipt ${receiptId}. Reason: ${reason}`,
          referenceType: "receipt_reversal",
          createdAt: new Date(),
          lines: [
            {
              accountCode: arAccount,
              accountType: "assets",
              accountName: "Accounts Receivable Control",
              debit: Number(receipt.amount),
              credit: 0,
            },
            {
              accountCode: bank.ledgerAccountCode,
              accountType: "assets",
              accountName: "Bank Account Ledger",
              debit: 0,
              credit: Number(receipt.amount),
            },
          ],
        },
        txUow,
        tx
      );

      // Update Receipt Record
      const updatedReceipt = await receiptRepo.update(receiptId, {
        reversalDate: new Date(),
        reversalReason: reason,
      });

      // Adjust Invoice Balance
      if (invoice) {
        const nextPaid = Math.max(0, Number(invoice.paidAmount) - Number(receipt.amount));
        const nextStatus = nextPaid === 0 ? "posted" : "partially_paid";
        await invoiceRepo.update(invoice.id, {
          paidAmount: String(nextPaid.toFixed(2)),
          status: nextStatus,
          updatedAt: new Date(),
        });
      }

      // Adjust Customer Balance (Accounts Receivable increases)
      const nextCustBalance = Number(customer.balance) + Number(receipt.amount);
      await customerRepo.update(customer.id, {
        balance: String(nextCustBalance.toFixed(2)),
        updatedAt: new Date(),
      });

      // Adjust Bank Balance
      const nextBankBalance = Number(bank.balance) - Number(receipt.amount);
      await bankRepo.update(bank.id, {
        balance: String(nextBankBalance.toFixed(2)),
        updatedAt: new Date(),
      });

      // Insert matching negative correction bank transaction
      const btRepo = txUow.getRepository<any>("bankTransactions", tx);
      await btRepo.create({
        bankAccountId: bank.id,
        transactionDate: new Date(),
        description: `REVERSAL Customer receipt ID ${receiptId}`,
        amount: String((-Number(receipt.amount)).toFixed(2)), // negative because it's a withdrawal
        referenceNumber: receipt.referenceNumber || null,
        status: "unmatched",
        createdAt: new Date(),
      });

      this.logger.info(`Customer receipt ${receiptId} successfully reversed.`);
      return updatedReceipt;
    });
  }

  public async getCustomerAging(companyId: number): Promise<any[]> {
    this.logger.info(`Generating accounts receivable customer aging report for company: ${companyId}`);

    const invoices = await this.uow.getRepository<any>("customerInvoices").findAll();
    const customers = await this.uow.getRepository<any>("customers").findAll();

    const openInvoices = invoices.filter(
      (inv: any) =>
        inv.companyId === companyId &&
        ["posted", "partially_paid"].includes(inv.status)
    );

    const now = new Date();

    const report = customers
      .map((customer: any) => {
        const custInvs = openInvoices.filter((inv: any) => inv.customerId === customer.id);

        let current = 0;
        let p30 = 0;
        let p60 = 0;
        let p90 = 0;
        let total = 0;

        custInvs.forEach((inv: any) => {
          const outstanding = Number(inv.totalAmount) - Number(inv.paidAmount);
          const diffTime = Math.abs(now.getTime() - new Date(inv.invoiceDate).getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          total += outstanding;
          if (diffDays <= 30) {
            current += outstanding;
          } else if (diffDays <= 60) {
            p30 += outstanding;
          } else if (diffDays <= 90) {
            p60 += outstanding;
          } else {
            p90 += outstanding;
          }
        });

        return {
          customerId: customer.id,
          customerName: customer.name,
          current: Number(current.toFixed(2)),
          aging31To60: Number(p30.toFixed(2)),
          aging61To90: Number(p60.toFixed(2)),
          agingOver90: Number(p90.toFixed(2)),
          totalOutstanding: Number(total.toFixed(2)),
        };
      });

    return report;
  }

  // ==========================================
  // CREDIT NOTES
  // ==========================================

  public async createCreditNote(dto: CreateCreditNoteDto): Promise<any> {
    this.logger.info(`Validating and creating credit note: ${dto.creditNoteNumber}`);
    Validator.validateCreateCreditNote(dto);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const cnRepo = txUow.getRepository<any>("creditNotes", tx);

      // Verify unique credit note number
      const existing = await tx
        .select()
        .from(schema.creditNotes)
        .where(eq(schema.creditNotes.creditNoteNumber, dto.creditNoteNumber))
        .limit(1);

      if (existing.length > 0) {
        throw new BusinessRuleException(
          "CreditNoteExists",
          `Credit note with number ${dto.creditNoteNumber} already exists.`
        );
      }

      const creditNote = await cnRepo.create({
        companyId: dto.companyId,
        type: dto.type,
        entityId: dto.entityId,
        referenceInvoiceId: dto.referenceInvoiceId || null,
        creditNoteNumber: dto.creditNoteNumber,
        creditNoteDate: new Date(dto.creditNoteDate),
        amount: String(Number(dto.amount).toFixed(2)),
        remainingAmount: String(Number(dto.amount).toFixed(2)),
        status: "draft",
        notes: dto.notes || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      this.logger.info(`Successfully created credit note ID: ${creditNote.id}`);
      return creditNote;
    });
  }

  public async postCreditNote(creditNoteId: number): Promise<any> {
    this.logger.info(`Posting credit note ID: ${creditNoteId}`);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const cnRepo = txUow.getRepository<any>("creditNotes", tx);
      const creditNote = await cnRepo.findById(creditNoteId);

      if (!creditNote) {
        throw new NotFoundException("CreditNote", creditNoteId);
      }

      if (creditNote.status !== "draft") {
        throw new BusinessRuleException("CreditNoteNotDraft", `Credit note is already in state: ${creditNote.status}`);
      }

      // Post Double-Entry to GL
      if (creditNote.type === "customer") {
        const customerRepo = txUow.getRepository<any>("customers", tx);
        const customer = await customerRepo.findById(creditNote.entityId);
        if (!customer) throw new NotFoundException("Customer", creditNote.entityId);

        // Customer credit note
        // Debit: Sales Returns & Refunds (4020)
        // Credit: Accounts Receivable Control (1200)
        await this.accountingService.postJournalEntry(
          {
            companyId: creditNote.companyId,
            description: `Customer Credit Note: ${creditNote.creditNoteNumber}`,
            referenceType: "sales_return",
            referenceId: creditNote.id,
            createdAt: creditNote.creditNoteDate,
            lines: [
              {
                accountCode: "4020",
                accountType: "revenue", // Contra-revenue
                accountName: "Sales Returns & Refunds",
                debit: Number(creditNote.amount),
                credit: 0,
              },
              {
                accountCode: "1200",
                accountType: "assets",
                accountName: "Accounts Receivable Control",
                debit: 0,
                credit: Number(creditNote.amount),
              },
            ],
          },
          txUow,
          tx
        );

        // Decrease customer balance
        const nextCustBalance = Math.max(0, Number(customer.balance) - Number(creditNote.amount));
        await customerRepo.update(customer.id, {
          balance: String(nextCustBalance.toFixed(2)),
          updatedAt: new Date(),
        });
      } else {
        // Vendor credit note
        // Debit: Accounts Payable Control (2010)
        // Credit: Expense/Cost account (usually 5010 or specific expense)
        await this.accountingService.postJournalEntry(
          {
            companyId: creditNote.companyId,
            description: `Vendor Credit Note: ${creditNote.creditNoteNumber}`,
            referenceType: "purchase_return",
            referenceId: creditNote.id,
            createdAt: creditNote.creditNoteDate,
            lines: [
              {
                accountCode: "2010",
                accountType: "liabilities",
                accountName: "Accounts Payable Control",
                debit: Number(creditNote.amount),
                credit: 0,
              },
              {
                accountCode: "5010",
                accountType: "expenses",
                accountName: "Cost of Goods Sold (COGS)",
                debit: 0,
                credit: Number(creditNote.amount),
              },
            ],
          },
          txUow,
          tx
        );
      }

      const updated = await cnRepo.update(creditNoteId, {
        status: "posted",
        updatedAt: new Date(),
      });

      this.logger.info(`Credit note ${creditNoteId} posted successfully.`);
      return updated;
    });
  }

  public async applyCreditNote(creditNoteId: number, invoiceId: number): Promise<any> {
    this.logger.info(`Applying credit note ID: ${creditNoteId} to invoice ID: ${invoiceId}`);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const cnRepo = txUow.getRepository<any>("creditNotes", tx);
      const creditNote = await cnRepo.findById(creditNoteId);

      if (!creditNote) {
        throw new NotFoundException("CreditNote", creditNoteId);
      }

      if (creditNote.status !== "posted") {
        throw new BusinessRuleException("CreditNoteNotPosted", "Only posted credit notes can be applied.");
      }

      const remainingCN = Number(creditNote.remainingAmount);
      if (remainingCN <= 0) {
        throw new BusinessRuleException("CreditNoteExhausted", "This credit note has already been fully applied.");
      }

      if (creditNote.type === "customer") {
        const invoiceRepo = txUow.getRepository<any>("customerInvoices", tx);
        const invoice = await invoiceRepo.findById(invoiceId);

        if (!invoice) throw new NotFoundException("CustomerInvoice", invoiceId);
        if (invoice.status !== "posted" && invoice.status !== "partially_paid") {
          throw new BusinessRuleException("InvoiceNotOpen", "Invoice is already paid or draft.");
        }

        const remainingInv = Number(invoice.totalAmount) - Number(invoice.paidAmount);
        const applyAmt = Math.min(remainingCN, remainingInv);

        // Apply
        const nextCNRemaining = remainingCN - applyAmt;
        const nextInvPaid = Number(invoice.paidAmount) + applyAmt;

        const nextCNStatus = nextCNRemaining < 0.01 ? "applied" : "posted";
        const nextInvStatus = Math.abs(nextInvPaid - Number(invoice.totalAmount)) < 0.01 ? "paid" : "partially_paid";

        await cnRepo.update(creditNoteId, {
          remainingAmount: String(nextCNRemaining.toFixed(2)),
          status: nextCNStatus,
          updatedAt: new Date(),
        });

        await invoiceRepo.update(invoiceId, {
          paidAmount: String(nextInvPaid.toFixed(2)),
          status: nextInvStatus,
          updatedAt: new Date(),
        });

        this.logger.info(`Applied $${applyAmt.toFixed(2)} from Credit Note to Customer Invoice ${invoiceId}`);
      } else {
        const invoiceRepo = txUow.getRepository<any>("vendorInvoices", tx);
        const invoice = await invoiceRepo.findById(invoiceId);

        if (!invoice) throw new NotFoundException("VendorInvoice", invoiceId);
        if (invoice.status !== "posted" && invoice.status !== "partially_paid") {
          throw new BusinessRuleException("InvoiceNotOpen", "Invoice is already paid or draft.");
        }

        const remainingInv = Number(invoice.totalAmount) - Number(invoice.paidAmount);
        const applyAmt = Math.min(remainingCN, remainingInv);

        // Apply
        const nextCNRemaining = remainingCN - applyAmt;
        const nextInvPaid = Number(invoice.paidAmount) + applyAmt;

        const nextCNStatus = nextCNRemaining < 0.01 ? "applied" : "posted";
        const nextInvStatus = Math.abs(nextInvPaid - Number(invoice.totalAmount)) < 0.01 ? "paid" : "partially_paid";

        await cnRepo.update(creditNoteId, {
          remainingAmount: String(nextCNRemaining.toFixed(2)),
          status: nextCNStatus,
          updatedAt: new Date(),
        });

        await invoiceRepo.update(invoiceId, {
          paidAmount: String(nextInvPaid.toFixed(2)),
          status: nextInvStatus,
          updatedAt: new Date(),
        });

        this.logger.info(`Applied $${applyAmt.toFixed(2)} from Credit Note to Vendor Invoice ${invoiceId}`);
      }

      return cnRepo.findById(creditNoteId);
    });
  }

  // ==========================================
  // BANK STATEMENT IMPORT & RECONCILIATION
  // ==========================================

  public async importBankTransactions(dto: ImportBankTransactionsDto): Promise<any[]> {
    this.logger.info(`Importing ${dto.transactions.length} bank transactions for account ID: ${dto.bankAccountId}`);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const bankRepo = txUow.getRepository<any>("bankAccounts", tx);
      const btRepo = txUow.getRepository<any>("bankTransactions", tx);

      const bank = await bankRepo.findById(dto.bankAccountId);
      if (!bank) {
        throw new NotFoundException("BankAccount", dto.bankAccountId);
      }

      const imported = [];
      for (const t of dto.transactions) {
        const rec = await btRepo.create({
          bankAccountId: dto.bankAccountId,
          transactionDate: new Date(t.transactionDate),
          description: t.description,
          amount: String(Number(t.amount).toFixed(2)),
          referenceNumber: t.referenceNumber || null,
          status: "unmatched",
          createdAt: new Date(),
        });
        imported.push(rec);
      }

      this.logger.info(`Successfully imported ${imported.length} bank transactions.`);
      return imported;
    });
  }

  public async matchBankTransaction(dto: MatchBankTransactionDto): Promise<any> {
    this.logger.info(`Matching bank transaction ID: ${dto.bankTransactionId} to type: ${dto.matchedType} ID: ${dto.matchedReferenceId}`);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const btRepo = txUow.getRepository<any>("bankTransactions", tx);
      const bt = await btRepo.findById(dto.bankTransactionId);

      if (!bt) {
        throw new NotFoundException("BankTransaction", dto.bankTransactionId);
      }

      if (bt.status !== "unmatched") {
        throw new BusinessRuleException("BankTransactionAlreadyMatched", `Transaction ${dto.bankTransactionId} is already: ${bt.status}`);
      }

      // Verify reference exists
      if (dto.matchedType === "payment") {
        const pay = await txUow.getRepository<any>("vendorPayments", tx).findById(dto.matchedReferenceId);
        if (!pay) throw new NotFoundException("VendorPayment", dto.matchedReferenceId);
      } else if (dto.matchedType === "receipt") {
        const rec = await txUow.getRepository<any>("customerReceipts", tx).findById(dto.matchedReferenceId);
        if (!rec) throw new NotFoundException("CustomerReceipt", dto.matchedReferenceId);
      }

      const updated = await btRepo.update(dto.bankTransactionId, {
        status: "matched",
        matchedType: dto.matchedType,
        matchedReferenceId: dto.matchedReferenceId,
      });

      this.logger.info(`Bank transaction ${dto.bankTransactionId} matched successfully.`);
      return updated;
    });
  }

  public async postReconciliationAdjustment(dto: PostReconciliationAdjustmentDto): Promise<any> {
    this.logger.info(`Posting reconciliation adjustment for bank transaction ID: ${dto.bankTransactionId}`);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const btRepo = txUow.getRepository<any>("bankTransactions", tx);
      const bankRepo = txUow.getRepository<any>("bankAccounts", tx);

      const bt = await btRepo.findById(dto.bankTransactionId);
      if (!bt) {
        throw new NotFoundException("BankTransaction", dto.bankTransactionId);
      }

      if (bt.status !== "unmatched") {
        throw new BusinessRuleException("BankTransactionAlreadyMatched", "Cannot post adjustment for a matched transaction.");
      }

      const bank = await bankRepo.findById(bt.bankAccountId);
      if (!bank) {
        throw new NotFoundException("BankAccount", bt.bankAccountId);
      }

      const amt = Number(bt.amount);

      // Post Double entry to GL
      // If negative (withdrawal/charge): Debit Expense/Charge, Credit Bank Account
      // If positive (deposit/interest): Debit Bank Account, Credit Interest Revenue
      const lines = [];
      if (amt < 0) {
        lines.push({
          accountCode: dto.ledgerAccountCode,
          accountType: "expenses" as const,
          accountName: "Bank Charges / Adjustment Expense",
          debit: Math.abs(amt),
          credit: 0,
        });
        lines.push({
          accountCode: bank.ledgerAccountCode,
          accountType: "assets" as const,
          accountName: "Bank Account Ledger",
          debit: 0,
          credit: Math.abs(amt),
        });
      } else {
        lines.push({
          accountCode: bank.ledgerAccountCode,
          accountType: "assets" as const,
          accountName: "Bank Account Ledger",
          debit: amt,
          credit: 0,
        });
        lines.push({
          accountCode: dto.ledgerAccountCode,
          accountType: "revenue" as const,
          accountName: "Bank Interest / Adjustment Revenue",
          debit: 0,
          credit: amt,
        });
      }

      await this.accountingService.postJournalEntry(
        {
          companyId: dto.companyId,
          description: `Bank Reconciliation Adjustment: ${dto.reason}`,
          referenceType: "adjustment",
          createdAt: bt.transactionDate,
          lines,
        },
        txUow,
        tx
      );

      // Update Bank Transaction Status
      const updatedBt = await btRepo.update(dto.bankTransactionId, {
        status: "adjustments_posted",
        matchedType: amt < 0 ? "charge" : "interest",
      });

      // Update bank balance
      const nextBankBalance = Number(bank.balance) + amt;
      await bankRepo.update(bank.id, {
        balance: String(nextBankBalance.toFixed(2)),
        updatedAt: new Date(),
      });

      this.logger.info(`Reconciliation adjustment posted. Bank balance adjusted to: $${nextBankBalance.toFixed(2)}`);
      return updatedBt;
    });
  }

  public async reconcileBankAccount(dto: ReconcileBankAccountDto): Promise<any> {
    this.logger.info(`Reconciling bank account ID: ${dto.bankAccountId} up to date: ${dto.statementEndDate}`);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const reconRepo = txUow.getRepository<any>("bankReconciliations", tx);
      const bankRepo = txUow.getRepository<any>("bankAccounts", tx);
      const btRepo = txUow.getRepository<any>("bankTransactions", tx);

      const bank = await bankRepo.findById(dto.bankAccountId);
      if (!bank) {
        throw new NotFoundException("BankAccount", dto.bankAccountId);
      }

      const endDate = new Date(dto.statementEndDate);

      // Fetch all unmatched transactions up to statement end date
      const transactions = await tx
        .select()
        .from(schema.bankTransactions)
        .where(
          and(
            eq(schema.bankTransactions.bankAccountId, dto.bankAccountId),
            lte(schema.bankTransactions.transactionDate, endDate)
          )
        );

      const unmatched = transactions.filter((t) => t.status === "unmatched");
      if (unmatched.length > 0) {
        throw new BusinessRuleException(
          "UnmatchedTransactionsPresent",
          `Cannot finalize reconciliation. There are ${unmatched.length} unmatched bank transactions before or on ${endDate.toDateString()}.`
        );
      }

      // Fetch previous reconciliation ending balance as start
      const lastRecon = await tx
        .select()
        .from(schema.bankReconciliations)
        .where(eq(schema.bankReconciliations.bankAccountId, dto.bankAccountId))
        .orderBy(desc(schema.bankReconciliations.statementEndDate))
        .limit(1);

      const startBalance = lastRecon.length > 0 ? Number(lastRecon[0].statementEndingBalance) : 0;

      // Sum matched & adjustment transactions in this period
      const lastReconDate = lastRecon.length > 0 ? lastRecon[0].statementEndDate : new Date(0);
      const periodTrans = transactions.filter(
        (t) => t.transactionDate > lastReconDate && t.transactionDate <= endDate
      );

      let sumTrans = 0;
      for (const t of periodTrans) {
        sumTrans += Number(t.amount);
      }

      const calculatedEnding = startBalance + sumTrans;
      const expectedEnding = Number(dto.statementEndingBalance);

      if (Math.abs(calculatedEnding - expectedEnding) > 0.01) {
        throw new BusinessRuleException(
          "ReconciliationDiscrepancy",
          `Bank reconciliation failed. Sum of transactions starting from $${startBalance.toFixed(2)} yields $${calculatedEnding.toFixed(2)}, which does not match statement ending balance of $${expectedEnding.toFixed(2)}.`
        );
      }

      // Create Reconciliation Record
      const reconciliation = await reconRepo.create({
        bankAccountId: dto.bankAccountId,
        statementEndDate: endDate,
        statementEndingBalance: String(expectedEnding.toFixed(2)),
        ledgerEndingBalance: bank.balance,
        reconciledAt: new Date(),
        performedByUserId: dto.performedByUserId,
        status: "approved",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Update all transaction records with reconciliation ID
      for (const t of periodTrans) {
        await btRepo.update(t.id, {
          bankReconciliationId: reconciliation.id,
        });
      }

      this.logger.info(`Reconciliation successfully completed and APPROVED for Bank Account ID ${dto.bankAccountId}`);
      return reconciliation;
    });
  }
}
