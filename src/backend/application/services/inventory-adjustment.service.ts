// src/backend/application/services/inventory-adjustment.service.ts

import { IUnitOfWork } from "../ports/unit-of-work.interface.ts";
import { ILogger } from "../ports/logger.interface.ts";
import { CreateInventoryAdjustmentDto } from "../dtos/dtos.ts";
import { Validator } from "../dtos/validation.ts";
import { NotFoundException, BusinessRuleException } from "../../domain/exceptions.ts";
import { IInventoryRepository } from "../../domain/repository.interface.ts";
import { AccountingService } from "./accounting.service.ts";

export class InventoryAdjustmentService {
  constructor(
    private readonly uow: IUnitOfWork,
    private readonly logger: ILogger
  ) {}

  public async createAdjustment(dto: CreateInventoryAdjustmentDto): Promise<any> {
    this.logger.info(`Creating inventory adjustment proposal for ${dto.adjustmentNumber}`);
    Validator.validateCreateInventoryAdjustment(dto);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const adjRepo = txUow.getRepository<any>("inventoryAdjustments", tx);
      const itemRepo = txUow.getRepository<any>("inventoryAdjustmentItems", tx);
      const productRepo = txUow.getRepository<any>("products", tx);
      const variantRepo = txUow.getRepository<any>("productVariants", tx);

      // Create main header
      const adjustment = await adjRepo.create({
        companyId: dto.companyId,
        storeId: dto.storeId,
        warehouseId: dto.warehouseId,
        adjustmentNumber: dto.adjustmentNumber,
        type: dto.type,
        status: "draft",
        notes: dto.notes || null,
        createdByUserId: dto.createdByUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const savedItems = [];

      for (const item of dto.items) {
        const prod = await productRepo.findById(item.productId);
        if (!prod) {
          throw new NotFoundException("products", item.productId);
        }

        let unitCost = prod.costPrice;
        if (item.variantId) {
          const v = await variantRepo.findById(item.variantId);
          if (v && v.costPrice) {
            unitCost = v.costPrice;
          }
        }

        const savedItem = await itemRepo.create({
          inventoryAdjustmentId: adjustment.id,
          productId: item.productId,
          variantId: item.variantId || null,
          quantityAdjusted: item.quantityAdjusted,
          unitCost: String(unitCost),
          reasonCode: item.reasonCode,
        });

        savedItems.push(savedItem);
      }

      this.logger.info(`Successfully created inventory adjustment ${dto.adjustmentNumber} with ${savedItems.length} items`);
      return { ...adjustment, items: savedItems };
    });
  }

  public async postAdjustment(id: number, approvedByUserId: number): Promise<any> {
    this.logger.info(`Posting inventory adjustment ID ${id} approved by user ${approvedByUserId}`);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const adjRepo = txUow.getRepository<any>("inventoryAdjustments", tx);
      const itemRepo = txUow.getRepository<any>("inventoryAdjustmentItems", tx);
      const inventoryRepo = txUow.getRepository<any>("inventory", tx) as unknown as IInventoryRepository;

      const adjustment = await adjRepo.findById(id);
      if (!adjustment) {
        throw new NotFoundException("inventoryAdjustments", id);
      }

      if (adjustment.status !== "draft") {
        throw new BusinessRuleException(
          "InvalidStatusTransition",
          `Only draft adjustments can be posted. Current: ${adjustment.status}`
        );
      }

      const items = await itemRepo.findAll({ inventoryAdjustmentId: id });

      let totalLossCost = 0;
      let totalGainCost = 0;

      for (const item of items) {
        const costPrice = Number(item.unitCost || 0);

        // Adjust actual stock inside warehouse + movement log
        await inventoryRepo.adjustStock(
          adjustment.warehouseId,
          item.productId,
          item.variantId,
          item.quantityAdjusted,
          item.reasonCode || "manual_adjustment",
          approvedByUserId
        );

        if (item.quantityAdjusted < 0) {
          totalLossCost += costPrice * Math.abs(item.quantityAdjusted);
        } else {
          totalGainCost += costPrice * item.quantityAdjusted;
        }
      }

      // ==========================================
      // AUTOMATIC DOUBLE-ENTRY JOURNAL POSTINGS
      // ==========================================
      try {
        const accountingService = new AccountingService(txUow, this.logger);

        // Losses (shrinkages/damage/theft)
        if (totalLossCost > 0) {
          await accountingService.postJournalEntry({
            companyId: adjustment.companyId,
            storeId: adjustment.storeId,
            referenceType: "inventory_adjustment",
            referenceId: adjustment.id,
            description: `Automatic posting for Adjustment #${adjustment.adjustmentNumber} inventory loss/shrinkage expense`,
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

        // Gains (found item/manual correction)
        if (totalGainCost > 0) {
          await accountingService.postJournalEntry({
            companyId: adjustment.companyId,
            storeId: adjustment.storeId,
            referenceType: "inventory_adjustment",
            referenceId: adjustment.id,
            description: `Automatic posting for Adjustment #${adjustment.adjustmentNumber} inventory gains`,
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
        this.logger.error(`Failed automatic journal posting for Inventory Adjustment: ${err.message}`);
        throw err;
      }

      const updated = await adjRepo.update(id, {
        status: "posted",
        approvedByUserId,
        postedAt: new Date(),
        updatedAt: new Date(),
      });

      return updated;
    });
  }

  public async cancelAdjustment(id: number): Promise<any> {
    this.logger.warn(`Cancelling adjustment proposal ID ${id}`);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const adjRepo = txUow.getRepository<any>("inventoryAdjustments", tx);
      const adjustment = await adjRepo.findById(id);

      if (!adjustment) {
        throw new NotFoundException("inventoryAdjustments", id);
      }

      if (adjustment.status !== "draft") {
        throw new BusinessRuleException(
          "InvalidStatusTransition",
          `Only draft adjustments can be cancelled. Current: ${adjustment.status}`
        );
      }

      const updated = await adjRepo.update(id, {
        status: "cancelled",
        updatedAt: new Date(),
      });

      return updated;
    });
  }
}
