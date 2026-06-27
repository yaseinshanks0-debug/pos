// src/backend/application/services/inventory-count.service.ts

import { IUnitOfWork } from "../ports/unit-of-work.interface.ts";
import { ILogger } from "../ports/logger.interface.ts";
import { CreateCountSessionDto, SubmitCountSessionDto } from "../dtos/dtos.ts";
import { Validator } from "../dtos/validation.ts";
import { NotFoundException, BusinessRuleException } from "../../domain/exceptions.ts";
import { IInventoryRepository } from "../../domain/repository.interface.ts";
import { AccountingService } from "./accounting.service.ts";

export class InventoryCountService {
  constructor(
    private readonly uow: IUnitOfWork,
    private readonly logger: ILogger
  ) {}

  public async startCountSession(dto: CreateCountSessionDto): Promise<any> {
    this.logger.info(`Starting inventory count session for warehouse ${dto.warehouseId}`);
    Validator.validateCreateCountSession(dto);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const sessionRepo = txUow.getRepository<any>("inventoryCountSessions", tx);
      const itemRepo = txUow.getRepository<any>("inventoryCountItems", tx);
      const inventoryRepo = txUow.getRepository<any>("inventory", tx);
      const productRepo = txUow.getRepository<any>("products", tx);
      const variantRepo = txUow.getRepository<any>("productVariants", tx);

      // Create session
      const session = await sessionRepo.create({
        companyId: dto.companyId,
        storeId: dto.storeId,
        warehouseId: dto.warehouseId,
        status: "counting",
        type: dto.type,
        notes: dto.notes || null,
        createdByUserId: dto.createdByUserId,
        startedAt: new Date(),
        updatedAt: new Date(),
      });

      // Get current physical stocks at this warehouse
      const currentStocks = await inventoryRepo.findAll({ warehouseId: dto.warehouseId });
      const products = await productRepo.findAll();
      const variants = await variantRepo.findAll();

      const createdItems = [];

      if (dto.type === "full") {
        // Snapshot everything in the warehouse
        for (const item of currentStocks) {
          const prod = products.find((p: any) => p.id === item.productId);
          if (!prod) continue;

          let unitCost = prod.costPrice;
          if (item.variantId) {
            const v = variants.find((vart: any) => vart.id === item.variantId);
            if (v && v.costPrice) {
              unitCost = v.costPrice;
            }
          }

          const countItem = await itemRepo.create({
            countSessionId: session.id,
            productId: item.productId,
            variantId: item.variantId || null,
            snapshotQuantity: item.quantity,
            countedQuantity: null,
            variance: null,
            unitCost: String(unitCost),
            reconciled: false,
          });
          createdItems.push(countItem);
        }
      } else {
        // Cycle counts can focus on existing stocked items as well
        for (const item of currentStocks) {
          const prod = products.find((p: any) => p.id === item.productId);
          if (!prod) continue;

          let unitCost = prod.costPrice;
          if (item.variantId) {
            const v = variants.find((vart: any) => vart.id === item.variantId);
            if (v && v.costPrice) {
              unitCost = v.costPrice;
            }
          }

          const countItem = await itemRepo.create({
            countSessionId: session.id,
            productId: item.productId,
            variantId: item.variantId || null,
            snapshotQuantity: item.quantity,
            countedQuantity: null,
            variance: null,
            unitCost: String(unitCost),
            reconciled: false,
          });
          createdItems.push(countItem);
        }
      }

      this.logger.info(`Count session ${session.id} started successfully with ${createdItems.length} snapshot items.`);
      return { ...session, items: createdItems };
    });
  }

  public async submitCounts(dto: SubmitCountSessionDto): Promise<any> {
    this.logger.info(`Submitting counting quantities for session ID ${dto.id}`);
    Validator.validateSubmitCountSession(dto);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const sessionRepo = txUow.getRepository<any>("inventoryCountSessions", tx);
      const itemRepo = txUow.getRepository<any>("inventoryCountItems", tx);

      const session = await sessionRepo.findById(dto.id);
      if (!session) {
        throw new NotFoundException("inventoryCountSessions", dto.id);
      }

      if (session.status !== "counting") {
        throw new BusinessRuleException(
          "InvalidStatusTransition",
          `Cannot submit counting values for a session in status "${session.status}"`
        );
      }

      // Fetch active session count items
      const countSessionItems = await itemRepo.findAll({ countSessionId: dto.id });

      const updatedItems = [];

      for (const inputItem of dto.items) {
        // Find corresponding snapshot record
        const matches = countSessionItems.filter((i: any) => 
          i.productId === inputItem.productId && 
          (inputItem.variantId ? i.variantId === inputItem.variantId : !i.variantId)
        );

        const match = matches[0];
        if (!match) {
          // If product wasn't in snapshot but counted, create a new item with 0 snapshot quantity
          const productRepo = txUow.getRepository<any>("products", tx);
          const prod = await productRepo.findById(inputItem.productId);
          if (!prod) {
            throw new NotFoundException("products", inputItem.productId);
          }

          let unitCost = prod.costPrice;
          if (inputItem.variantId) {
            const variantRepo = txUow.getRepository<any>("productVariants", tx);
            const v = await variantRepo.findById(inputItem.variantId);
            if (v && v.costPrice) unitCost = v.costPrice;
          }

          const variance = inputItem.countedQuantity; // countedQuantity - 0

          const newItem = await itemRepo.create({
            countSessionId: session.id,
            productId: inputItem.productId,
            variantId: inputItem.variantId || null,
            snapshotQuantity: 0,
            countedQuantity: inputItem.countedQuantity,
            variance: variance,
            unitCost: String(unitCost),
            reconciled: false,
            reasonCode: inputItem.reasonCode || "found_item",
          });
          updatedItems.push(newItem);
        } else {
          // Calculate variance
          const variance = inputItem.countedQuantity - match.snapshotQuantity;

          const updated = await itemRepo.update(match.id, {
            countedQuantity: inputItem.countedQuantity,
            variance: variance,
            reasonCode: inputItem.reasonCode || (variance < 0 ? "shrinkage" : "found_item"),
          });
          updatedItems.push(updated);
        }
      }

      // Fill in remaining snapshot items that weren't counted (default to snapshotQty or 0 count?)
      // Standard rule: if not submitted, we assume counted quantity is same as snapshot (no variance) or 0
      // Let's assume unmodified items are counted as they are (no variance)
      for (const item of countSessionItems) {
        const isSubmitted = dto.items.some((i: any) => 
          i.productId === item.productId && 
          (i.variantId ? i.variantId === item.variantId : !item.variantId)
        );
        if (!isSubmitted) {
          const updated = await itemRepo.update(item.id, {
            countedQuantity: item.snapshotQuantity,
            variance: 0,
            reasonCode: "no_discrepancy",
          });
          updatedItems.push(updated);
        }
      }

      const completedSession = await sessionRepo.update(dto.id, {
        status: "completed",
        notes: dto.notes || session.notes,
        completedAt: new Date(),
        updatedAt: new Date(),
      });

      return { ...completedSession, items: updatedItems };
    });
  }

  public async approveCountSession(id: number, approvedByUserId: number): Promise<any> {
    this.logger.info(`Approving physical count session ID ${id} by user ID ${approvedByUserId}`);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const sessionRepo = txUow.getRepository<any>("inventoryCountSessions", tx);
      const itemRepo = txUow.getRepository<any>("inventoryCountItems", tx);
      const inventoryRepo = txUow.getRepository<any>("inventory", tx) as unknown as IInventoryRepository;

      const session = await sessionRepo.findById(id);
      if (!session) {
        throw new NotFoundException("inventoryCountSessions", id);
      }

      if (session.status !== "completed") {
        throw new BusinessRuleException(
          "InvalidStatusTransition",
          `Only completed count sessions can be approved. Current: ${session.status}`
        );
      }

      const countSessionItems = await itemRepo.findAll({ countSessionId: id });

      let totalLossCost = 0;
      let totalGainCost = 0;

      for (const item of countSessionItems) {
        const variance = item.variance !== null ? item.variance : 0;
        const itemCost = Number(item.unitCost || 0);

        if (variance !== 0) {
          // Adjust physical stock in database!
          await inventoryRepo.adjustStock(
            session.warehouseId,
            item.productId,
            item.variantId,
            variance,
            item.reasonCode || "physical_inventory_count",
            approvedByUserId
          );

          if (variance < 0) {
            totalLossCost += itemCost * Math.abs(variance);
          } else {
            totalGainCost += itemCost * variance;
          }
        }

        // Mark reconciliation status complete
        await itemRepo.update(item.id, {
          reconciled: true,
        });
      }

      // ==========================================
      // AUTOMATIC DOUBLE-ENTRY JOURNAL POSTINGS
      // ==========================================
      try {
        const accountingService = new AccountingService(txUow, this.logger);

        // Post losses (shrinkage)
        if (totalLossCost > 0) {
          await accountingService.postJournalEntry({
            companyId: session.companyId,
            storeId: session.storeId,
            referenceType: "inventory_adjustment",
            referenceId: session.id,
            description: `Automatic posting for Count Session #${session.id} inventory shrinkage losses`,
            lines: [
              {
                accountCode: "5020",
                accountName: "Inventory Shrinkage Expense",
                accountType: "expenses" as const,
                debit: Number(totalLossCost.toFixed(2)),
                credit: 0
              },
              {
                accountCode: "1300",
                accountName: "Inventory Asset",
                accountType: "assets" as const,
                debit: 0,
                credit: Number(totalLossCost.toFixed(2))
              }
            ]
          }, txUow, tx);
        }

        // Post gains (surpluses)
        if (totalGainCost > 0) {
          await accountingService.postJournalEntry({
            companyId: session.companyId,
            storeId: session.storeId,
            referenceType: "inventory_adjustment",
            referenceId: session.id,
            description: `Automatic posting for Count Session #${session.id} inventory surplus gains`,
            lines: [
              {
                accountCode: "1300",
                accountName: "Inventory Asset",
                accountType: "assets" as const,
                debit: Number(totalGainCost.toFixed(2)),
                credit: 0
              },
              {
                accountCode: "5020",
                accountName: "Inventory Shrinkage Expense",
                accountType: "expenses" as const,
                debit: 0,
                credit: Number(totalGainCost.toFixed(2))
              }
            ]
          }, txUow, tx);
        }
      } catch (err: any) {
        this.logger.error(`Error during automatic count GL balancing posting: ${err.message}`);
        throw err;
      }

      // Transition session to approved
      const updated = await sessionRepo.update(id, {
        status: "approved",
        approvedByUserId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      });

      return updated;
    });
  }

  public async cancelCountSession(id: number): Promise<any> {
    this.logger.warn(`Cancelling count session ID ${id}`);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const sessionRepo = txUow.getRepository<any>("inventoryCountSessions", tx);
      const session = await sessionRepo.findById(id);

      if (!session) {
        throw new NotFoundException("inventoryCountSessions", id);
      }

      if (session.status !== "counting" && session.status !== "completed") {
        throw new BusinessRuleException(
          "InvalidStatusTransition",
          `Only sessions in counting or completed status can be cancelled. Current: ${session.status}`
        );
      }

      const updated = await sessionRepo.update(id, {
        status: "cancelled",
        updatedAt: new Date(),
      });

      return updated;
    });
  }
}
