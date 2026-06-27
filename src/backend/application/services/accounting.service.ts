// src/backend/application/services/accounting.service.ts

import { and, eq, gte, lte, sql, desc, inArray } from "drizzle-orm";
import * as schema from "../../../db/schema.ts";
import { IUnitOfWork } from "../ports/unit-of-work.interface.ts";
import { ILogger } from "../ports/logger.interface.ts";
import { Validator } from "../dtos/validation.ts";
import { CreateJournalEntryDto, AccountingFilterDto, JournalEntryLineDto } from "../dtos/dtos.ts";
import { BusinessRuleException, NotFoundException } from "../../domain/exceptions.ts";

export interface AccountDef {
  code: string;
  name: string;
  type: "assets" | "liabilities" | "equity" | "revenue" | "expenses";
  description: string;
}

export const CHART_OF_ACCOUNTS: AccountDef[] = [
  { code: "1010", name: "Cash and Cash Equivalents", type: "assets", description: "Direct liquid cash, bank balances, and card clearing accounts." },
  { code: "1200", name: "Accounts Receivable", type: "assets", description: "Outstanding funds owed by customers for purchases." },
  { code: "1300", name: "Inventory Asset", type: "assets", description: "Cost value of physical goods stored in warehouses and store inventories." },
  { code: "1400", name: "Intercompany Due From Stores", type: "assets", description: "Owed receivables from other store branches for inter-store stock transfers." },
  { code: "1510", name: "Fixed Assets - Cost", type: "assets", description: "Original historical cost of physical fixed assets." },
  { code: "1519", name: "Accumulated Depreciation", type: "assets", description: "Cumulative historical depreciation contra-asset balance." },
  { code: "2010", name: "Accounts Payable", type: "liabilities", description: "Owed liabilities to vendors for purchased items and supplies." },
  { code: "2012", name: "Accrued Inventory Liability", type: "liabilities", description: "Accrued liability for Goods Received Not Invoiced (GRNI)." },
  { code: "2100", name: "Store Credit Liability", type: "liabilities", description: "Obligation to honor issued customer store credits." },
  { code: "2200", name: "Gift Card Liability", type: "liabilities", description: "Obligation to honor purchased and activated gift cards." },
  { code: "2300", name: "Taxes Payable", type: "liabilities", description: "Outstanding sales tax amounts collected but not yet remitted." },
  { code: "2400", name: "Intercompany Due To Stores", type: "liabilities", description: "Owed payables to other store branches for inter-store stock transfers." },
  { code: "3010", name: "Retained Earnings", type: "equity", description: "Cumulative retained net revenues minus distributed dividends." },
  { code: "3020", name: "Revaluation Reserve", type: "equity", description: "Equity reserve created by upward revaluation of fixed assets." },
  { code: "4010", name: "Sales Revenue", type: "revenue", description: "Direct top-line revenues gained from sales." },
  { code: "4020", name: "Sales Returns & Refunds", type: "revenue", description: "Contra-revenue adjustments for returned merchandise." },
  { code: "5010", name: "Cost of Goods Sold (COGS)", type: "expenses", description: "Cost price value of stock items consumed during sales transactions." },
  { code: "5020", name: "Inventory Shrinkage Expense", type: "expenses", description: "Expenses from shrinkage, damages, or stock adjustment losses." },
  { code: "5030", name: "Customer Loyalty/Awards Expense", type: "expenses", description: "Expenses connected to gift card and customer program incentives." },
  { code: "5050", name: "Depreciation Expense", type: "expenses", description: "Monthly depreciation expense on capitalized assets." },
  { code: "5060", name: "Impairment of Fixed Assets", type: "expenses", description: "One-off expense due to permanent decline in asset utility." },
  { code: "8010", name: "Realized FX Gain/Loss", type: "revenue", description: "Realized foreign exchange gain/loss from invoice settlements." },
  { code: "8020", name: "Unrealized FX Gain/Loss", type: "expenses", description: "Unrealized foreign exchange gain/loss from asset/liability revaluations." },
  { code: "8030", name: "Gain/Loss on Asset Disposal", type: "revenue", description: "Net financial gain or loss realized from asset disposals." },
];

export class AccountingService {
  constructor(
    private readonly uow: IUnitOfWork,
    private readonly logger: ILogger
  ) {}

  public getChartOfAccounts(): AccountDef[] {
    return CHART_OF_ACCOUNTS;
  }

  /**
   * Post double entry lines into General Ledger
   */
  public async postJournalEntry(dto: CreateJournalEntryDto, txUow?: IUnitOfWork, tx?: any): Promise<any> {
    Validator.validateCreateJournalEntry(dto);

    const executeBlock = async (activeUow: IUnitOfWork, activeTx: any) => {
      const ledgerRepo = activeUow.getRepository<any>("generalLedgerEntries", activeTx);
      
      const entryDate = dto.createdAt ? new Date(dto.createdAt) : new Date();
      await this.verifyPeriodIsNotLocked(entryDate, dto.companyId, activeTx, dto.referenceType);

      const createdEntries = [];
      for (const line of dto.lines) {
        // Double check matching account def
        const matched = CHART_OF_ACCOUNTS.find((c) => c.code === line.accountCode);
        const typeInUse = matched ? matched.type : line.accountType;
        const nameInUse = matched ? matched.name : line.accountName;

        const ledgerRecord = await ledgerRepo.create({
          companyId: dto.companyId,
          storeId: dto.storeId || null,
          accountType: typeInUse,
          accountCode: line.accountCode,
          accountName: nameInUse,
          description: dto.description,
          debit: String(Number(line.debit || 0).toFixed(2)),
          credit: String(Number(line.credit || 0).toFixed(2)),
          referenceType: dto.referenceType,
          referenceId: dto.referenceId || null,
          createdAt: entryDate,
        });
        createdEntries.push(ledgerRecord);
      }
      return createdEntries;
    };

    if (txUow && tx) {
      return executeBlock(txUow, tx);
    } else {
      return this.uow.runInTransaction(async (u, t) => {
        return executeBlock(u, t);
      });
    }
  }

  /**
   * Helper to fetch filtered general ledger records
   */
  private async getFilteredEntries(filters: AccountingFilterDto) {
    const entriesRepo = this.uow.getRepository<any>("generalLedgerEntries");
    const records = await entriesRepo.findAll();

    return records.filter((r: any) => {
      if (filters.storeId && r.storeId !== filters.storeId) return false;
      if (filters.accountCode && r.accountCode !== filters.accountCode) return false;
      if (filters.startDate && new Date(r.createdAt) < new Date(filters.startDate)) return false;
      if (filters.endDate && new Date(r.createdAt) > new Date(filters.endDate)) return false;
      return true;
    });
  }

  /**
   * Get Trial Balance Report
   */
  public async getTrialBalance(filters: AccountingFilterDto): Promise<any> {
    const rawEntries = await this.getFilteredEntries(filters);
    
    // Group by account
    const accountsMap: Record<string, { code: string; name: string; type: string; debit: number; credit: number }> = {};
    
    // Seed standard chart of accounts to ensure they display even with zero values
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
      // Calculate net balances based on account type conventions
      // Assets + Expenses -> debit normal. Liabilities + Equity + Revenue -> credit normal.
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
        ...acc,
        debit: Number(totalDeb.toFixed(2)),
        credit: Number(totalCred.toFixed(2)),
        netDebit: Number(netDebit.toFixed(2)),
        netCredit: Number(netCredit.toFixed(2))
      };
    });

    const totalDebits = accounts.reduce((sum, item) => sum + item.netDebit, 0);
    const totalCredits = accounts.reduce((sum, item) => sum + item.netCredit, 0);

    return {
      accounts,
      totalDebits: Number(totalDebits.toFixed(2)),
      totalCredits: Number(totalCredits.toFixed(2)),
      balanced: Math.abs(totalDebits - totalCredits) <= 0.05
    };
  }

  /**
   * Get General Ledger Details with running balance
   */
  public async getGeneralLedger(filters: AccountingFilterDto): Promise<any> {
    const rawEntries = await this.getFilteredEntries(filters);
    
    // Sort chronological
    rawEntries.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Compute running balance per account
    const runningBalances: Record<string, number> = {};
    const ledgerLines = rawEntries.map((r: any) => {
      const code = r.accountCode || "UNKNOWN";
      const type = r.accountType;
      const isDebitNormal = type === "assets" || type === "expenses";
      
      if (runningBalances[code] === undefined) {
        runningBalances[code] = 0;
      }

      const deb = Number(r.debit || 0);
      const cred = Number(r.credit || 0);
      
      if (isDebitNormal) {
        runningBalances[code] += (deb - cred);
      } else {
        runningBalances[code] += (cred - deb);
      }

      return {
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        storeId: r.storeId,
        accountCode: r.accountCode,
        accountName: r.accountName,
        accountType: r.accountType,
        description: r.description,
        debit: deb,
        credit: cred,
        referenceType: r.referenceType,
        referenceId: r.referenceId,
        runningBalance: Number(runningBalances[code].toFixed(2))
      };
    });

    return {
      filters,
      lineCount: ledgerLines.length,
      lines: ledgerLines.reverse() // Return newest first for display
    };
  }

  /**
   * Get Balanced Balance Sheet Report
   */
  public async getBalanceSheet(filters: AccountingFilterDto): Promise<any> {
    const trialBalance = await this.getTrialBalance(filters);
    
    const assetsList = trialBalance.accounts.filter((a: any) => a.type === "assets");
    const liabilitiesList = trialBalance.accounts.filter((a: any) => a.type === "liabilities");
    const equityList = trialBalance.accounts.filter((a: any) => a.type === "equity");

    const totalAssets = assetsList.reduce((sum: number, a: any) => sum + (a.netDebit - a.netCredit), 0);
    const totalLiabilities = liabilitiesList.reduce((sum: number, a: any) => sum + (a.netCredit - a.netDebit), 0);
    
    // In actual systems, Profit & Loss for the period must flow into Retained Earnings (Equity)
    const pl = await this.getProfitLossStatement(filters);
    const currentPeriodNetIncome = pl.netIncome;

    const baseEquity = equityList.reduce((sum: number, a: any) => sum + (a.netCredit - a.netDebit), 0);
    const totalEquity = baseEquity + currentPeriodNetIncome;

    return {
      assets: assetsList.map((a: any) => ({
        code: a.code,
        name: a.name,
        balance: Number((a.netDebit - a.netCredit).toFixed(2))
      })),
      totalAssets: Number(totalAssets.toFixed(2)),
      
      liabilities: liabilitiesList.map((a: any) => ({
        code: a.code,
        name: a.name,
        balance: Number((a.netCredit - a.netDebit).toFixed(2))
      })),
      totalLiabilities: Number(totalLiabilities.toFixed(2)),
      
      equity: [
        ...equityList.map((a: any) => ({
          code: a.code,
          name: a.name,
          balance: Number((a.netCredit - a.netDebit).toFixed(2))
        })),
        { code: "", name: "Current Period Net Income", balance: Number(currentPeriodNetIncome.toFixed(2)) }
      ],
      totalEquity: Number(totalEquity.toFixed(2)),
      totalLiabilitiesAndEquity: Number((totalLiabilities + totalEquity).toFixed(2)),
      balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) <= 0.05
    };
  }

  /**
   * Get Profit & Loss (Income Statement) Report
   */
  public async getProfitLoss(filters: AccountingFilterDto): Promise<any> {
    return this.getProfitLossStatement(filters);
  }

  public async getProfitLossStatement(filters: AccountingFilterDto): Promise<any> {
    const trialBalance = await this.getTrialBalance(filters);
    
    const revenuesList = trialBalance.accounts.filter((a: any) => a.type === "revenue");
    const expensesList = trialBalance.accounts.filter((a: any) => a.type === "expenses");

    // Standard revenue account balance calculation: Credit - Debit (since revenue is normal credit balance)
    const revenues = revenuesList.map((a: any) => {
      // Contra accounts like 4020 will end up as negative value here, which is correct
      const isContra = a.code === "4020";
      const balance = isContra 
        ? -(a.netDebit - a.netCredit)
        : (a.netCredit - a.netDebit);

      return {
        code: a.code,
        name: a.name,
        balance: Number(balance.toFixed(2))
      };
    });

    // Expenses: Debit - Credit (since expense is normal debit balance)
    const expenses = expensesList.map((a: any) => ({
      code: a.code,
      name: a.name,
      balance: Number((a.netDebit - a.netCredit).toFixed(2))
    }));

    const totalRevenues = revenues.reduce((sum, r) => sum + r.balance, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.balance, 0);
    const netIncome = totalRevenues - totalExpenses;

    const cogsValue = expenses.find((e) => e.code === "5010")?.balance || 0;
    const grossProfit = totalRevenues - cogsValue;

    return {
      revenues,
      totalRevenues: Number(totalRevenues.toFixed(2)),
      expenses,
      totalExpenses: Number(totalExpenses.toFixed(2)),
      grossProfit: Number(grossProfit.toFixed(2)),
      netIncome: Number(netIncome.toFixed(2))
    };
  }

  /**
   * Get Cash Flow Statement Report
   */
  public async getCashFlowStatement(filters: AccountingFilterDto): Promise<any> {
    // Collect all Cash entries (accountCode = "1010")
    const searchFilter = { ...filters, accountCode: "1010" };
    const cashEntries = await this.getFilteredEntries(searchFilter);
    
    let operatingIn = 0;
    let operatingOut = 0;
    let investingIn = 0;
    let investingOut = 0;
    let financingIn = 0;
    let financingOut = 0;

    const details: any[] = [];

    cashEntries.forEach((r: any) => {
      const db = Number(r.debit || 0);
      const cr = Number(r.credit || 0);
      const net = db - cr;
      
      let activityType: "operating" | "investing" | "financing" = "operating";
      
      // Categorize basic cash movement types
      if (r.referenceType === "sale" || r.referenceType === "return" || r.referenceType === "payout" || r.referenceType === "store_credit") {
        activityType = "operating";
        if (net >= 0) operatingIn += net;
        else operatingOut += Math.abs(net);
      } else if (r.referenceType === "receiving" || r.referenceType === "purchase_orders" || r.referenceType === "inventory_adjustment") {
        activityType = "operating";
        if (net >= 0) operatingIn += net;
        else operatingOut += Math.abs(net);
      } else if (r.referenceType === "financing" || r.referenceType === "equity_issuance") {
        activityType = "financing";
        if (net >= 0) financingIn += net;
        else financingOut += Math.abs(net);
      } else {
        activityType = "operating";
        if (net >= 0) operatingIn += net;
        else operatingOut += Math.abs(net);
      }

      details.push({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        description: r.description,
        netFlow: Number(net.toFixed(2)),
        activityType,
        referenceType: r.referenceType,
        referenceId: r.referenceId
      });
    });

    const netOperating = operatingIn - operatingOut;
    const netInvesting = investingIn - investingOut;
    const netFinancing = financingIn - financingOut;
    const netIncrease = netOperating + netInvesting + netFinancing;

    return {
      operating: {
        inflow: Number(operatingIn.toFixed(2)),
        outflow: Number(operatingOut.toFixed(2)),
        net: Number(netOperating.toFixed(2))
      },
      investing: {
        inflow: Number(investingIn.toFixed(2)),
        outflow: Number(investingOut.toFixed(2)),
        net: Number(netInvesting.toFixed(2))
      },
      financing: {
        inflow: Number(financingIn.toFixed(2)),
        outflow: Number(financingOut.toFixed(2)),
        net: Number(netFinancing.toFixed(2))
      },
      netIncreaseInCash: Number(netIncrease.toFixed(2)),
      details: details.slice(0, 50) // Return recent 50
    };
  }

  /**
   * Period Locking & Back-dated transaction verification
   */
  private async verifyPeriodIsNotLocked(date: Date, companyId: number, tx: any, referenceType?: string): Promise<void> {
    if (referenceType === "year_end_close" || referenceType === "period_adjustment") {
      return; // Authorized entries bypass locks
    }
    const periodList = await tx.select()
      .from(schema.accountingPeriods)
      .where(
        and(
          lte(schema.accountingPeriods.startDate, date),
          gte(schema.accountingPeriods.endDate, date)
        )
      )
      .limit(1);

    if (periodList.length > 0) {
      const period = periodList[0];
      if (period.status === "closed" || period.status === "archived") {
        throw new BusinessRuleException(
          "PeriodLocked",
          `Cannot post transaction: Accounting period '${period.name}' starting ${period.startDate.toDateString()} is strictly CLOSED/LOCKED.`
        );
      }
      if (period.status === "soft_closed") {
        throw new BusinessRuleException(
          "PeriodSoftClosed",
          `Cannot post transaction: Accounting period '${period.name}' is soft closed. Only specific period adjustments are authorized.`
        );
      }
    }
  }

  /**
   * Create a new Fiscal Year along with 12 nested Accounting Periods (Monthly or 4-4-5)
   */
  public async createFiscalYear(year: number, startDate: Date, endDate: Date, calendarType: "monthly" | "445" = "monthly"): Promise<any> {
    return this.uow.runInTransaction(async (txUow, tx) => {
      const fyRepo = txUow.getRepository<any>("fiscalYears", tx);
      const periodRepo = txUow.getRepository<any>("accountingPeriods", tx);

      // Verify no duplicate year
      const existing = await tx.select().from(schema.fiscalYears).where(eq(schema.fiscalYears.year, year)).limit(1);
      if (existing.length > 0) {
        throw new BusinessRuleException("DuplicateFiscalYear", `Fiscal year ${year} already exists.`);
      }

      const fy = await fyRepo.create({
        year,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: "open",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      if (calendarType === "monthly") {
        const start = new Date(startDate);
        for (let i = 1; i <= 12; i++) {
          const pStart = new Date(start.getFullYear(), start.getMonth() + i - 1, 1);
          const pEnd = new Date(start.getFullYear(), start.getMonth() + i, 0, 23, 59, 59, 999);
          const monthName = pStart.toLocaleString("en-US", { month: "long" });

          await periodRepo.create({
            fiscalYearId: fy.id,
            periodNumber: i,
            name: `${monthName} ${pStart.getFullYear()}`,
            startDate: pStart,
            endDate: pEnd,
            status: "open",
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      } else {
        // 4-4-5 Distribution (4 weeks, 4 weeks, 5 weeks repeatable)
        let currentStart = new Date(startDate);
        const pattern = [4, 4, 5];
        for (let i = 1; i <= 12; i++) {
          const weeks = pattern[(i - 1) % 3];
          const pStart = new Date(currentStart);
          const pEnd = new Date(currentStart);
          pEnd.setDate(pEnd.getDate() + weeks * 7);
          pEnd.setHours(23, 59, 59, 999);

          await periodRepo.create({
            fiscalYearId: fy.id,
            periodNumber: i,
            name: `P${i} (Fiscal ${year})`,
            startDate: pStart,
            endDate: pEnd,
            status: "open",
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          currentStart = new Date(pEnd.getTime() + 1);
        }
      }

      this.logger.info(`Fiscal year ${year} initialized successfully with 12 ${calendarType} periods.`);
      return fy;
    });
  }

  /**
   * Fetch all fiscal years
   */
  public async getFiscalYears(): Promise<any[]> {
    const fyRepo = this.uow.getRepository<any>("fiscalYears");
    return fyRepo.findAll();
  }

  /**
   * Fetch accounting periods
   */
  public async getAccountingPeriods(fiscalYearId?: number): Promise<any[]> {
    const periodsRepo = this.uow.getRepository<any>("accountingPeriods");
    const all = await periodsRepo.findAll();
    if (fiscalYearId) {
      return all.filter((p: any) => p.fiscalYearId === fiscalYearId);
    }
    return all.sort((a: any, b: any) => a.periodNumber - b.periodNumber);
  }

  /**
   * Update individual Period Status (Reopen / soft-close / lock) with auditing
   */
  public async updatePeriodStatus(periodId: number, status: "open" | "soft_closed" | "closed" | "archived", userId: number, reason: string): Promise<any> {
    return this.uow.runInTransaction(async (txUow, tx) => {
      const periodRepo = txUow.getRepository<any>("accountingPeriods", tx);
      const auditRepo = txUow.getRepository<any>("accountingLockAuditLogs", tx);

      const period = await periodRepo.findById(periodId);
      if (!period) {
        throw new NotFoundException("AccountingPeriod", periodId);
      }

      const oldStatus = period.status;
      await periodRepo.update(periodId, {
        status,
        updatedAt: new Date(),
      });

      await auditRepo.create({
        periodId,
        action: status === "open" ? "reopen" : (status === "soft_closed" ? "soft_close" : "lock"),
        performedByUserId: userId,
        reason,
        metadata: JSON.stringify({ oldStatus, newStatus: status }),
        createdAt: new Date(),
      });

      this.logger.info(`Accounting Period ${periodId} status updated from ${oldStatus} to ${status} by User ${userId}`);
      return { periodId, oldStatus, newStatus: status };
    });
  }

  /**
   * Month-end close workflow for a given period
   */
  public async closeAccountingPeriod(periodId: number, userId: number, notes?: string): Promise<any> {
    return this.uow.runInTransaction(async (txUow, tx) => {
      const periodRepo = txUow.getRepository<any>("accountingPeriods", tx);
      const closeRepo = txUow.getRepository<any>("fiscalCloseRuns", tx);

      const period = await periodRepo.findById(periodId);
      if (!period) {
        throw new NotFoundException("AccountingPeriod", periodId);
      }

      if (period.status === "closed" || period.status === "archived") {
        throw new BusinessRuleException("PeriodAlreadyClosed", `Accounting period is already closed.`);
      }

      // Validate trial balance is balanced before closing
      const trialBalance = await this.getTrialBalance({
        startDate: period.startDate,
        endDate: period.endDate,
      });

      if (!trialBalance.balanced) {
        throw new BusinessRuleException(
          "TrialBalanceNotBalanced",
          `Cannot close accounting period: General ledger trial balance is out of balance. Debits: $${trialBalance.totalDebits}, Credits: $${trialBalance.totalCredits} (Variance: $${Math.abs(trialBalance.totalDebits - trialBalance.totalCredits).toFixed(2)}).`
        );
      }

      // Lock/Close the period
      await periodRepo.update(periodId, {
        status: "closed",
        updatedAt: new Date(),
      });

      const closeRunRecord = await closeRepo.create({
        periodId,
        fiscalYearId: period.fiscalYearId,
        runType: "month_end",
        status: "success",
        runDate: new Date(),
        performedByUserId: userId,
        notes: notes || `Acme Month-End Close for Period '${period.name}'`,
        createdAt: new Date(),
      });

      this.logger.info(`Month-End close succeeded for period ${periodId} '${period.name}'.`);
      return { period, closeRun: closeRunRecord };
    });
  }

  /**
   * Year-end close workflow: Rolls temporary accounts into Retained Earnings (3010)
   */
  public async closeFiscalYear(fiscalYearId: number, userId: number, notes?: string): Promise<any> {
    return this.uow.runInTransaction(async (txUow, tx) => {
      const fyRepo = txUow.getRepository<any>("fiscalYears", tx);
      const periodRepo = txUow.getRepository<any>("accountingPeriods", tx);
      const closeRepo = txUow.getRepository<any>("fiscalCloseRuns", tx);

      const fy = await fyRepo.findById(fiscalYearId);
      if (!fy) {
        throw new NotFoundException("FiscalYear", fiscalYearId);
      }

      if (fy.status === "closed") {
        throw new BusinessRuleException("FiscalYearAlreadyClosed", `Fiscal year is already closed.`);
      }

      // Close all individual periods in this fiscal year
      const periods = await tx.select().from(schema.accountingPeriods).where(eq(schema.accountingPeriods.fiscalYearId, fiscalYearId));
      for (const p of periods) {
        if (p.status !== "closed" && p.status !== "archived") {
          await periodRepo.update(p.id, {
            status: "closed",
            updatedAt: new Date(),
          });

          await closeRepo.create({
            periodId: p.id,
            fiscalYearId: fy.id,
            runType: "month_end",
            status: "success",
            runDate: new Date(),
            performedByUserId: userId,
            notes: "Closed automatically during Year-End close sequence",
            createdAt: new Date(),
          });
        }
      }

      // Retrieve Profit & Loss Statement for the whole Fiscal Year
      const pl = await this.getProfitLossStatement({
        startDate: fy.startDate,
        endDate: fy.endDate,
      });

      const netIncome = pl.netIncome;

      // Construct year-end closing entry lines
      const closingLines: JournalEntryLineDto[] = [];

      // Revenue offsetting entries
      for (const rev of pl.revenues) {
        if (rev.balance !== 0) {
          closingLines.push({
            accountCode: rev.code,
            accountType: "revenue",
            accountName: rev.name,
            debit: rev.balance > 0 ? rev.balance : 0,
            credit: rev.balance < 0 ? Math.abs(rev.balance) : 0,
          });
        }
      }

      // Expense offsetting entries
      for (const exp of pl.expenses) {
        if (exp.balance !== 0) {
          closingLines.push({
            accountCode: exp.code,
            accountType: "expenses",
            accountName: exp.name,
            debit: exp.balance < 0 ? Math.abs(exp.balance) : 0,
            credit: exp.balance > 0 ? exp.balance : 0,
          });
        }
      }

      // Retained Earnings Roll-Forward entry
      if (netIncome !== 0) {
        closingLines.push({
          accountCode: "3010",
          accountType: "equity",
          accountName: "Retained Earnings",
          debit: netIncome < 0 ? Math.abs(netIncome) : 0, // Debited if loss
          credit: netIncome > 0 ? netIncome : 0, // Credited if profit
        });
      }

      let entryId: number | null = null;
      if (closingLines.length > 0) {
        const closedJe = await this.postJournalEntry({
          companyId: 1, // Acme Corporation tenant
          storeId: null, // HQ central journal
          description: `Year-End closing journal entry rolling forward net profit of $${netIncome.toFixed(2)} to Retained Earnings`,
          referenceType: "year_end_close",
          referenceId: fy.id,
          lines: closingLines,
        }, txUow, tx);

        if (closedJe && closedJe.length > 0) {
          entryId = closedJe[0].id;
        }
      }

      // Complete closing of fiscal year
      await fyRepo.update(fiscalYearId, {
        status: "closed",
        updatedAt: new Date(),
      });

      const closeRunRecord = await closeRepo.create({
        periodId: null,
        fiscalYearId,
        runType: "year_end",
        status: "success",
        runDate: new Date(),
        performedByUserId: userId,
        retainedEarningsEntryId: entryId,
        notes: notes || `Fiscal Year ${fy.year} Year-End Close Completed`,
        createdAt: new Date(),
      });

      this.logger.info(`Fiscal year ${fy.year} successfully closed. Retained earnings roll-forward complete. Net income closed: $${netIncome}`);
      return { fiscalYear: fy, closeRun: closeRunRecord, closedNetIncome: netIncome };
    });
  }

  /**
   * Fetch Lock Audit Logs
   */
  public async getPeriodLockAuditLogs(periodId?: number): Promise<any[]> {
    const logsRepo = this.uow.getRepository<any>("accountingLockAuditLogs");
    const all = await logsRepo.findAll();
    if (periodId) {
      return all.filter((l: any) => l.periodId === periodId);
    }
    return all.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Fetch Close Runs
   */
  public async getFiscalCloseRuns(): Promise<any[]> {
    const closeRepo = this.uow.getRepository<any>("fiscalCloseRuns");
    const all = await closeRepo.findAll();
    return all.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}
