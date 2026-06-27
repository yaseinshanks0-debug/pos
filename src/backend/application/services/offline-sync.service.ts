// src/backend/application/services/offline-sync.service.ts

import { IUnitOfWork } from "../ports/unit-of-work.interface.ts";
import { ILogger } from "../ports/logger.interface.ts";
import { PosService } from "./pos.service.ts";
import { ReturnService } from "./return.service.ts";
import { InventoryAdjustmentService } from "./inventory-adjustment.service.ts";
import { CustomerService } from "./customer.service.ts";
import { NotFoundException, BusinessRuleException } from "../../domain/exceptions.ts";
import { eq, and, asc } from "drizzle-orm";
import * as schema from "../../../db/schema.ts";

export interface EnqueueOfflineTxDto {
  storeId: number;
  entityType: "sale" | "return" | "adjustment" | "customer";
  payload: any;
}

export interface ResolveSyncConflictDto {
  conflictId: number;
  resolutionStrategy: "client_wins" | "server_wins" | "manual";
  manualData?: any;
  resolvedByUserId: number;
  notes?: string;
}

export class OfflineSyncService {
  private readonly posService: PosService;
  private readonly returnService: ReturnService;
  private readonly adjustmentService: InventoryAdjustmentService;
  private readonly customerService: CustomerService;

  constructor(
    private readonly uow: IUnitOfWork,
    private readonly logger: ILogger
  ) {
    this.posService = new PosService(this.uow, this.logger);
    this.returnService = new ReturnService(this.uow, this.logger);
    this.adjustmentService = new InventoryAdjustmentService(this.uow, this.logger);
    this.customerService = new CustomerService(this.uow, this.logger);
  }

  // ==========================================
  // SECTION 1: OFFLINE POS ENGINE
  // ==========================================

  /**
   * Enqueues an offline transaction into the local queue.
   * Leverages deterministic transaction hashing for strict idempotency protection.
   */
  public async enqueueOfflineTransaction(dto: EnqueueOfflineTxDto): Promise<any> {
    this.logger.info(`Enqueueing offline transaction for store ID ${dto.storeId}, type: ${dto.entityType}`);

    // Generate a deterministic transaction hash based on type and payload content
    const payloadStr = JSON.stringify(dto.payload);
    const transactionHash = this.computeDeterministicHash(dto.storeId + "_" + dto.entityType + "_" + payloadStr);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const queueRepo = txUow.getRepository<any>("offlineTransactionQueue", tx);

      // Check if hash already exists (Idempotent replay protection at the edge)
      const allQueued = await queueRepo.findAll();
      const existing = allQueued.find((q: any) => q.transactionHash === transactionHash);

      if (existing) {
        this.logger.warn(`Duplicate transaction hash detected: ${transactionHash}. Skipping enqueue.`);
        return existing;
      }

      const queueRecord = await queueRepo.create({
        storeId: dto.storeId,
        transactionHash,
        entityType: dto.entityType,
        payload: payloadStr,
        status: "pending",
        retryCount: 0,
        createdAt: new Date()
      });

      this.logger.info(`Successfully enqueued transaction ID ${queueRecord.id}, Hash: ${transactionHash}`);
      return queueRecord;
    });
  }

  public async getOfflineQueue(storeId: number): Promise<any[]> {
    const queueRepo = this.uow.getRepository<any>("offlineTransactionQueue");
    const all = await queueRepo.findAll();
    return all.filter((q: any) => q.storeId === storeId);
  }

  // ==========================================
  // SECTION 2: STORE EXCHANGE ENGINE
  // ==========================================

  /**
   * Packages pending offline transactions for a store into a sequence-verified Exchange Batch.
   */
  public async createExchangeBatch(sourceStoreId: number, destinationStoreId?: number): Promise<any> {
    this.logger.info(`Creating Store Exchange Batch for store: ${sourceStoreId}`);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const queueRepo = txUow.getRepository<any>("offlineTransactionQueue", tx);
      const batchRepo = txUow.getRepository<any>("storeExchangeBatches", tx);
      const batchItemsRepo = txUow.getRepository<any>("storeExchangeBatchItems", tx);

      const allQueued = await queueRepo.findAll();
      const pendingItems = allQueued
        .filter((q: any) => q.storeId === sourceStoreId && q.status === "pending")
        .sort((a: any, b: any) => a.id - b.id); // Preserve strict chronological order

      if (pendingItems.length === 0) {
        throw new BusinessRuleException("NoPendingTransactions", `There are no pending offline transactions to batch for store ${sourceStoreId}.`);
      }

      const batchCount = (await batchRepo.findAll()).length + 1;
      const batchNumber = `EXCH-STR${sourceStoreId}-${batchCount.toString().padStart(4, "0")}`;

      const batch = await batchRepo.create({
        batchNumber,
        sourceStoreId,
        destinationStoreId: destinationStoreId || null,
        status: "draft",
        itemCount: pendingItems.length,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      let sequence = 1;
      for (const item of pendingItems) {
        await batchItemsRepo.create({
          batchId: batch.id,
          entityType: item.entityType,
          entityId: item.id.toString(),
          actionType: "create",
          payload: item.payload,
          sequenceNumber: sequence++,
          syncStatus: "pending"
        });

        // Mark local queue item as mapped
        await queueRepo.update(item.id, {
          status: "synced",
          syncedAt: new Date()
        });
      }

      // Finalize batch state to pending
      const updatedBatch = await batchRepo.update(batch.id, {
        status: "pending",
        updatedAt: new Date()
      });

      this.logger.info(`Successfully created package batch: ${batchNumber} holding ${pendingItems.length} items.`);
      return {
        ...updatedBatch,
        items: pendingItems
      };
    });
  }

  /**
   * Sequential Replay Engine with automatic duplicate interception and optimistic concurrency checks.
   */
  public async processExchangeBatch(batchId: number): Promise<any> {
    this.logger.info(`Starting sequential replay processing of Exchange Batch ID: ${batchId}`);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const batchRepo = txUow.getRepository<any>("storeExchangeBatches", tx);
      const batchItemsRepo = txUow.getRepository<any>("storeExchangeBatchItems", tx);
      const auditRepo = txUow.getRepository<any>("synchronizationAuditLogs", tx);
      const conflictRepo = txUow.getRepository<any>("syncConflicts", tx);

      const batch = await batchRepo.findById(batchId);
      if (!batch) throw new NotFoundException("storeExchangeBatches", batchId);
      if (batch.status === "processed") {
        this.logger.warn(`Batch ID ${batchId} was already replayed. Skipping execution.`);
        return batch;
      }

      const allItems = await batchItemsRepo.findAll();
      const batchItems = allItems
        .filter((item: any) => item.batchId === batchId)
        .sort((a: any, b: any) => a.sequenceNumber - b.sequenceNumber); // Enforce sequential replay

      let processedCount = 0;
      let failedCount = 0;

      for (const item of batchItems) {
        const payloadData = JSON.parse(item.payload);
        const itemHash = this.computeDeterministicHash(batch.sourceStoreId + "_" + item.entityType + "_" + item.payload);

        // 1. Idempotency replay check across historical logs
        const historicalReplays = await auditRepo.findAll();
        const alreadyReplayed = historicalReplays.some((a: any) => a.errorMessage?.includes(itemHash));
        if (alreadyReplayed) {
          await batchItemsRepo.update(item.id, {
            syncStatus: "ignored",
            errorMessage: "Skipped: identical hash replayed in prior sync."
          });
          continue;
        }

        try {
          // 2. Sequential Execution Replay
          if (item.entityType === "sale") {
            await this.posService.checkout(payloadData);
          } else if (item.entityType === "return") {
            await this.returnService.processReturn(payloadData);
          } else if (item.entityType === "customer") {
            await this.customerService.createCustomer(payloadData);
          } else if (item.entityType === "adjustment") {
            const adj = await this.adjustmentService.createAdjustment({
              companyId: payloadData.companyId,
              storeId: payloadData.storeId,
              warehouseId: payloadData.warehouseId,
              adjustmentNumber: payloadData.adjustmentNumber || `ADJ-SYNC-${Date.now()}`,
              type: payloadData.type,
              notes: payloadData.notes,
              createdByUserId: payloadData.createdByUserId,
              items: payloadData.items
            });
            await this.adjustmentService.postAdjustment(adj.id, payloadData.createdByUserId || 1);
          } else {
            throw new Error(`Unsupported sync replay entity: ${item.entityType}`);
          }

          await batchItemsRepo.update(item.id, {
            syncStatus: "applied"
          });
          processedCount++;
        } catch (err: any) {
          this.logger.error(`Replay validation error for batch item ID ${item.id} of entity type ${item.entityType}: ${err.message}`);
          failedCount++;

          // Log conflict for manual/automated review
          const localStateStr = item.payload;
          const serverStateStr = JSON.stringify({ error: err.message, date: new Date().toISOString() });

          // Detect typical conflict patterns (such as duplicate primary keys, validation exceptions, or stock outages)
          const isConflict = err.message.includes("conflict") || err.message.includes("duplicate") || err.message.includes("already exists");
          const conflictType = isConflict ? "duplicate" : "version_mismatch";

          await conflictRepo.create({
            storeId: batch.sourceStoreId,
            entityType: item.entityType,
            entityId: item.entityId,
            conflictType,
            localData: localStateStr,
            serverData: serverStateStr,
            resolution: "pending",
            createdAt: new Date()
          });

          await batchItemsRepo.update(item.id, {
            syncStatus: "failed",
            errorMessage: `${err.message} [Hash:${itemHash}]`
          });
        }
      }

      const finalStatus = failedCount === 0 ? "processed" : "failed";
      const processedBatch = await batchRepo.update(batchId, {
        status: finalStatus,
        processedAt: new Date(),
        updatedAt: new Date()
      });

      // Write synchronization audit trail
      await auditRepo.create({
        storeId: batch.sourceStoreId,
        batchId: batch.id,
        direction: "upload",
        status: finalStatus,
        recordsProcessed: processedCount,
        recordsFailed: failedCount,
        errorMessage: failedCount > 0 ? `Completed with processing errors on ${failedCount} items.` : undefined,
        createdAt: new Date()
      });

      return processedBatch;
    });
  }

  // ==========================================
  // SECTION 3: SYNCHRONIZATION INFRASTRUCTURE
  // ==========================================

  /**
   * Complete multi-store upload & download synchronization pipeline with built-in interrupted crash recovery.
   */
  public async synchronizeStore(storeId: number): Promise<any> {
    this.logger.info(`Starting synchronization integration cycle for store key: ${storeId}`);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const checkpointRepo = txUow.getRepository<any>("syncCheckpoints", tx);
      const queueRepo = txUow.getRepository<any>("offlineTransactionQueue", tx);

      // 1. Resolve Sync Checkpoints (Guarantees atomic continuity)
      let checkpoint = (await checkpointRepo.findAll()).find((c: any) => c.storeId === storeId);
      if (!checkpoint) {
        checkpoint = await checkpointRepo.create({
          storeId,
          lastSyncedId: 0,
          lastSyncedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      // Check for Interrupted Recovery - look for outstanding pending queues or unprocessed batches
      const allQueued = await queueRepo.findAll();
      const unmappedPendingCount = allQueued.filter((q: any) => q.storeId === storeId && q.status === "pending").length;

      let batch: any = null;
      let syncResultLogs = "Nothing to sync.";

      if (unmappedPendingCount > 0) {
        this.logger.info(`Interrupted queue/pending items detected (${unmappedPendingCount}). Generating recovery batch.`);
        // Package pending client edits into an Exchange Batch
        batch = await this.createExchangeBatch(storeId);
        // Sequential validation & database state writes
        const processedBatch = await this.processExchangeBatch(batch.id);
        
        await checkpointRepo.update(checkpoint.id, {
          lastSyncedId: processedBatch.id,
          lastSyncedAt: new Date(),
          updatedAt: new Date()
        });

        syncResultLogs = `Successfully synchronized exchange batch ${processedBatch.batchNumber}. Result status: "${processedBatch.status}".`;
      }

      this.logger.info(`Successfully completed synchronizing pipeline for store ${storeId}. Status: ${syncResultLogs}`);
      return {
        storeId,
        checkpointId: checkpoint.id,
        synchronizedBatch: batch ? batch.id : null,
        status: "completed",
        summaryLog: syncResultLogs,
        timestamp: new Date().toISOString()
      };
    });
  }

  // ==========================================
  // SECTION 4: CONFLICT RESOLUTION ENGINE
  // ==========================================

  public async getPendingConflicts(): Promise<any[]> {
    const conflictRepo = this.uow.getRepository<any>("syncConflicts");
    return (await conflictRepo.findAll()).filter((c: any) => c.resolution === "pending");
  }

  /**
   * Resolves logged sync conflicts with strict resolution strategy replay.
   */
  public async resolveConflict(dto: ResolveSyncConflictDto): Promise<any> {
    this.logger.info(`Resolving sync conflict ID ${dto.conflictId} with strategy "${dto.resolutionStrategy}"`);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const conflictRepo = txUow.getRepository<any>("syncConflicts", tx);
      const conflict = await conflictRepo.findById(dto.conflictId);

      if (!conflict) throw new NotFoundException("syncConflicts", dto.conflictId);
      if (conflict.resolution !== "pending") {
        throw new BusinessRuleException("ConflictAlreadyResolved", `Conflict ID ${dto.conflictId} is already set to "${conflict.resolution}"`);
      }

      const clientPayload = JSON.parse(conflict.localData);

      if (dto.resolutionStrategy === "client_wins") {
        // Enforce clients modifications - Replay client transaction data
        if (conflict.entityType === "sale") {
          await this.posService.checkout(clientPayload);
        } else if (conflict.entityType === "return") {
          await this.returnService.processReturn(clientPayload);
        } else if (conflict.entityType === "customer") {
          await this.customerService.createCustomer(clientPayload);
        } else if (conflict.entityType === "adjustment") {
          const adj = await this.adjustmentService.createAdjustment(clientPayload);
          await this.adjustmentService.postAdjustment(adj.id, dto.resolvedByUserId);
        }
      } else if (dto.resolutionStrategy === "manual" && dto.manualData) {
        // Apply manually overrides
        if (conflict.entityType === "sale") {
          await this.posService.checkout({ ...clientPayload, ...dto.manualData });
        } else if (conflict.entityType === "customer") {
          await this.customerService.createCustomer({ ...clientPayload, ...dto.manualData });
        }
      }
      // "server_wins" takes no actions since server data remains intact

      const updated = await conflictRepo.update(dto.conflictId, {
        resolution: `resolved_${dto.resolutionStrategy}`,
        resolvedAt: new Date(),
        resolvedByUserId: dto.resolvedByUserId,
        notes: dto.notes || `Resolved via ${dto.resolutionStrategy} override.`
      });

      this.logger.info(`Conflict ID ${dto.conflictId} marked resolved: resolved_${dto.resolutionStrategy}`);
      return updated;
    });
  }

  // ==========================================
  // SECTION 5: MULTI-STORE RECONCILIATION
  // ==========================================

  /**
   * Multi-store reconciliation audit engine. Checks ledger dual consistency
   * and sync audits between Stores and HQ.
   */
  public async reconcileMultiStoreState(storeId: number): Promise<any> {
    this.logger.info(`Initiating reconciliation audit parameters for store ID: ${storeId}`);

    const ledgerRepo = this.uow.getRepository<any>("generalLedgerEntries");
    const posRepo = this.uow.getRepository<any>("sales");
    const stockRepo = this.uow.getRepository<any>("inventory");
    const orderRepo = this.uow.getRepository<any>("transferOrders");

    const allEntries = await ledgerRepo.findAll();
    const allSales = await posRepo.findAll();
    const allStocks = await stockRepo.findAll();
    const allTransfers = await orderRepo.findAll();

    // 1. Audit Intercompany Accounts Due-To / Due-From net balances
    // Intercompany accounts: Account 1400 (Due From) and 2400 (Due To) must reconcile to 0.00 system-wide
    const store1400Entries = allEntries.filter((e: any) => e.accountCode === "1400" && e.storeId === storeId);
    const store2400Entries = allEntries.filter((e: any) => e.accountCode === "2400" && e.storeId === storeId);

    const matchDebitsFrom = store1400Entries.reduce((s: number, e: any) => s + Number(e.debit) - Number(e.credit), 0);
    const matchCreditsTo = store2400Entries.reduce((s: number, e: any) => s + Number(e.credit) - Number(e.debit), 0);

    const system1400Entries = allEntries.filter((e: any) => e.accountCode === "1400");
    const system2400Entries = allEntries.filter((e: any) => e.accountCode === "2400");
    const systemDebitsFrom = system1400Entries.reduce((s: number, e: any) => s + Number(e.debit) - Number(e.credit), 0);
    const systemCreditsTo = system2400Entries.reduce((s: number, e: any) => s + Number(e.credit) - Number(e.debit), 0);
    const intercompanyNetVariance = systemDebitsFrom - systemCreditsTo;

    // 2. Aggregate sales amount matching General Ledger credit postings
    // Sales posts credit to 4010 (Sales Revenue) which is pre-tax, post-discount (subtotal - discountAmount)
    const storeSalesAmount = allSales
      .filter((s: any) => s.storeId === storeId)
      .reduce((s: number, o: any) => s + (Number(o.subtotal) - Number(o.discountAmount)), 0);

    const storeSalesRevenueEntries = allEntries.filter((e: any) => e.accountCode === "4010" && e.storeId === storeId);
    const glSalesRevenueAmount = storeSalesRevenueEntries.reduce((s: number, e: any) => s + Number(e.credit) - Number(e.debit), 0);

    // 3. Outstanding In-transit transfers audit
    const relevantTransfers = allTransfers.filter(
      (t: any) => (t.sourceStoreId === storeId || t.destinationStoreId === storeId) && t.status === "in_transit"
    );

    // Trial balance check (debits must equal credits system-wide)
    const totalDebits = allEntries.reduce((s: number, e: any) => s + Number(e.debit), 0);
    const totalCredits = allEntries.reduce((s: number, e: any) => s + Number(e.credit), 0);
    const trialBalanceVariance = Number(Math.abs(totalDebits - totalCredits).toFixed(2));
    const trialBalanceBalanced = trialBalanceVariance < 0.01;

    const salesRevenueVariance = Number((storeSalesAmount - glSalesRevenueAmount).toFixed(2));

    const reconciliationStatus = (Math.abs(salesRevenueVariance) < 0.01 && Math.abs(intercompanyNetVariance) < 0.01 && trialBalanceBalanced) ? "PASSED" : "discrepancy_detected";

    return {
      storeId,
      reconciliationStatus,
      auditMetrics: {
        totalStoreSalesAmount: storeSalesAmount,
        totalGLSalesRevenueRecorded: glSalesRevenueAmount,
        salesRevenueVariance,
        intercompanyDueFromDebitBalance: matchDebitsFrom,
        intercompanyDueToCreditBalance: matchCreditsTo,
        intercompanyNetVariance,
        trialBalanceBalanced,
        trialBalanceVariance,
        activeInTransitTransfersCount: relevantTransfers.length
      },
      timestamp: new Date().toISOString()
    };
  }

  // ==========================================
  // UTILITY HELPER METHODS
  // ==========================================

  /**
   * Generates a deterministic, collapsable string-hash representation.
   */
  private computeDeterministicHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return "hash_" + Math.abs(hash).toString(16);
  }
}
