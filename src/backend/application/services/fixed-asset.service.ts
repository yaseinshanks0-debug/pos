// src/backend/application/services/fixed-asset.service.ts

import { and, eq, gte, lte, sql, desc, between } from "drizzle-orm";
import * as schema from "../../../db/schema.ts";
import { db } from "../../../db/index.ts";
import { IUnitOfWork } from "../ports/unit-of-work.interface.ts";
import { ILogger } from "../ports/logger.interface.ts";
import { AccountingService } from "./accounting.service.ts";
import { NotFoundException, BusinessRuleException } from "../../domain/exceptions.ts";

export interface CreateAssetCategoryDto {
  companyId: number;
  code: string;
  name: string;
  depreciationMethod: "straight_line" | "declining_balance" | "units_of_production";
  usefulLifeMonths: number;
  decliningBalanceRate?: number;
  assetGlAccount: string;
  depreciationExpenseGlAccount: string;
  accumulatedDepreciationGlAccount: string;
}

export interface AcquireAssetDto {
  companyId: number;
  storeId: number;
  categoryCode: string;
  assetCode: string;
  name: string;
  description?: string;
  acquisitionDate: string | Date;
  acquisitionCost: number;
  salvageValue?: number;
  depreciationMethod: "straight_line" | "declining_balance" | "units_of_production";
  usefulLifeMonths: number;
  decliningBalanceRate?: number;
  totalUnitsExpected?: number;
  assetGlAccount: string;
  depreciationExpenseGlAccount: string;
  accumulatedDepreciationGlAccount: string;
  paymentMethod: "cash" | "credit";
  bankAccountId?: number; // required if cash
  vendorId?: number; // required if credit
  currencyCode?: string;
  exchangeRate?: number;
}

export interface DisposeAssetDto {
  assetId: number;
  disposalDate: string | Date;
  disposalPrice: number;
  disposalType: "sale" | "scrap" | "write_off";
  bankAccountId?: number; // required if sale price > 0 and cash
  customerId?: number; // required if sale on credit
}

export interface TransferAssetDto {
  assetId: number;
  toStoreId: number;
  transferDate: string | Date;
  reason: string;
  createdById?: number;
}

export interface ImpairAssetDto {
  assetId: number;
  impairmentAmount: number;
  impairmentDate: string | Date;
  reason: string;
  createdById?: number;
}

export interface RevalueAssetDto {
  assetId: number;
  revaluationDate: string | Date;
  newMarketValue: number;
  reason: string;
  createdById?: number;
}

export class FixedAssetService {
  constructor(
    private readonly uow: IUnitOfWork,
    private readonly logger: ILogger,
    private readonly accountingService: AccountingService
  ) {}

  // =========================================================================
  // 1. ASSET CATEGORIES
  // =========================================================================

  public async createCategory(dto: CreateAssetCategoryDto): Promise<any> {
    this.logger.info(`Creating asset category: ${dto.code} - ${dto.name}`);
    return this.uow.runInTransaction(async (txUow, tx) => {
      const catRepo = txUow.getRepository<any>("fixedAssetCategories", tx);
      
      const existing = await tx
        .select()
        .from(schema.fixedAssetCategories)
        .where(
          and(
            eq(schema.fixedAssetCategories.companyId, dto.companyId),
            eq(schema.fixedAssetCategories.code, dto.code)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        throw new BusinessRuleException("CATEGORY_EXISTS", `Category with code ${dto.code} already exists for this company.`);
      }

      return catRepo.create({
        companyId: dto.companyId,
        code: dto.code,
        name: dto.name,
        depreciationMethod: dto.depreciationMethod,
        usefulLifeMonths: dto.usefulLifeMonths,
        decliningBalanceRate: dto.decliningBalanceRate ? String(dto.decliningBalanceRate) : null,
        assetGlAccount: dto.assetGlAccount,
        depreciationExpenseGlAccount: dto.depreciationExpenseGlAccount,
        accumulatedDepreciationGlAccount: dto.accumulatedDepreciationGlAccount,
      });
    });
  }

  public async getCategories(companyId: number): Promise<any[]> {
    const records = await this.uow.getRepository<any>("fixedAssetCategories").findAll();
    return records.filter((r: any) => r.companyId === companyId);
  }

  // =========================================================================
  // 2. ASSET ACQUISITION
  // =========================================================================

  public async acquireAsset(dto: AcquireAssetDto): Promise<any> {
    this.logger.info(`Acquiring Fixed Asset: ${dto.assetCode} - ${dto.name}`);
    const acqDate = new Date(dto.acquisitionDate);

    // Verify accounting period lock
    await this.verifyPeriodIsNotLocked(acqDate, dto.companyId);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const assetRepo = txUow.getRepository<any>("fixedAssets", tx);
      const auditRepo = txUow.getRepository<any>("fixedAssetAuditLogs", tx);

      // Check unique assetCode per company
      const existing = await tx
        .select()
        .from(schema.fixedAssets)
        .where(
          and(
            eq(schema.fixedAssets.companyId, dto.companyId),
            eq(schema.fixedAssets.assetCode, dto.assetCode)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        throw new BusinessRuleException("ASSET_EXISTS", `Asset with code ${dto.assetCode} already registered for this company.`);
      }

      const cost = Number(dto.acquisitionCost);
      const salvage = Number(dto.salvageValue || 0);
      if (cost <= salvage) {
        throw new BusinessRuleException("INVALID_SALVAGE", "Acquisition cost must be strictly greater than the salvage value.");
      }

      const curCode = dto.currencyCode || "USD";
      const exRate = Number(dto.exchangeRate || 1.0);
      const baseCost = cost * exRate;

      // 1. Post GL Acquisition Journal Entry
      let creditAccount = "2010"; // Default to AP
      let referenceType = "purchase";
      let referenceId: number | undefined;

      if (dto.paymentMethod === "cash") {
        if (!dto.bankAccountId) {
          throw new BusinessRuleException("MISSING_BANK", "Bank Account ID is required for cash acquisition.");
        }
        const bank = await txUow.getRepository<any>("bankAccounts", tx).findById(dto.bankAccountId);
        if (!bank) {
          throw new NotFoundException("BankAccount", dto.bankAccountId);
        }
        creditAccount = bank.ledgerAccountCode;
        referenceType = "payment";
        referenceId = dto.bankAccountId;

        // Deduct from bank account balance
        const nextBalance = Number(bank.balance) - cost; // assuming cash outflow matches transaction cost
        await txUow.getRepository<any>("bankAccounts", tx).update(bank.id, {
          balance: String(nextBalance.toFixed(2)),
          updatedAt: new Date()
        });
      } else {
        if (!dto.vendorId) {
          throw new BusinessRuleException("MISSING_VENDOR", "Vendor ID is required for credit acquisition.");
        }
        const vendor = await txUow.getRepository<any>("vendors", tx).findById(dto.vendorId);
        if (!vendor) {
          throw new NotFoundException("Vendor", dto.vendorId);
        }
        referenceType = "vendor_invoice";
        // Create an official vendor invoice to ensure AP integration
        const viRepo = txUow.getRepository<any>("vendorInvoices", tx);
        const invoice = await viRepo.create({
          companyId: dto.companyId,
          vendorId: dto.vendorId,
          invoiceNumber: `FA-ACQ-${dto.assetCode}`,
          invoiceDate: acqDate,
          dueDate: new Date(acqDate.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days due
          currencyCode: curCode,
          exchangeRate: String(exRate.toFixed(6)),
          currencyAmount: String(cost.toFixed(2)),
          totalAmount: String(baseCost.toFixed(2)),
          paidAmount: "0.00",
          status: "posted",
          apControlAccountCode: dto.assetGlAccount, // or creditAccount? In general ledger, AP control account code is 2010.
          createdAt: acqDate,
          updatedAt: acqDate,
        });
        referenceId = invoice.id;
        creditAccount = "2010";
      }

      const jeLines = [
        {
          accountCode: dto.assetGlAccount,
          accountType: "assets" as const,
          accountName: `Fixed Assets - Cost`,
          debit: baseCost,
          credit: 0,
        },
        {
          accountCode: creditAccount,
          accountType: (creditAccount === "2010" ? "liabilities" : "assets") as any,
          accountName: creditAccount === "2010" ? "Accounts Payable Control" : "Bank Operating Account",
          debit: 0,
          credit: baseCost,
        }
      ];

      await this.accountingService.postJournalEntry(
        {
          companyId: dto.companyId,
          storeId: dto.storeId,
          description: `Acquisition of Fixed Asset ${dto.assetCode} - ${dto.name}`,
          referenceType,
          referenceId,
          createdAt: acqDate,
          lines: jeLines,
        },
        txUow,
        tx
      );

      // 2. Create Asset Record
      const asset = await assetRepo.create({
        companyId: dto.companyId,
        storeId: dto.storeId,
        categoryCode: dto.categoryCode,
        assetCode: dto.assetCode,
        name: dto.name,
        description: dto.description || null,
        acquisitionDate: acqDate,
        acquisitionCost: String(baseCost.toFixed(2)),
        salvageValue: String(salvage.toFixed(2)),
        depreciationMethod: dto.depreciationMethod,
        usefulLifeMonths: dto.usefulLifeMonths,
        decliningBalanceRate: dto.decliningBalanceRate ? String(dto.decliningBalanceRate) : null,
        totalUnitsExpected: dto.totalUnitsExpected ? String(dto.totalUnitsExpected) : null,
        unitsProducedToDate: "0.00",
        accumulatedDepreciation: "0.00",
        netBookValue: String(baseCost.toFixed(2)),
        status: "active",
        assetGlAccount: dto.assetGlAccount,
        depreciationExpenseGlAccount: dto.depreciationExpenseGlAccount,
        accumulatedDepreciationGlAccount: dto.accumulatedDepreciationGlAccount,
        currencyCode: curCode,
        exchangeRate: String(exRate.toFixed(6)),
        createdAt: acqDate,
        updatedAt: acqDate,
      });

      // 3. Create Audit Record
      await auditRepo.create({
        assetId: asset.id,
        eventType: "acquisition",
        description: `Asset acquired for ${curCode} ${cost.toFixed(2)} (Base Amount: USD ${baseCost.toFixed(2)}).`,
        newValue: JSON.stringify(asset),
        createdAt: new Date(),
      });

      return asset;
    });
  }

  // =========================================================================
  // 3. MONTHLY DEPRECIATION SCHEDULER
  // =========================================================================

  public async runMonthlyDepreciation(companyId: number, storeId?: number, date?: Date): Promise<any[]> {
    const runDate = date ? new Date(date) : new Date();
    this.logger.info(`Running Monthly Depreciation scheduler as of ${runDate.toISOString().split('T')[0]}`);

    // Verify period is open
    await this.verifyPeriodIsNotLocked(runDate, companyId);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const assetRepo = txUow.getRepository<any>("fixedAssets", tx);
      const logRepo = txUow.getRepository<any>("fixedAssetDepreciationLogs", tx);
      const auditRepo = txUow.getRepository<any>("fixedAssetAuditLogs", tx);

      // Find all active assets for the company
      let assetsQuery = tx
        .select()
        .from(schema.fixedAssets)
        .where(
          and(
            eq(schema.fixedAssets.companyId, companyId),
            eq(schema.fixedAssets.status, "active")
          )
        );

      if (storeId) {
        assetsQuery = tx
          .select()
          .from(schema.fixedAssets)
          .where(
            and(
              eq(schema.fixedAssets.companyId, companyId),
              eq(schema.fixedAssets.storeId, storeId),
              eq(schema.fixedAssets.status, "active")
            )
          );
      }

      const activeAssets = await assetsQuery;
      const processedLogs = [];

      // Determine month boundary
      const periodStart = new Date(runDate.getFullYear(), runDate.getMonth(), 1);
      const periodEnd = new Date(runDate.getFullYear(), runDate.getMonth() + 1, 0, 23, 59, 59);

      for (const asset of activeAssets) {
        // Prevent duplicate depreciation for the same period
        const existingLog = await tx
          .select()
          .from(schema.fixedAssetDepreciationLogs)
          .where(
            and(
              eq(schema.fixedAssetDepreciationLogs.assetId, asset.id),
              between(schema.fixedAssetDepreciationLogs.periodEndDate, periodStart, periodEnd)
            )
          )
          .limit(1);

        if (existingLog.length > 0) {
          this.logger.warn(`Asset ${asset.assetCode} already depreciated for ${runDate.getMonth() + 1}/${runDate.getFullYear()}. Skipping.`);
          continue;
        }

        const cost = Number(asset.acquisitionCost);
        const salvage = Number(asset.salvageValue);
        const accum = Number(asset.accumulatedDepreciation);
        const nbv = Number(asset.netBookValue);

        let depAmt = 0;

        if (asset.depreciationMethod === "straight_line") {
          depAmt = (cost - salvage) / asset.usefulLifeMonths;
          const remainingDepreciable = (cost - salvage) - accum;
          if (depAmt > remainingDepreciable) {
            depAmt = remainingDepreciable;
          }
        } else if (asset.depreciationMethod === "declining_balance") {
          const dbRate = Number(asset.decliningBalanceRate || 0) / 100;
          depAmt = nbv * dbRate / 12;
          const maxDepreciable = nbv - salvage;
          if (depAmt > maxDepreciable) {
            depAmt = maxDepreciable;
          }
        } else if (asset.depreciationMethod === "units_of_production") {
          // In real ERP, this depends on units input for the period
          // For scheduler, we can read default/period usage or assume a mock/passed value
          // Let's assume standard units of production reading period value, defaulting to 100 units if not provided
          const unitsInPeriod = 100; 
          const totalExpected = Number(asset.totalUnitsExpected || 10000);
          depAmt = (cost - salvage) * (unitsInPeriod / totalExpected);
          const remainingDepreciable = (cost - salvage) - accum;
          if (depAmt > remainingDepreciable) {
            depAmt = remainingDepreciable;
          }
        }

        if (depAmt < 0.01) {
          // Check if NBV equals salvage value, if so, fully depreciated
          if (nbv <= salvage) {
            await assetRepo.update(asset.id, {
              status: "fully_depreciated",
              updatedAt: runDate,
            });
            await auditRepo.create({
              assetId: asset.id,
              eventType: "depreciation",
              description: "Asset fully depreciated (NBV equals Salvage Value). Status changed to fully_depreciated.",
              createdAt: new Date(),
            });
          }
          continue;
        }

        const nextAccum = accum + depAmt;
        const nextNbv = cost - nextAccum;
        const isFullyDep = nextNbv <= salvage + 0.01;

        // Post Journal Entry
        await this.accountingService.postJournalEntry(
          {
            companyId: companyId,
            storeId: asset.storeId,
            description: `Depreciation Posting for Asset ${asset.assetCode} - Period Ending ${runDate.toISOString().split('T')[0]}`,
            referenceType: "adjustment",
            referenceId: asset.id,
            createdAt: runDate,
            lines: [
              {
                accountCode: asset.depreciationExpenseGlAccount,
                accountType: "expenses" as const,
                accountName: "Depreciation Expense",
                debit: depAmt,
                credit: 0,
              },
              {
                accountCode: asset.accumulatedDepreciationGlAccount,
                accountType: "assets" as const, // contra-asset
                accountName: "Accumulated Depreciation",
                debit: 0,
                credit: depAmt,
              }
            ]
          },
          txUow,
          tx
        );

        // Update Asset
        const updatedAsset = await assetRepo.update(asset.id, {
          accumulatedDepreciation: String(nextAccum.toFixed(2)),
          netBookValue: String(nextNbv.toFixed(2)),
          status: isFullyDep ? "fully_depreciated" : "active",
          updatedAt: runDate,
        });

        // Write Log
        const log = await logRepo.create({
          assetId: asset.id,
          periodStartDate: periodStart,
          periodEndDate: periodEnd,
          depreciationAmount: String(depAmt.toFixed(2)),
          accumulatedDepreciationAfter: String(nextAccum.toFixed(2)),
          netBookValueAfter: String(nextNbv.toFixed(2)),
          unitsProducedInPeriod: asset.depreciationMethod === "units_of_production" ? "100.00" : null,
          createdAt: new Date(),
        });

        // Write Audit
        await auditRepo.create({
          assetId: asset.id,
          eventType: "depreciation",
          description: `Depreciation of USD ${depAmt.toFixed(2)} recorded. Net Book Value = USD ${nextNbv.toFixed(2)}.`,
          oldValue: JSON.stringify(asset),
          newValue: JSON.stringify(updatedAsset),
          createdAt: new Date(),
        });

        processedLogs.push(log);
      }

      return processedLogs;
    });
  }

  // =========================================================================
  // 4. ASSET DISPOSAL
  // =========================================================================

  public async disposeAsset(dto: DisposeAssetDto): Promise<any> {
    this.logger.info(`Disposing Fixed Asset ID: ${dto.assetId}`);
    const dispDate = new Date(dto.disposalDate);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const assetRepo = txUow.getRepository<any>("fixedAssets", tx);
      const auditRepo = txUow.getRepository<any>("fixedAssetAuditLogs", tx);

      const asset = await assetRepo.findById(dto.assetId);
      if (!asset) {
        throw new NotFoundException("FixedAsset", dto.assetId);
      }
      if (asset.status === "disposed") {
        throw new BusinessRuleException("ALREADY_DISPOSED", "Asset has already been disposed.");
      }

      // Verify lock
      await this.verifyPeriodIsNotLocked(dispDate, asset.companyId);

      const cost = Number(asset.acquisitionCost);
      const accum = Number(asset.accumulatedDepreciation);
      const nbv = Number(asset.netBookValue);
      const disposalPrice = Number(dto.disposalPrice);
      const gainLoss = disposalPrice - nbv;

      // GL Postings to clear asset historical cost and accumulated depreciation
      const jeLines = [];

      // 1. Debit Accumulated Depreciation to clear carrying balance
      if (accum > 0) {
        jeLines.push({
          accountCode: asset.accumulatedDepreciationGlAccount,
          accountType: "assets" as const,
          accountName: "Accumulated Depreciation",
          debit: accum,
          credit: 0,
        });
      }

      // 2. Credit Asset GL Account to clear original historical cost
      jeLines.push({
        accountCode: asset.assetGlAccount,
        accountType: "assets" as const,
        accountName: "Fixed Assets - Cost",
        debit: 0,
        credit: cost,
      });

      // 3. Debit Bank (if sale cash) or AR (if sale credit) or Gain/Loss on Disposal
      if (disposalPrice > 0) {
        let receiveAccount = "1010"; // Default Cash
        if (dto.bankAccountId) {
          const bank = await txUow.getRepository<any>("bankAccounts", tx).findById(dto.bankAccountId);
          if (bank) {
            receiveAccount = bank.ledgerAccountCode;
            // Add to bank account balance
            const nextBalance = Number(bank.balance) + disposalPrice;
            await txUow.getRepository<any>("bankAccounts", tx).update(bank.id, {
              balance: String(nextBalance.toFixed(2)),
              updatedAt: new Date()
            });
          }
        } else if (dto.customerId) {
          receiveAccount = "1200"; // Accounts Receivable
          // Create customer invoice for the sale
          const custRepo = txUow.getRepository<any>("customers", tx);
          const customer = await custRepo.findById(dto.customerId);
          if (customer) {
            // Update customer balance
            const nextBalance = Number(customer.balance || 0) + disposalPrice;
            await custRepo.update(customer.id, {
              balance: String(nextBalance.toFixed(2)),
              updatedAt: new Date(),
            });

            // Log customer invoice
            const ciRepo = txUow.getRepository<any>("customerInvoices", tx);
            await ciRepo.create({
              companyId: asset.companyId,
              customerId: dto.customerId,
              invoiceNumber: `FA-DISP-${asset.assetCode}`,
              invoiceDate: dispDate,
              dueDate: new Date(dispDate.getTime() + 30 * 24 * 60 * 60 * 1000),
              currencyCode: "USD",
              exchangeRate: "1.000000",
              currencyAmount: String(disposalPrice.toFixed(2)),
              totalAmount: String(disposalPrice.toFixed(2)),
              paidAmount: "0.00",
              status: "posted",
              arControlAccountCode: "1200",
              createdAt: dispDate,
              updatedAt: dispDate,
            });
          }
        }

        jeLines.push({
          accountCode: receiveAccount,
          accountType: (receiveAccount === "1200" ? "assets" : "assets") as any,
          accountName: receiveAccount === "1200" ? "Accounts Receivable" : "Cash / Bank Operating Account",
          debit: disposalPrice,
          credit: 0,
        });
      }

      // 4. Gain/Loss double entry posting to 8030
      if (Math.abs(gainLoss) > 0.005) {
        if (gainLoss > 0) {
          // Gain on disposal: Credit 8030
          jeLines.push({
            accountCode: "8030",
            accountType: "revenue" as const,
            accountName: "Gain/Loss on Asset Disposal",
            debit: 0,
            credit: Math.abs(gainLoss),
          });
        } else {
          // Loss on disposal: Debit 8030
          jeLines.push({
            accountCode: "8030",
            accountType: "revenue" as const,
            accountName: "Gain/Loss on Asset Disposal",
            debit: Math.abs(gainLoss),
            credit: 0,
          });
        }
      }

      // Post General Ledger journal entry
      await this.accountingService.postJournalEntry(
        {
          companyId: asset.companyId,
          storeId: asset.storeId,
          description: `Disposal of Asset ${asset.assetCode} - ${asset.name} (${dto.disposalType})`,
          referenceType: "adjustment",
          referenceId: asset.id,
          createdAt: dispDate,
          lines: jeLines,
        },
        txUow,
        tx
      );

      // Update asset record
      const updatedAsset = await assetRepo.update(asset.id, {
        status: "disposed",
        disposalDate: dispDate,
        disposalPrice: String(disposalPrice.toFixed(2)),
        disposalGainLoss: String(gainLoss.toFixed(2)),
        disposalType: dto.disposalType,
        netBookValue: "0.00",
        updatedAt: dispDate,
      });

      // Write Audit log
      await auditRepo.create({
        assetId: asset.id,
        eventType: "disposal",
        description: `Asset disposed via ${dto.disposalType} for USD ${disposalPrice.toFixed(2)}. NBV was USD ${nbv.toFixed(2)}. Net Gain/Loss = USD ${gainLoss.toFixed(2)}.`,
        oldValue: JSON.stringify(asset),
        newValue: JSON.stringify(updatedAsset),
        createdAt: new Date(),
      });

      return updatedAsset;
    });
  }

  // =========================================================================
  // 5. ASSET TRANSFER BETWEEN STORES
  // =========================================================================

  public async transferAsset(dto: TransferAssetDto): Promise<any> {
    this.logger.info(`Transferring Asset ID: ${dto.assetId} to Store ID: ${dto.toStoreId}`);
    const transferDate = new Date(dto.transferDate);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const assetRepo = txUow.getRepository<any>("fixedAssets", tx);
      const mvtRepo = txUow.getRepository<any>("fixedAssetMovements", tx);
      const auditRepo = txUow.getRepository<any>("fixedAssetAuditLogs", tx);

      const asset = await assetRepo.findById(dto.assetId);
      if (!asset) {
        throw new NotFoundException("FixedAsset", dto.assetId);
      }
      if (asset.status === "disposed") {
        throw new BusinessRuleException("ALREADY_DISPOSED", "Cannot transfer a disposed asset.");
      }

      // Verify lock
      await this.verifyPeriodIsNotLocked(transferDate, asset.companyId);

      const originalStoreId = asset.storeId;
      if (originalStoreId === dto.toStoreId) {
        throw new BusinessRuleException("SAME_STORE", "Asset is already situated at the target store.");
      }

      // Log movement
      const movement = await mvtRepo.create({
        assetId: asset.id,
        fromStoreId: originalStoreId,
        toStoreId: dto.toStoreId,
        transferDate,
        reason: dto.reason,
        createdById: dto.createdById || null,
        createdAt: new Date(),
      });

      // Update asset store
      const updatedAsset = await assetRepo.update(asset.id, {
        storeId: dto.toStoreId,
        updatedAt: transferDate,
      });

      // Write Audit log
      await auditRepo.create({
        assetId: asset.id,
        eventType: "transfer",
        description: `Asset transferred from Store ID ${originalStoreId} to Store ID ${dto.toStoreId}. Reason: ${dto.reason}.`,
        oldValue: JSON.stringify(asset),
        newValue: JSON.stringify(updatedAsset),
        createdAt: new Date(),
      });

      return updatedAsset;
    });
  }

  // =========================================================================
  // 6. ASSET IMPAIRMENT
  // =========================================================================

  public async impairAsset(dto: ImpairAssetDto): Promise<any> {
    this.logger.info(`Impairing Asset ID: ${dto.assetId} by amount: ${dto.impairmentAmount}`);
    const impDate = new Date(dto.impairmentDate);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const assetRepo = txUow.getRepository<any>("fixedAssets", tx);
      const auditRepo = txUow.getRepository<any>("fixedAssetAuditLogs", tx);

      const asset = await assetRepo.findById(dto.assetId);
      if (!asset) {
        throw new NotFoundException("FixedAsset", dto.assetId);
      }
      if (asset.status === "disposed") {
        throw new BusinessRuleException("ALREADY_DISPOSED", "Cannot impair a disposed asset.");
      }

      // Verify lock
      await this.verifyPeriodIsNotLocked(impDate, asset.companyId);

      const nbv = Number(asset.netBookValue);
      const salvage = Number(asset.salvageValue);
      const impairment = Number(dto.impairmentAmount);

      if (impairment <= 0) {
        throw new BusinessRuleException("INVALID_IMPAIRMENT", "Impairment amount must be positive.");
      }
      if (nbv - impairment < salvage) {
        throw new BusinessRuleException("IMPAIRMENT_LIMIT", "Impairment cannot reduce the Net Book Value below the salvage value.");
      }

      const nextAccum = Number(asset.accumulatedDepreciation) + impairment;
      const nextNbv = nbv - impairment;

      // Post GL Impairment Double-Entry
      await this.accountingService.postJournalEntry(
        {
          companyId: asset.companyId,
          storeId: asset.storeId,
          description: `Impairment Loss on Asset ${asset.assetCode} - Reason: ${dto.reason}`,
          referenceType: "adjustment",
          referenceId: asset.id,
          createdAt: impDate,
          lines: [
            {
              accountCode: "5060", // Impairment Expense
              accountType: "expenses" as const,
              accountName: "Impairment of Fixed Assets",
              debit: impairment,
              credit: 0,
            },
            {
              accountCode: asset.accumulatedDepreciationGlAccount,
              accountType: "assets" as const,
              accountName: "Accumulated Depreciation",
              debit: 0,
              credit: impairment,
            }
          ]
        },
        txUow,
        tx
      );

      // Update Asset
      const updatedAsset = await assetRepo.update(asset.id, {
        accumulatedDepreciation: String(nextAccum.toFixed(2)),
        netBookValue: String(nextNbv.toFixed(2)),
        status: nextNbv <= salvage + 0.01 ? "fully_depreciated" : "active",
        updatedAt: impDate,
      });

      // Write Audit log
      await auditRepo.create({
        assetId: asset.id,
        eventType: "impairment",
        description: `Impairment of USD ${impairment.toFixed(2)} recorded. New carrying NBV = USD ${nextNbv.toFixed(2)}. Reason: ${dto.reason}.`,
        oldValue: JSON.stringify(asset),
        newValue: JSON.stringify(updatedAsset),
        createdAt: new Date(),
      });

      return updatedAsset;
    });
  }

  // =========================================================================
  // 7. ASSET REVALUATION
  // =========================================================================

  public async revalueAsset(dto: RevalueAssetDto): Promise<any> {
    this.logger.info(`Revaluing Asset ID: ${dto.assetId} to market value: ${dto.newMarketValue}`);
    const revalDate = new Date(dto.revaluationDate);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const assetRepo = txUow.getRepository<any>("fixedAssets", tx);
      const auditRepo = txUow.getRepository<any>("fixedAssetAuditLogs", tx);

      const asset = await assetRepo.findById(dto.assetId);
      if (!asset) {
        throw new NotFoundException("FixedAsset", dto.assetId);
      }
      if (asset.status === "disposed") {
        throw new BusinessRuleException("ALREADY_DISPOSED", "Cannot revalue a disposed asset.");
      }

      // Verify lock
      await this.verifyPeriodIsNotLocked(revalDate, asset.companyId);

      const cost = Number(asset.acquisitionCost);
      const accum = Number(asset.accumulatedDepreciation);
      const nbv = Number(asset.netBookValue);
      const marketValue = Number(dto.newMarketValue);
      const difference = marketValue - nbv;

      if (marketValue <= 0) {
        throw new BusinessRuleException("INVALID_REVALUATION", "New market valuation must be positive.");
      }

      if (difference > 0) {
        // UPWARD Revaluation: Debit Asset Cost Account, Credit Revaluation Reserve (Equity)
        await this.accountingService.postJournalEntry(
          {
            companyId: asset.companyId,
            storeId: asset.storeId,
            description: `Upward Revaluation of Asset ${asset.assetCode} - Reason: ${dto.reason}`,
            referenceType: "adjustment",
            referenceId: asset.id,
            createdAt: revalDate,
            lines: [
              {
                accountCode: asset.assetGlAccount,
                accountType: "assets" as const,
                accountName: "Fixed Assets - Cost",
                debit: difference,
                credit: 0,
              },
              {
                accountCode: "3020", // Revaluation Reserve
                accountType: "equity" as const,
                accountName: "Revaluation Reserve",
                debit: 0,
                credit: difference,
              }
            ]
          },
          txUow,
          tx
        );

        const nextCost = cost + difference;
        const nextNbv = marketValue;

        const updatedAsset = await assetRepo.update(asset.id, {
          acquisitionCost: String(nextCost.toFixed(2)),
          netBookValue: String(nextNbv.toFixed(2)),
          updatedAt: revalDate,
        });

        await auditRepo.create({
          assetId: asset.id,
          eventType: "revaluation",
          description: `Upward asset revaluation by USD ${difference.toFixed(2)} to carrying cost of USD ${nextCost.toFixed(2)} (NBV: USD ${nextNbv.toFixed(2)}).`,
          oldValue: JSON.stringify(asset),
          newValue: JSON.stringify(updatedAsset),
          createdAt: new Date(),
        });

        return updatedAsset;
      } else {
        // DOWNWARD Revaluation: Debit Revaluation Impairment (5060) and Credit Asset Cost Account
        const downwardAmt = Math.abs(difference);
        await this.accountingService.postJournalEntry(
          {
            companyId: asset.companyId,
            storeId: asset.storeId,
            description: `Downward Revaluation of Asset ${asset.assetCode} - Reason: ${dto.reason}`,
            referenceType: "adjustment",
            referenceId: asset.id,
            createdAt: revalDate,
            lines: [
              {
                accountCode: "5060", // Impairment expense
                accountType: "expenses" as const,
                accountName: "Impairment of Fixed Assets",
                debit: downwardAmt,
                credit: 0,
              },
              {
                accountCode: asset.assetGlAccount,
                accountType: "assets" as const,
                accountName: "Fixed Assets - Cost",
                debit: 0,
                credit: downwardAmt,
              }
            ]
          },
          txUow,
          tx
        );

        const nextCost = cost - downwardAmt;
        const nextNbv = marketValue;

        const updatedAsset = await assetRepo.update(asset.id, {
          acquisitionCost: String(nextCost.toFixed(2)),
          netBookValue: String(nextNbv.toFixed(2)),
          updatedAt: revalDate,
        });

        await auditRepo.create({
          assetId: asset.id,
          eventType: "revaluation",
          description: `Downward asset revaluation by USD ${downwardAmt.toFixed(2)} to carrying cost of USD ${nextCost.toFixed(2)} (NBV: USD ${nextNbv.toFixed(2)}).`,
          oldValue: JSON.stringify(asset),
          newValue: JSON.stringify(updatedAsset),
          createdAt: new Date(),
        });

        return updatedAsset;
      }
    });
  }

  // =========================================================================
  // 8. FIXED ASSETS REPORTS
  // =========================================================================

  public async getAssetRegister(companyId: number, filters?: any): Promise<any[]> {
    const assets = await this.uow.getRepository<any>("fixedAssets").findAll();
    return assets.filter((a: any) => {
      if (a.companyId !== companyId) return false;
      if (filters?.storeId && a.storeId !== Number(filters.storeId)) return false;
      if (filters?.status && a.status !== filters.status) return false;
      if (filters?.categoryCode && a.categoryCode !== filters.categoryCode) return false;
      return true;
    });
  }

  public async getDepreciationSchedule(companyId: number, assetId?: number): Promise<any[]> {
    const logs = await this.uow.getRepository<any>("fixedAssetDepreciationLogs").findAll();
    const assets = await this.getAssetRegister(companyId);
    const assetIds = assets.map(a => a.id);

    return logs
      .filter((l: any) => {
        if (!assetIds.includes(l.assetId)) return false;
        if (assetId && l.assetId !== assetId) return false;
        return true;
      })
      .sort((a, b) => new Date(a.periodEndDate).getTime() - new Date(b.periodEndDate).getTime());
  }

  public async getAssetMovementReport(companyId: number): Promise<any[]> {
    const movements = await this.uow.getRepository<any>("fixedAssetMovements").findAll();
    const assets = await this.getAssetRegister(companyId);
    const assetIds = assets.map(a => a.id);

    return movements.filter((m: any) => assetIds.includes(m.assetId));
  }

  public async getAssetDisposalReport(companyId: number): Promise<any[]> {
    const assets = await this.getAssetRegister(companyId);
    return assets.filter((a: any) => a.status === "disposed");
  }

  public async getAssetAuditTrail(companyId: number, assetId?: number): Promise<any[]> {
    const logs = await this.uow.getRepository<any>("fixedAssetAuditLogs").findAll();
    const assets = await this.getAssetRegister(companyId);
    const assetIds = assets.map(a => a.id);

    return logs.filter((l: any) => {
      if (!assetIds.includes(l.assetId)) return false;
      if (assetId && l.assetId !== assetId) return false;
      return true;
    });
  }

  // =========================================================================
  // UTILS
  // =========================================================================

  private async verifyPeriodIsNotLocked(date: Date, companyId: number, tx?: any): Promise<void> {
    const activeTx = tx || db;
    // Fetch locked periods for company
    const lockedPeriods = await activeTx
      .select()
      .from(schema.accountingPeriods)
      .where(
        and(
          lte(schema.accountingPeriods.startDate, date),
          gte(schema.accountingPeriods.endDate, date)
        )
      )
      .limit(1);

    if (lockedPeriods.length > 0) {
      const period = lockedPeriods[0];
      if (period.status === "closed" || period.status === "archived") {
        throw new BusinessRuleException(
          "PeriodLocked",
          `Cannot post transaction: Accounting period '${period.name}' starting ${period.startDate.toDateString()} is strictly CLOSED/LOCKED.`
        );
      }
    }
  }
}
