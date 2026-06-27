// src/backend/application/services/stage5_2.service.ts

import { and, eq, gte, lte, sql, desc, between, or } from "drizzle-orm";
import * as schema from "../../../db/schema.ts";
import { IUnitOfWork } from "../ports/unit-of-work.interface.ts";
import { ILogger } from "../ports/logger.interface.ts";
import { AccountingService, CHART_OF_ACCOUNTS } from "./accounting.service.ts";
import {
  CreateCurrencyDto,
  SetExchangeRateDto,
  CreateBudgetDto,
  ReviseBudgetDto,
  CashTransferDto,
  CashTransactionDto,
  CurrencyRevaluationDto
} from "../dtos/dtos.ts";
import { NotFoundException, BusinessRuleException } from "../../domain/exceptions.ts";

export class Stage5_2Service {
  constructor(
    private readonly uow: IUnitOfWork,
    private readonly logger: ILogger,
    private readonly accountingService: AccountingService
  ) {}

  // =========================================================================
  // 1. MULTI-CURRENCY ENGINE
  // =========================================================================

  public async createCurrency(dto: CreateCurrencyDto): Promise<any> {
    this.logger.info(`Creating currency: ${dto.code} (${dto.name})`);
    return this.uow.runInTransaction(async (txUow, tx) => {
      const currencyRepo = txUow.getRepository<any>("currencies", tx);
      const existingList = await tx
        .select()
        .from(schema.currencies)
        .where(eq(schema.currencies.code, dto.code))
        .limit(1);
      if (existingList.length > 0) {
        throw new BusinessRuleException(
          "CurrencyAlreadyExists",
          `Currency code ${dto.code} already exists.`
        );
      }

      const created = await currencyRepo.create({
        code: dto.code,
        name: dto.name,
        symbol: dto.symbol,
        isBase: dto.isBase || false,
        decimals: dto.decimals !== undefined ? dto.decimals : 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return created;
    });
  }

  public async setExchangeRate(dto: SetExchangeRateDto): Promise<any> {
    this.logger.info(`Setting exchange rate: 1 ${dto.fromCurrency} = ${dto.rate} ${dto.toCurrency}`);
    return this.uow.runInTransaction(async (txUow, tx) => {
      const rateDate = new Date(dto.rateDate);
      const rateRepo = txUow.getRepository<any>("exchangeRates", tx);
      const created = await rateRepo.create({
        fromCurrency: dto.fromCurrency,
        toCurrency: dto.toCurrency,
        rate: String(dto.rate),
        rateDate: rateDate,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return created;
    });
  }

  public async getExchangeRate(fromCurrency: string, toCurrency: string, date: Date): Promise<number> {
    if (fromCurrency === toCurrency) {
      return 1.0;
    }

    return this.uow.runInTransaction(async (txUow, tx) => {
      const results = await tx
        .select()
        .from(schema.exchangeRates)
        .where(
          and(
            eq(schema.exchangeRates.fromCurrency, fromCurrency),
            eq(schema.exchangeRates.toCurrency, toCurrency),
            lte(schema.exchangeRates.rateDate, date)
          )
        )
        .orderBy(desc(schema.exchangeRates.rateDate))
        .limit(1);

      if (results.length === 0) {
        // Fallback: search reverse rate and invert it
        const reverseResults = await tx
          .select()
          .from(schema.exchangeRates)
          .where(
            and(
              eq(schema.exchangeRates.fromCurrency, toCurrency),
              eq(schema.exchangeRates.toCurrency, fromCurrency),
              lte(schema.exchangeRates.rateDate, date)
            )
          )
          .orderBy(desc(schema.exchangeRates.rateDate))
          .limit(1);

        if (reverseResults.length > 0) {
          const revRate = Number(reverseResults[0].rate);
          return revRate !== 0 ? 1 / revRate : 1.0;
        }

        this.logger.warn(`No exchange rate found from ${fromCurrency} to ${toCurrency} as of ${date.toISOString()}. Defaulting to 1.0`);
        return 1.0;
      }

      return Number(results[0].rate);
    });
  }

  public async postUnrealizedRevaluation(dto: CurrencyRevaluationDto): Promise<any> {
    this.logger.info(`Running Period-End Currency Revaluation as of ${dto.revaluationDate}`);
    const revalDate = new Date(dto.revaluationDate);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const bankRepo = txUow.getRepository<any>("bankAccounts", tx);
      const invoiceRepo = txUow.getRepository<any>("vendorInvoices", tx);
      const customerInvoiceRepo = txUow.getRepository<any>("customerInvoices", tx);

      // Fetch base currency
      const baseCurrencies = await tx
        .select()
        .from(schema.currencies)
        .where(eq(schema.currencies.isBase, true))
        .limit(1);
      const baseCurrency = baseCurrencies.length > 0 ? baseCurrencies[0].code : "USD";

      let totalRevalEntries = 0;

      // 1. Revalue Bank Accounts in Foreign Currency
      const foreignBanks = await tx
        .select()
        .from(schema.bankAccounts)
        .where(sql`${schema.bankAccounts.currency} != ${baseCurrency}`);

      for (const bank of foreignBanks) {
        const rate = await this.getExchangeRate(bank.currency, baseCurrency, revalDate);
        // Bank balance in table represents foreign amount. Its carrying value in GL (base currency) is what needs adjusting.
        const foreignBalance = Number(bank.balance);
        const nextBaseBalance = foreignBalance * rate;
        
        // Find current GL balance for this bank account ledger code up to the revaluation date
        const glBalanceResult = await tx
          .select({
            debitSum: sql<string>`sum(debit)`,
            creditSum: sql<string>`sum(credit)`
          })
          .from(schema.generalLedgerEntries)
          .where(
            and(
              eq(schema.generalLedgerEntries.companyId, dto.companyId),
              eq(schema.generalLedgerEntries.accountCode, bank.ledgerAccountCode),
              lte(schema.generalLedgerEntries.createdAt, revalDate)
            )
          );
        
        const currentGLBalance = glBalanceResult[0] 
          ? Number(glBalanceResult[0].debitSum || 0) - Number(glBalanceResult[0].creditSum || 0)
          : 0;

        const unrealizedGainLoss = nextBaseBalance - currentGLBalance;

        if (Math.abs(unrealizedGainLoss) > 0.005) {
          totalRevalEntries++;
          const debitAmt = unrealizedGainLoss > 0 ? Math.abs(unrealizedGainLoss) : 0;
          const creditAmt = unrealizedGainLoss < 0 ? Math.abs(unrealizedGainLoss) : 0;

          await this.accountingService.postJournalEntry(
            {
              companyId: dto.companyId,
              description: `Unrealized FX Revaluation - Bank ${bank.name}`,
              referenceType: "transfer",
              createdAt: revalDate,
              lines: [
                {
                  accountCode: bank.ledgerAccountCode,
                  accountType: "assets",
                  accountName: bank.name,
                  debit: debitAmt,
                  credit: creditAmt,
                },
                {
                  accountCode: "8020",
                  accountType: "expenses",
                  accountName: "Unrealized FX Gain/Loss",
                  debit: creditAmt, // Expense debit if negative gain (loss), credit if positive (gain)
                  credit: debitAmt,
                },
              ],
            },
            txUow,
            tx
          );

          // Automatically generate reversal entry on first day of next accounting period
          const reversalDate = new Date(revalDate);
          reversalDate.setDate(revalDate.getDate() + 1);

          await this.accountingService.postJournalEntry(
            {
              companyId: dto.companyId,
              description: `Reversal - Unrealized FX Revaluation - Bank ${bank.name}`,
              referenceType: "transfer",
              createdAt: reversalDate,
              lines: [
                {
                  accountCode: bank.ledgerAccountCode,
                  accountType: "assets",
                  accountName: bank.name,
                  debit: creditAmt,
                  credit: debitAmt,
                },
                {
                  accountCode: "8020",
                  accountType: "expenses",
                  accountName: "Unrealized FX Gain/Loss",
                  debit: debitAmt,
                  credit: creditAmt,
                },
              ],
            },
            txUow,
            tx
          );

          this.logger.info(`Revalued Bank ${bank.name}: Current base balance in GL = ${currentGLBalance.toFixed(2)}, Revalued base balance = ${nextBaseBalance.toFixed(2)}, Adj = ${unrealizedGainLoss.toFixed(2)} (Reversal posted for ${reversalDate.toISOString().split('T')[0]})`);
        }
      }

      // 2. Revalue Open Accounts Payable (Vendor Invoices)
      const openAPInvoices = await tx
        .select()
        .from(schema.vendorInvoices)
        .where(
          and(
            eq(schema.vendorInvoices.companyId, dto.companyId),
            sql`${schema.vendorInvoices.status} IN ('posted', 'partially_paid')`,
            sql`${schema.vendorInvoices.currencyCode} != ${baseCurrency}`
          )
        );

      for (const invoice of openAPInvoices) {
        const rate = await this.getExchangeRate(invoice.currencyCode, baseCurrency, revalDate);
        
        // Calculate outstanding foreign amount
        const pctOutstanding = 1 - Number(invoice.paidAmount) / Number(invoice.totalAmount);
        const foreignOutstanding = Number(invoice.currencyAmount || invoice.totalAmount) * pctOutstanding;
        
        const newBaseOutstanding = foreignOutstanding * rate;
        const oldBaseOutstanding = Number(invoice.totalAmount) - Number(invoice.paidAmount);
        const adjustment = newBaseOutstanding - oldBaseOutstanding;

        if (Math.abs(adjustment) > 0.005) {
          totalRevalEntries++;
          // An increase in AP outstanding is an expense (Unrealized Loss)
          const debitAmt = adjustment > 0 ? 0 : Math.abs(adjustment);
          const creditAmt = adjustment > 0 ? Math.abs(adjustment) : 0;

          await this.accountingService.postJournalEntry(
            {
              companyId: dto.companyId,
              description: `Unrealized FX Revaluation - AP Invoice ${invoice.invoiceNumber}`,
              referenceType: "receiving",
              createdAt: revalDate,
              lines: [
                {
                  accountCode: "8020",
                  accountType: "expenses",
                  accountName: "Unrealized FX Gain/Loss",
                  debit: adjustment > 0 ? Math.abs(adjustment) : 0,
                  credit: adjustment < 0 ? Math.abs(adjustment) : 0,
                },
                {
                  accountCode: invoice.apControlAccountCode,
                  accountType: "liabilities",
                  accountName: "Accounts Payable Control",
                  debit: debitAmt,
                  credit: creditAmt,
                },
              ],
            },
            txUow,
            tx
          );

          // Automatically generate reversal entry on first day of next accounting period
          const reversalDate = new Date(revalDate);
          reversalDate.setDate(revalDate.getDate() + 1);

          await this.accountingService.postJournalEntry(
            {
              companyId: dto.companyId,
              description: `Reversal - Unrealized FX Revaluation - AP Invoice ${invoice.invoiceNumber}`,
              referenceType: "receiving",
              createdAt: reversalDate,
              lines: [
                {
                  accountCode: "8020",
                  accountType: "expenses",
                  accountName: "Unrealized FX Gain/Loss",
                  debit: adjustment < 0 ? Math.abs(adjustment) : 0,
                  credit: adjustment > 0 ? Math.abs(adjustment) : 0,
                },
                {
                  accountCode: invoice.apControlAccountCode,
                  accountType: "liabilities",
                  accountName: "Accounts Payable Control",
                  debit: creditAmt,
                  credit: debitAmt,
                },
              ],
            },
            txUow,
            tx
          );

          // Update carrying totalAmount in invoice to keep subledger reconciled!
          const nextTotalAmount = Number(invoice.totalAmount) + adjustment;
          await invoiceRepo.update(invoice.id, {
            totalAmount: String(nextTotalAmount.toFixed(2)),
            exchangeRate: String(rate.toFixed(6)),
            updatedAt: new Date(),
          });

          this.logger.info(`Revalued AP Invoice ${invoice.invoiceNumber}: Adj = ${adjustment.toFixed(2)}, Next Total = ${nextTotalAmount.toFixed(2)} (Reversal posted for ${reversalDate.toISOString().split('T')[0]})`);
        }
      }

      // 3. Revalue Open Accounts Receivable (Customer Invoices)
      const openARInvoices = await tx
        .select()
        .from(schema.customerInvoices)
        .where(
          and(
            eq(schema.customerInvoices.companyId, dto.companyId),
            sql`${schema.customerInvoices.status} IN ('posted', 'partially_paid')`,
            sql`${schema.customerInvoices.currencyCode} != ${baseCurrency}`
          )
        );

      for (const invoice of openARInvoices) {
        const rate = await this.getExchangeRate(invoice.currencyCode, baseCurrency, revalDate);
        
        // Calculate outstanding foreign amount
        const pctOutstanding = 1 - Number(invoice.paidAmount) / Number(invoice.totalAmount);
        const foreignOutstanding = Number(invoice.currencyAmount || invoice.totalAmount) * pctOutstanding;
        
        const newBaseOutstanding = foreignOutstanding * rate;
        const oldBaseOutstanding = Number(invoice.totalAmount) - Number(invoice.paidAmount);
        const adjustment = newBaseOutstanding - oldBaseOutstanding;

        if (Math.abs(adjustment) > 0.005) {
          totalRevalEntries++;
          // An increase in AR outstanding is a gain (Unrealized Gain)
          const debitAmt = adjustment > 0 ? Math.abs(adjustment) : 0;
          const creditAmt = adjustment > 0 ? 0 : Math.abs(adjustment);

          await this.accountingService.postJournalEntry(
            {
              companyId: dto.companyId,
              description: `Unrealized FX Revaluation - AR Invoice ${invoice.invoiceNumber}`,
              referenceType: "sale",
              createdAt: revalDate,
              lines: [
                {
                  accountCode: invoice.arControlAccountCode,
                  accountType: "assets",
                  accountName: "Accounts Receivable Control",
                  debit: debitAmt,
                  credit: creditAmt,
                },
                {
                  accountCode: "8020",
                  accountType: "expenses",
                  accountName: "Unrealized FX Gain/Loss",
                  debit: adjustment < 0 ? Math.abs(adjustment) : 0,
                  credit: adjustment > 0 ? Math.abs(adjustment) : 0,
                },
              ],
            },
            txUow,
            tx
          );

          // Automatically generate reversal entry on first day of next accounting period
          const reversalDate = new Date(revalDate);
          reversalDate.setDate(revalDate.getDate() + 1);

          await this.accountingService.postJournalEntry(
            {
              companyId: dto.companyId,
              description: `Reversal - Unrealized FX Revaluation - AR Invoice ${invoice.invoiceNumber}`,
              referenceType: "sale",
              createdAt: reversalDate,
              lines: [
                {
                  accountCode: invoice.arControlAccountCode,
                  accountType: "assets",
                  accountName: "Accounts Receivable Control",
                  debit: creditAmt,
                  credit: debitAmt,
                },
                {
                  accountCode: "8020",
                  accountType: "expenses",
                  accountName: "Unrealized FX Gain/Loss",
                  debit: adjustment > 0 ? Math.abs(adjustment) : 0,
                  credit: adjustment < 0 ? Math.abs(adjustment) : 0,
                },
              ],
            },
            txUow,
            tx
          );

          // Update carrying totalAmount in invoice to keep subledger reconciled!
          const nextTotalAmount = Number(invoice.totalAmount) + adjustment;
          await customerInvoiceRepo.update(invoice.id, {
            totalAmount: String(nextTotalAmount.toFixed(2)),
            exchangeRate: String(rate.toFixed(6)),
            updatedAt: new Date(),
          });

          this.logger.info(`Revalued AR Invoice ${invoice.invoiceNumber}: Adj = ${adjustment.toFixed(2)}, Next Total = ${nextTotalAmount.toFixed(2)} (Reversal posted for ${reversalDate.toISOString().split('T')[0]})`);
        }
      }

      this.logger.info(`Period-End Currency Revaluation finished. Posted ${totalRevalEntries} adjustment journal entries and generated matching reversal entries.`);
      return { success: true, revalEntriesCount: totalRevalEntries };
    });
  }

  // =========================================================================
  // 2. CASH MANAGEMENT
  // =========================================================================

  public async transferCash(dto: CashTransferDto): Promise<any> {
    this.logger.info(`Transferring $${dto.amount} from Bank Account ${dto.sourceBankAccountId} to ${dto.destinationBankAccountId}`);
    if (dto.sourceBankAccountId === dto.destinationBankAccountId) {
      throw new BusinessRuleException("SameBankAccountTransfer", "Source and destination bank accounts cannot be the same.");
    }

    return this.uow.runInTransaction(async (txUow, tx) => {
      const bankRepo = txUow.getRepository<any>("bankAccounts", tx);
      const transferRepo = txUow.getRepository<any>("cashTransfers", tx);
      const bankTransRepo = txUow.getRepository<any>("bankTransactions", tx);

      const sourceBank = await bankRepo.findById(dto.sourceBankAccountId);
      const destBank = await bankRepo.findById(dto.destinationBankAccountId);

      if (!sourceBank) throw new NotFoundException("BankAccount", dto.sourceBankAccountId);
      if (!destBank) throw new NotFoundException("BankAccount", dto.destinationBankAccountId);

      if (Number(sourceBank.balance) < Number(dto.amount)) {
        throw new BusinessRuleException(
          "InsufficientFunds",
          `Source account has $${sourceBank.balance}, which is insufficient for $${dto.amount} transfer.`
        );
      }

      const transferDate = new Date(dto.transferDate);

      // Decrement source, Increment destination
      const nextSourceBalance = Number(sourceBank.balance) - Number(dto.amount);
      const nextDestBalance = Number(destBank.balance) + Number(dto.amount);

      await bankRepo.update(sourceBank.id, {
        balance: String(nextSourceBalance.toFixed(2)),
        updatedAt: new Date(),
      });

      await bankRepo.update(destBank.id, {
        balance: String(nextDestBalance.toFixed(2)),
        updatedAt: new Date(),
      });

      // Post balanced journal entry: Debit dest ledger, Credit source ledger
      await this.accountingService.postJournalEntry(
        {
          companyId: dto.companyId,
          description: dto.notes || `Interbank Cash Transfer (Ref: ${dto.referenceNumber || "None"})`,
          referenceType: "transfer",
          createdAt: transferDate,
          lines: [
            {
              accountCode: destBank.ledgerAccountCode,
              accountType: "assets",
              accountName: destBank.name,
              debit: Number(dto.amount),
              credit: 0,
            },
            {
              accountCode: sourceBank.ledgerAccountCode,
              accountType: "assets",
              accountName: sourceBank.name,
              debit: 0,
              credit: Number(dto.amount),
            },
          ],
        },
        txUow,
        tx
      );

      // Create transfer record
      const transfer = await transferRepo.create({
        companyId: dto.companyId,
        sourceBankAccountId: dto.sourceBankAccountId,
        destinationBankAccountId: dto.destinationBankAccountId,
        amount: String(Number(dto.amount).toFixed(2)),
        transferDate: transferDate,
        referenceNumber: dto.referenceNumber || null,
        status: "completed",
        notes: dto.notes || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create matching statement transactions
      await bankTransRepo.create({
        bankAccountId: sourceBank.id,
        transactionDate: transferDate,
        description: `Cash transfer withdrawal to ${destBank.name}`,
        amount: String((-Number(dto.amount)).toFixed(2)),
        referenceNumber: dto.referenceNumber || null,
        status: "unmatched",
        createdAt: new Date(),
      });

      await bankTransRepo.create({
        bankAccountId: destBank.id,
        transactionDate: transferDate,
        description: `Cash transfer deposit from ${sourceBank.name}`,
        amount: String(Number(dto.amount).toFixed(2)),
        referenceNumber: dto.referenceNumber || null,
        status: "unmatched",
        createdAt: new Date(),
      });

      return transfer;
    });
  }

  public async pettyCashTransaction(dto: CashTransactionDto): Promise<any> {
    this.logger.info(`Recording petty cash transaction: ${dto.type} of $${dto.amount} (${dto.description})`);
    return this.uow.runInTransaction(async (txUow, tx) => {
      const bankRepo = txUow.getRepository<any>("bankAccounts", tx);
      const cashTransRepo = txUow.getRepository<any>("cashTransactions", tx);
      const bankTransRepo = txUow.getRepository<any>("bankTransactions", tx);

      const bank = await bankRepo.findById(dto.bankAccountId);
      if (!bank) throw new NotFoundException("BankAccount", dto.bankAccountId);

      const isCashIn = dto.type === "cash_in";
      const amt = Number(dto.amount);
      const transDate = new Date(dto.transactionDate);

      if (!isCashIn && Number(bank.balance) < amt) {
        throw new BusinessRuleException(
          "InsufficientFunds",
          `Petty cash/bank account has $${bank.balance}, which is insufficient for a payment of $${dto.amount}.`
        );
      }

      // Check budget controls on expenses if cash_out
      if (!isCashIn) {
        await this.checkBudgetAndWarn(dto.companyId, dto.ledgerAccountCode, amt, transDate);
      }

      const nextBalance = isCashIn ? Number(bank.balance) + amt : Number(bank.balance) - amt;
      await bankRepo.update(bank.id, {
        balance: String(nextBalance.toFixed(2)),
        updatedAt: new Date(),
      });

      // Post Journal Entry
      // Cash In: Debit bank ledger account, Credit offset account
      // Cash Out: Credit bank ledger account, Debit offset account
      const lines = isCashIn
        ? [
            {
              accountCode: bank.ledgerAccountCode,
              accountType: "assets" as const,
              accountName: bank.name,
              debit: amt,
              credit: 0,
            },
            {
              accountCode: dto.ledgerAccountCode,
              accountType: "revenue" as const, // dynamic fallback in accounting service
              accountName: "Offset Account",
              debit: 0,
              credit: amt,
            },
          ]
        : [
            {
              accountCode: dto.ledgerAccountCode,
              accountType: "expenses" as const,
              accountName: "Offset Account",
              debit: amt,
              credit: 0,
            },
            {
              accountCode: bank.ledgerAccountCode,
              accountType: "assets" as const,
              accountName: bank.name,
              debit: 0,
              credit: amt,
            },
          ];

      await this.accountingService.postJournalEntry(
        {
          companyId: dto.companyId,
          description: dto.description,
          referenceType: isCashIn ? "receiving" : "payout",
          createdAt: transDate,
          lines,
        },
        txUow,
        tx
      );

      // Create record
      const cashTx = await cashTransRepo.create({
        companyId: dto.companyId,
        bankAccountId: dto.bankAccountId,
        type: dto.type,
        amount: String(amt.toFixed(2)),
        transactionDate: transDate,
        referenceNumber: dto.referenceNumber || null,
        description: dto.description,
        ledgerAccountCode: dto.ledgerAccountCode,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Auto-create bank statement transaction for matching
      await bankTransRepo.create({
        bankAccountId: bank.id,
        transactionDate: transDate,
        description: dto.description,
        amount: String((isCashIn ? amt : -amt).toFixed(2)),
        referenceNumber: dto.referenceNumber || null,
        status: "unmatched",
        createdAt: new Date(),
      });

      return cashTx;
    });
  }

  public async getCashPosition(companyId: number): Promise<any> {
    return this.uow.runInTransaction(async (txUow, tx) => {
      const bankAccountsList = await tx
        .select()
        .from(schema.bankAccounts)
        .where(eq(schema.bankAccounts.companyId, companyId));

      const baseCurrency = "USD";
      const list = [];
      let totalBaseCash = 0;

      for (const b of bankAccountsList) {
        const rate = await this.getExchangeRate(b.currency, baseCurrency, new Date());
        const foreignBal = Number(b.balance);
        const baseBal = foreignBal * rate;
        totalBaseCash += baseBal;

        list.push({
          id: b.id,
          name: b.name,
          accountNumber: b.accountNumber,
          currency: b.currency,
          foreignBalance: foreignBal,
          exchangeRate: rate,
          baseBalance: baseBal,
          status: b.status,
        });
      }

      return {
        companyId,
        bankAccounts: list,
        totalBaseCash,
        currency: baseCurrency,
      };
    });
  }

  // =========================================================================
  // 3. BUDGETING ENGINE
  // =========================================================================

  public async createBudget(dto: CreateBudgetDto): Promise<any> {
    this.logger.info(`Creating budget: ${dto.name} for Account ${dto.accountCode} ($${dto.annualAmount})`);
    return this.uow.runInTransaction(async (txUow, tx) => {
      const budgetRepo = txUow.getRepository<any>("budgets", tx);
      const periodRepo = txUow.getRepository<any>("budgetPeriods", tx);

      // Create budget master
      const budget = await budgetRepo.create({
        companyId: dto.companyId,
        fiscalYearId: dto.fiscalYearId,
        departmentId: dto.departmentId || null,
        storeId: dto.storeId || null,
        accountCode: dto.accountCode,
        name: dto.name,
        annualAmount: String(dto.annualAmount.toFixed(2)),
        notes: dto.notes || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Optional periods breakdown
      if (dto.periodAmounts && dto.periodAmounts.length > 0) {
        let totalPeriodsSum = 0;
        for (const p of dto.periodAmounts) {
          totalPeriodsSum += p.amount;
          await periodRepo.create({
            budgetId: budget.id,
            periodId: p.periodId,
            amount: String(p.amount.toFixed(2)),
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

        if (Math.abs(totalPeriodsSum - dto.annualAmount) > 0.05) {
          throw new BusinessRuleException(
            "BudgetBreakdownMismatch",
            `The sum of budgeted periods ($${totalPeriodsSum.toFixed(2)}) must equal the annual budget amount ($${dto.annualAmount.toFixed(2)}).`
          );
        }
      }

      return budget;
    });
  }

  public async reviseBudget(dto: ReviseBudgetDto): Promise<any> {
    this.logger.info(`Revising budget ID: ${dto.budgetId} to $${dto.revisedAmount}`);
    return this.uow.runInTransaction(async (txUow, tx) => {
      const budgetRepo = txUow.getRepository<any>("budgets", tx);
      const revisionRepo = txUow.getRepository<any>("budgetRevisions", tx);

      const budget = await budgetRepo.findById(dto.budgetId);
      if (!budget) throw new NotFoundException("Budget", dto.budgetId);

      // Create revision log
      await revisionRepo.create({
        budgetId: budget.id,
        revisionDate: new Date(),
        revisedAmount: String(dto.revisedAmount.toFixed(2)),
        reason: dto.reason,
        revisedByUserId: dto.revisedByUserId,
        createdAt: new Date(),
      });

      // Update master budget
      const updated = await budgetRepo.update(budget.id, {
        annualAmount: String(dto.revisedAmount.toFixed(2)),
        updatedAt: new Date(),
      });

      return updated;
    });
  }

  private async checkBudgetAndWarn(companyId: number, accountCode: string, amount: number, date: Date): Promise<void> {
    try {
      await this.uow.runInTransaction(async (txUow, tx) => {
        // Find if any budget exists for this account code and company
        const budgetsList = await tx
          .select()
          .from(schema.budgets)
          .where(
            and(
              eq(schema.budgets.companyId, companyId),
              eq(schema.budgets.accountCode, accountCode)
            )
          );

        if (budgetsList.length === 0) return;

        const budget = budgetsList[0];
        const annualLimit = Number(budget.annualAmount);

        // Fetch actual expenses posted to this account code
        const actualResult = await tx
          .select({
            debitSum: sql<string>`sum(debit)`,
            creditSum: sql<string>`sum(credit)`
          })
          .from(schema.generalLedgerEntries)
          .where(
            and(
              eq(schema.generalLedgerEntries.companyId, companyId),
              eq(schema.generalLedgerEntries.accountCode, accountCode)
            )
          );

        const currentActual = actualResult[0]
          ? Number(actualResult[0].debitSum || 0) - Number(actualResult[0].creditSum || 0)
          : 0;

        if (currentActual + amount > annualLimit) {
          this.logger.warn(`[BUDGET ALERT] Transaction of $${amount} on account ${accountCode} exceeds remaining annual budget of $${(annualLimit - currentActual).toFixed(2)} (Limit: $${annualLimit.toFixed(2)}, Actual-to-date: $${currentActual.toFixed(2)}).`);
        }
      });
    } catch (e: any) {
      this.logger.error(`Error in checkBudgetAndWarn: ${e.message}`);
    }
  }

  public async getBudgetVsActual(companyId: number, fiscalYearId: number, departmentId?: number, storeId?: number): Promise<any[]> {
    return this.uow.runInTransaction(async (txUow, tx) => {
      const conds = [
        eq(schema.budgets.companyId, companyId),
        eq(schema.budgets.fiscalYearId, fiscalYearId)
      ];
      if (departmentId) conds.push(eq(schema.budgets.departmentId, departmentId));
      if (storeId) conds.push(eq(schema.budgets.storeId, storeId));

      const budgetsList = await tx
        .select()
        .from(schema.budgets)
        .where(and(...conds));

      const list = [];
      for (const b of budgetsList) {
        // Query GL actuals
        const glConds = [
          eq(schema.generalLedgerEntries.companyId, companyId),
          eq(schema.generalLedgerEntries.accountCode, b.accountCode)
        ];
        if (storeId) {
          glConds.push(eq(schema.generalLedgerEntries.storeId, storeId));
        }

        const actualResult = await tx
          .select({
            debitSum: sql<string>`sum(debit)`,
            creditSum: sql<string>`sum(credit)`
          })
          .from(schema.generalLedgerEntries)
          .where(and(...glConds));

        const actualDebits = Number(actualResult[0]?.debitSum || 0);
        const actualCredits = Number(actualResult[0]?.creditSum || 0);
        
        // Find if this account is debit normal or credit normal
        const accountDef = CHART_OF_ACCOUNTS.find((c) => c.code === b.accountCode);
        const isDebitNormal = !accountDef || accountDef.type === "assets" || accountDef.type === "expenses";
        const actualAmount = isDebitNormal ? (actualDebits - actualCredits) : (actualCredits - actualDebits);

        const budgetAmount = Number(b.annualAmount);
        const variance = budgetAmount - actualAmount; // Positive means we are under budget (favorable for expenses)

        list.push({
          id: b.id,
          name: b.name,
          accountCode: b.accountCode,
          accountName: accountDef ? accountDef.name : "Budgeted Account",
          budgetAmount,
          actualAmount,
          variance,
          status: variance < 0 ? "EXCEEDED" : "OK",
        });
      }

      return list;
    });
  }

  // =========================================================================
  // 4. FINANCIAL REPORTING ENGINE
  // =========================================================================

  public async getTrialBalance(companyId: number, date: Date): Promise<any> {
    return this.uow.runInTransaction(async (txUow, tx) => {
      const rawEntries = await tx
        .select()
        .from(schema.generalLedgerEntries)
        .where(
          and(
            eq(schema.generalLedgerEntries.companyId, companyId),
            lte(schema.generalLedgerEntries.createdAt, date)
          )
        );

      const accountsMap: Record<string, { code: string; name: string; type: string; debit: number; credit: number }> = {};

      CHART_OF_ACCOUNTS.forEach((acc) => {
        accountsMap[acc.code] = {
          code: acc.code,
          name: acc.name,
          type: acc.type,
          debit: 0,
          credit: 0
        };
      });

      rawEntries.forEach((r: any) => {
        const code = r.accountCode || "UNKNOWN";
        if (!accountsMap[code]) {
          accountsMap[code] = {
            code,
            name: r.accountName || "Unassigned Account",
            type: r.accountType,
            debit: 0,
            credit: 0
          };
        }
        accountsMap[code].debit += Number(r.debit || 0);
        accountsMap[code].credit += Number(r.credit || 0);
      });

      const accounts = Object.values(accountsMap).map((acc) => {
        const isDebitNormal = acc.type === "assets" || acc.type === "expenses";
        const totalDeb = acc.debit;
        const totalCred = acc.credit;

        let netDebit = 0;
        let netCredit = 0;

        if (isDebitNormal) {
          const net = totalDeb - totalCred;
          if (net >= 0) netDebit = net;
          else netCredit = Math.abs(net);
        } else {
          const net = totalCred - totalDeb;
          if (net >= 0) netCredit = net;
          else netDebit = Math.abs(net);
        }

        return {
          code: acc.code,
          name: acc.name,
          type: acc.type,
          debit: netDebit,
          credit: netCredit,
          rawDebits: totalDeb,
          rawCredits: totalCred
        };
      });

      const totalDebits = accounts.reduce((sum, acc) => sum + acc.debit, 0);
      const totalCredits = accounts.reduce((sum, acc) => sum + acc.credit, 0);

      return {
        date,
        accounts,
        totalDebits: Number(totalDebits.toFixed(2)),
        totalCredits: Number(totalCredits.toFixed(2)),
        isBalanced: Math.abs(totalDebits - totalCredits) < 0.05
      };
    });
  }

  public async getBalanceSheet(companyId: number, date: Date): Promise<any> {
    const trialBalance = await this.getTrialBalance(companyId, date);

    const assetsList: any[] = [];
    const liabilitiesList: any[] = [];
    const equityList: any[] = [];

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    // Separate Net Income of current year from Retained Earnings to represent current state correctly
    let currentPeriodNetIncome = 0;

    trialBalance.accounts.forEach((acc: any) => {
      if (acc.type === "assets") {
        const balance = acc.debit - acc.credit; // assets are debit normal
        if (balance !== 0) {
          assetsList.push({ code: acc.code, name: acc.name, balance });
          totalAssets += balance;
        }
      } else if (acc.type === "liabilities") {
        const balance = acc.credit - acc.debit; // liabilities are credit normal
        if (balance !== 0) {
          liabilitiesList.push({ code: acc.code, name: acc.name, balance });
          totalLiabilities += balance;
        }
      } else if (acc.type === "equity") {
        const balance = acc.credit - acc.debit; // equity is credit normal
        if (balance !== 0) {
          equityList.push({ code: acc.code, name: acc.name, balance });
          totalEquity += balance;
        }
      } else if (acc.type === "revenue") {
        // revenue net is credit normal
        currentPeriodNetIncome += (acc.credit - acc.debit);
      } else if (acc.type === "expenses") {
        // expenses net is debit normal
        currentPeriodNetIncome -= (acc.debit - acc.credit);
      }
    });

    // Add Current Year Net Income to equity list
    if (currentPeriodNetIncome !== 0) {
      equityList.push({
        code: "9999",
        name: "Current Period Net Income (YTD)",
        balance: currentPeriodNetIncome
      });
      totalEquity += currentPeriodNetIncome;
    }

    const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.05;

    return {
      date,
      assets: assetsList,
      totalAssets: Number(totalAssets.toFixed(2)),
      liabilities: liabilitiesList,
      totalLiabilities: Number(totalLiabilities.toFixed(2)),
      equity: equityList,
      totalEquity: Number(totalEquity.toFixed(2)),
      totalLiabilitiesAndEquity: Number((totalLiabilities + totalEquity).toFixed(2)),
      isBalanced
    };
  }

  public async getIncomeStatement(companyId: number, startDate: Date, endDate: Date): Promise<any> {
    return this.uow.runInTransaction(async (txUow, tx) => {
      const rawEntries = await tx
        .select()
        .from(schema.generalLedgerEntries)
        .where(
          and(
            eq(schema.generalLedgerEntries.companyId, companyId),
            between(schema.generalLedgerEntries.createdAt, startDate, endDate)
          )
        );

      const accountsMap: Record<string, { code: string; name: string; type: string; balance: number }> = {};

      rawEntries.forEach((r: any) => {
        const code = r.accountCode || "UNKNOWN";
        if (r.accountType !== "revenue" && r.accountType !== "expenses") {
          return;
        }

        if (!accountsMap[code]) {
          const accountDef = CHART_OF_ACCOUNTS.find((c) => c.code === code);
          accountsMap[code] = {
            code,
            name: r.accountName || accountDef?.name || "Unassigned Account",
            type: r.accountType,
            balance: 0
          };
        }

        const d = Number(r.debit || 0);
        const c = Number(r.credit || 0);

        if (r.accountType === "revenue") {
          accountsMap[code].balance += (c - d); // Revenue is credit normal
        } else {
          accountsMap[code].balance += (d - c); // Expense is debit normal
        }
      });

      const revenues = Object.values(accountsMap).filter((a) => a.type === "revenue");
      const expenses = Object.values(accountsMap).filter((a) => a.type === "expenses");

      const totalRevenue = revenues.reduce((sum, r) => sum + r.balance, 0);
      const totalExpenses = expenses.reduce((sum, e) => sum + e.balance, 0);
      const netIncome = totalRevenue - totalExpenses;

      return {
        startDate,
        endDate,
        revenues,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        expenses,
        totalExpenses: Number(totalExpenses.toFixed(2)),
        netIncome: Number(netIncome.toFixed(2))
      };
    });
  }

  public async getCashFlowStatement(companyId: number, startDate: Date, endDate: Date): Promise<any> {
    return this.uow.runInTransaction(async (txUow, tx) => {
      // Find all GL postings to Cash and Cash Equivalents '1010' and '1011' between dates
      const entries = await tx
        .select()
        .from(schema.generalLedgerEntries)
        .where(
          and(
            eq(schema.generalLedgerEntries.companyId, companyId),
            or(
              eq(schema.generalLedgerEntries.accountCode, "1010"),
              eq(schema.generalLedgerEntries.accountCode, "1011")
            ),
            between(schema.generalLedgerEntries.createdAt, startDate, endDate)
          )
        );

      let operatingInflow = 0;
      let operatingOutflow = 0;
      let investingInflow = 0;
      let investingOutflow = 0;
      let financingInflow = 0;
      let financingOutflow = 0;

      for (const entry of entries) {
        const debit = Number(entry.debit);
        const credit = Number(entry.credit);
        const refType = entry.referenceType;

        // Categorize based on referenceType:
        // 'sale' -> customer collections (Operating)
        // 'receiving' -> payment to suppliers / inventory purchases (Operating)
        // 'payment' -> Accounts Payable pay (Operating)
        // 'payout' -> petty cash / expenses (Operating)
        // 'transfer' -> interbank or owner capital/drawings (Financing or Investing)
        if (refType === "sale") {
          operatingInflow += debit;
          operatingOutflow += credit;
        } else if (refType === "receiving" || refType === "payment" || refType === "payout") {
          operatingInflow += debit;
          operatingOutflow += credit;
        } else {
          // Fallback to financing/investing based on some logic or keep it simple
          financingInflow += debit;
          financingOutflow += credit;
        }
      }

      const netOperating = operatingInflow - operatingOutflow;
      const netInvesting = investingInflow - investingOutflow;
      const netFinancing = financingInflow - financingOutflow;
      const netIncrease = netOperating + netInvesting + netFinancing;

      return {
        startDate,
        endDate,
        operating: {
          inflow: Number(operatingInflow.toFixed(2)),
          outflow: Number(operatingOutflow.toFixed(2)),
          net: Number(netOperating.toFixed(2)),
        },
        investing: {
          inflow: Number(investingInflow.toFixed(2)),
          outflow: Number(investingOutflow.toFixed(2)),
          net: Number(netInvesting.toFixed(2)),
        },
        financing: {
          inflow: Number(financingInflow.toFixed(2)),
          outflow: Number(financingOutflow.toFixed(2)),
          net: Number(netFinancing.toFixed(2)),
        },
        netIncreaseInCash: Number(netIncrease.toFixed(2)),
      };
    });
  }

  public async getGeneralLedgerReport(companyId: number, filters: { accountCode?: string; startDate: Date; endDate: Date }): Promise<any> {
    return this.uow.runInTransaction(async (txUow, tx) => {
      const conds = [
        eq(schema.generalLedgerEntries.companyId, companyId)
      ];
      if (filters.accountCode) {
        conds.push(eq(schema.generalLedgerEntries.accountCode, filters.accountCode));
      }

      // 1. Calculate opening balance as of startDate
      const opEntries = await tx
        .select()
        .from(schema.generalLedgerEntries)
        .where(
          and(
            ...conds,
            lte(schema.generalLedgerEntries.createdAt, new Date(filters.startDate.getTime() - 1))
          )
        );

      const opDebits = opEntries.reduce((sum, e) => sum + Number(e.debit), 0);
      const opCredits = opEntries.reduce((sum, e) => sum + Number(e.credit), 0);
      const openingBalance = opDebits - opCredits;

      // 2. Fetch active entries between dates
      const entries = await tx
        .select()
        .from(schema.generalLedgerEntries)
        .where(
          and(
            ...conds,
            between(schema.generalLedgerEntries.createdAt, filters.startDate, filters.endDate)
          )
        )
        .orderBy(schema.generalLedgerEntries.createdAt);

      let runningBalance = openingBalance;
      const processedEntries = entries.map((e) => {
        const d = Number(e.debit);
        const c = Number(e.credit);
        runningBalance += (d - c);

        return {
          id: e.id,
          date: e.createdAt,
          description: e.description,
          referenceType: e.referenceType,
          debit: d,
          credit: c,
          runningBalance: Number(runningBalance.toFixed(2)),
        };
      });

      return {
        companyId,
        accountCode: filters.accountCode || "ALL",
        startDate: filters.startDate,
        endDate: filters.endDate,
        openingBalance: Number(openingBalance.toFixed(2)),
        entries: processedEntries,
        closingBalance: Number(runningBalance.toFixed(2)),
      };
    });
  }

  public async getApAgingReport(companyId: number, date: Date): Promise<any> {
    return this.uow.runInTransaction(async (txUow, tx) => {
      const invoices = await tx
        .select()
        .from(schema.vendorInvoices)
        .where(
          and(
            eq(schema.vendorInvoices.companyId, companyId),
            sql`${schema.vendorInvoices.status} IN ('posted', 'partially_paid')`,
            lte(schema.vendorInvoices.invoiceDate, date)
          )
        );

      const vendorsList = await tx
        .select()
        .from(schema.vendors)
        .where(eq(schema.vendors.companyId, companyId));

      const aging: Record<string, { vendorId: number; vendorName: string; current: number; aged30: number; aged60: number; aged90: number; total: number }> = {};

      vendorsList.forEach((v) => {
        aging[v.id] = {
          vendorId: v.id,
          vendorName: v.name,
          current: 0,
          aged30: 0,
          aged60: 0,
          aged90: 0,
          total: 0,
        };
      });

      for (const inv of invoices) {
        if (!aging[inv.vendorId]) {
          aging[inv.vendorId] = {
            vendorId: inv.vendorId,
            vendorName: `Vendor ID ${inv.vendorId}`,
            current: 0,
            aged30: 0,
            aged60: 0,
            aged90: 0,
            total: 0,
          };
        }

        const outstanding = Number(inv.totalAmount) - Number(inv.paidAmount);
        if (outstanding <= 0) continue;

        const diffTime = date.getTime() - new Date(inv.dueDate).getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) {
          aging[inv.vendorId].current += outstanding;
        } else if (diffDays <= 30) {
          aging[inv.vendorId].aged30 += outstanding;
        } else if (diffDays <= 60) {
          aging[inv.vendorId].aged60 += outstanding;
        } else {
          aging[inv.vendorId].aged90 += outstanding;
        }
        aging[inv.vendorId].total += outstanding;
      }

      const rows = Object.values(aging).filter((r) => r.total > 0);
      const totals = {
        current: rows.reduce((sum, r) => sum + r.current, 0),
        aged30: rows.reduce((sum, r) => sum + r.aged30, 0),
        aged60: rows.reduce((sum, r) => sum + r.aged60, 0),
        aged90: rows.reduce((sum, r) => sum + r.aged90, 0),
        total: rows.reduce((sum, r) => sum + r.total, 0),
      };

      return {
        date,
        vendors: rows,
        totals,
      };
    });
  }

  public async getArAgingReport(companyId: number, date: Date): Promise<any> {
    return this.uow.runInTransaction(async (txUow, tx) => {
      const invoices = await tx
        .select()
        .from(schema.customerInvoices)
        .where(
          and(
            eq(schema.customerInvoices.companyId, companyId),
            sql`${schema.customerInvoices.status} IN ('posted', 'partially_paid')`,
            lte(schema.customerInvoices.invoiceDate, date)
          )
        );

      const customersList = await tx
        .select()
        .from(schema.customers);

      const aging: Record<string, { customerId: number; customerName: string; current: number; aged30: number; aged60: number; aged90: number; total: number }> = {};

      customersList.forEach((c) => {
        aging[c.id] = {
          customerId: c.id,
          customerName: c.name,
          current: 0,
          aged30: 0,
          aged60: 0,
          aged90: 0,
          total: 0,
        };
      });

      for (const inv of invoices) {
        if (!aging[inv.customerId]) {
          aging[inv.customerId] = {
            customerId: inv.customerId,
            customerName: `Customer ID ${inv.customerId}`,
            current: 0,
            aged30: 0,
            aged60: 0,
            aged90: 0,
            total: 0,
          };
        }

        const outstanding = Number(inv.totalAmount) - Number(inv.paidAmount);
        if (outstanding <= 0) continue;

        const diffTime = date.getTime() - new Date(inv.dueDate).getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) {
          aging[inv.customerId].current += outstanding;
        } else if (diffDays <= 30) {
          aging[inv.customerId].aged30 += outstanding;
        } else if (diffDays <= 60) {
          aging[inv.customerId].aged60 += outstanding;
        } else {
          aging[inv.customerId].aged90 += outstanding;
        }
        aging[inv.customerId].total += outstanding;
      }

      const rows = Object.values(aging).filter((r) => r.total > 0);
      const totals = {
        current: rows.reduce((sum, r) => sum + r.current, 0),
        aged30: rows.reduce((sum, r) => sum + r.aged30, 0),
        aged60: rows.reduce((sum, r) => sum + r.aged60, 0),
        aged90: rows.reduce((sum, r) => sum + r.aged90, 0),
        total: rows.reduce((sum, r) => sum + r.total, 0),
      };

      return {
        date,
        customers: rows,
        totals,
      };
    });
  }
}
