// src/backend/application/services/transfer-order.service.ts

import { IUnitOfWork } from "../ports/unit-of-work.interface.ts";
import { ILogger } from "../ports/logger.interface.ts";
import { CreateTransferOrderDto, UpdateTransferOrderDto } from "../dtos/dtos.ts";
import { Validator } from "../dtos/validation.ts";
import { 
  NotFoundException, 
  BusinessRuleException 
} from "../../domain/exceptions.ts";
import { IInventoryRepository } from "../../domain/repository.interface.ts";
import { AccountingService } from "./accounting.service.ts";

export class TransferOrderService {
  constructor(
    private readonly uow: IUnitOfWork,
    private readonly logger: ILogger
  ) {}

  public async createTransfer(dto: CreateTransferOrderDto): Promise<any> {
    this.logger.info(`Validating transfer order creation payload for ${dto.transferNumber}`);
    Validator.validateCreateTransferOrder(dto);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const transferRepo = txUow.getRepository<any>("transferOrders", tx);
      const itemsRepo = txUow.getRepository<any>("transferOrderItems", tx);

      // 1. Create the Transfer Order main record
      const transfer = await transferRepo.create({
        transferNumber: dto.transferNumber,
        sourceStoreId: dto.sourceStoreId,
        sourceWarehouseId: dto.sourceWarehouseId,
        destinationStoreId: dto.destinationStoreId,
        destinationWarehouseId: dto.destinationWarehouseId,
        status: "draft",
        notes: dto.notes || null,
        createdByUserId: dto.createdByUserId || null,
        version: 1,
        syncVersion: 1,
      });

      // 2. Insert items
      const savedItems = [];
      for (const item of dto.items) {
        const savedItem = await itemsRepo.create({
          transferOrderId: transfer.id,
          productId: item.productId,
          variantId: item.variantId || null,
          shippedQty: item.quantityRequest,
          receivedQty: 0,
        });
        savedItems.push(savedItem);
      }

      this.logger.info(`Successfully created Transfer Order ${dto.transferNumber} with ${savedItems.length} items`);
      return { ...transfer, items: savedItems };
    });
  }

  public async approveTransfer(id: number, approvedByUserId: number): Promise<any> {
    this.logger.info(`Processing approval for transfer ID: ${id} by user: ${approvedByUserId}`);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const transferRepo = txUow.getRepository<any>("transferOrders", tx);
      const transfer = await transferRepo.findById(id);

      if (!transfer) {
        throw new NotFoundException("TransferOrder", id);
      }

      if (transfer.status !== "draft") {
        throw new BusinessRuleException(
          "InvalidStatusTransition", 
          `Cannot approve a transfer order in "${transfer.status}" status`
        );
      }

      const updated = await transferRepo.update(id, {
        status: "approved",
        approvedByUserId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      });

      return updated;
    });
  }

  public async shipTransfer(id: number): Promise<any> {
    this.logger.info(`Initiating shipment transit for transfer ID: ${id}`);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const transferRepo = txUow.getRepository<any>("transferOrders", tx);
      const itemsRepo = txUow.getRepository<any>("transferOrderItems", tx);
      const inventoryRepo = txUow.getRepository<any>("inventory", tx) as unknown as IInventoryRepository;
      const movementRepo = txUow.getRepository<any>("inventoryMovements", tx);

      const transfer = await transferRepo.findById(id);
      if (!transfer) {
        throw new NotFoundException("TransferOrder", id);
      }

      if (transfer.status !== "approved") {
        throw new BusinessRuleException(
          "InvalidStatusTransition",
          `Only "approved" transfer orders can transition to "in_transit". Current: "${transfer.status}"`
        );
      }

      // Fetch transfer items to deduct stock
      const items = await itemsRepo.findAll({ transferOrderId: id });
      
      // Deduct stock from the source warehouse and record inventory movements
      for (const item of items) {
        const sourceStock = await inventoryRepo.findByWarehouseAndProduct(
          transfer.sourceWarehouseId,
          item.productId,
          item.variantId
        );

        if (!sourceStock || sourceStock.quantity < item.shippedQty) {
          throw new BusinessRuleException(
            "InsufficientStock",
            `Insufficient stock for Product ID ${item.productId} in source warehouse ${transfer.sourceWarehouseId}. Requested: ${item.shippedQty}, Available: ${sourceStock?.quantity || 0}`
          );
        }

        // Adjust source warehouse stock
        await inventoryRepo.update(sourceStock.id, {
          quantity: sourceStock.quantity - item.shippedQty,
          updatedAt: new Date(),
        });

        // Lookup cost price
        let costPrice = "0.00";
        const prod = await txUow.getRepository<any>("products", tx).findById(item.productId);
        if (prod) {
          costPrice = prod.costPrice;
        }

        // Track movement
        await movementRepo.create({
          inventoryId: sourceStock.id,
          type: "transfer_out",
          quantity: -item.shippedQty,
          unitCost: costPrice,
          reasonCode: "transfer_order",
          referenceType: "transfer_order",
          referenceId: transfer.id,
          createdAt: new Date(),
        });
      }

      const updated = await transferRepo.update(id, {
        status: "in_transit",
        shippedAt: new Date(),
        updatedAt: new Date(),
      });

      return updated;
    });
  }

  public async receiveTransfer(
    id: number, 
    receivedByUserId: number, 
    itemsReceived: { itemId: number; qtyReceived: number }[]
  ): Promise<any> {
    this.logger.info(`Recording receipt for transfer ID: ${id} by user: ${receivedByUserId}`);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const transferRepo = txUow.getRepository<any>("transferOrders", tx);
      const itemsRepo = txUow.getRepository<any>("transferOrderItems", tx);
      const inventoryRepo = txUow.getRepository<any>("inventory", tx) as unknown as IInventoryRepository;
      const movementRepo = txUow.getRepository<any>("inventoryMovements", tx);

      const transfer = await transferRepo.findById(id);
      if (!transfer) {
        throw new NotFoundException("TransferOrder", id);
      }

      if (transfer.status !== "in_transit" && transfer.status !== "partially_received") {
        throw new BusinessRuleException(
          "InvalidStatusTransition",
          `Transfer order must be "in_transit" or "partially_received" to be received. Current: "${transfer.status}"`
        );
      }

      // Track whether all sent quantities are completely received
      let fullyReceived = true;

      for (const itemReceipt of itemsReceived) {
        const item = await itemsRepo.findById(itemReceipt.itemId);
        if (!item || item.transferOrderId !== id) {
          throw new NotFoundException("TransferOrderItem", itemReceipt.itemId);
        }

        // Check if partially or fully received
        if (itemReceipt.qtyReceived < item.shippedQty) {
          fullyReceived = false;
        }

        // Update received quantity
        await itemsRepo.update(item.id, {
          receivedQty: itemReceipt.qtyReceived,
        });

        // Find or create inventory in the destination warehouse
        let destStock = await inventoryRepo.findByWarehouseAndProduct(
          transfer.destinationWarehouseId,
          item.productId,
          item.variantId
        );

        if (!destStock) {
          destStock = await inventoryRepo.create({
            warehouseId: transfer.destinationWarehouseId,
            productId: item.productId,
            variantId: item.variantId,
            quantity: itemReceipt.qtyReceived,
            reorderLevel: 10,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        } else {
          await inventoryRepo.update(destStock.id, {
            quantity: destStock.quantity + itemReceipt.qtyReceived,
            updatedAt: new Date(),
          });
        }

        // Lookup cost price
        let costPrice = "0.00";
        const prod = await txUow.getRepository<any>("products", tx).findById(item.productId);
        if (prod) {
          costPrice = prod.costPrice;
        }

        // Track movement
        await movementRepo.create({
          inventoryId: destStock.id,
          type: "transfer_in",
          quantity: itemReceipt.qtyReceived,
          unitCost: costPrice,
          reasonCode: "transfer_order",
          referenceType: "transfer_order",
          referenceId: transfer.id,
          userId: receivedByUserId,
          createdAt: new Date(),
        });
      }

      const finalStatus = fullyReceived ? "received" : "partially_received";

      const updated = await transferRepo.update(id, {
        status: finalStatus,
        receivedByUserId,
        receivedAt: new Date(),
        updatedAt: new Date(),
      });

      // ==========================================
      // AUTOMATIC POSTING: Double-Entry Accounting
      // ==========================================
      try {
        let totalTransferValue = 0;
        for (const itemReceipt of itemsReceived) {
          const item = await itemsRepo.findById(itemReceipt.itemId);
          if (item) {
            const prod = await txUow.getRepository<any>("products", tx).findById(item.productId);
            const costPrice = prod ? Number(prod.costPrice || 0) : 0;
            totalTransferValue += costPrice * itemReceipt.qtyReceived;
          }
        }

        if (totalTransferValue > 0) {
          const warehouseRepo = txUow.getRepository<any>("warehouses", tx);
          const sourceWarehouse = await warehouseRepo.findById(transfer.sourceWarehouseId);
          const destWarehouse = await warehouseRepo.findById(transfer.destinationWarehouseId);
          
          const sourceStoreId = sourceWarehouse ? sourceWarehouse.storeId : null;
          const destStoreId = destWarehouse ? destWarehouse.storeId : null;

          const accountingService = new AccountingService(txUow, this.logger);

          if (sourceStoreId === destStoreId) {
            // Same store: Direct asset move (balances out)
            await accountingService.postJournalEntry({
              companyId: 1,
              storeId: destStoreId,
              referenceType: "transfer",
              referenceId: transfer.id,
              description: `Automatic posting for Transfer Order ${transfer.transferNumber || transfer.id} inside same store`,
              lines: [
                {
                  accountCode: "1300",
                  accountName: "Inventory Asset",
                  accountType: "assets" as const,
                  debit: Number(totalTransferValue.toFixed(2)),
                  credit: 0
                },
                {
                  accountCode: "1300",
                  accountName: "Inventory Asset",
                  accountType: "assets" as const,
                  debit: 0,
                  credit: Number(totalTransferValue.toFixed(2))
                }
              ]
            }, txUow, tx);
          } else {
            // Intercompany Store-to-Store Asset Transfer
            // 1. Source Store Credit Outflow & Due From Debit Ledger
            await accountingService.postJournalEntry({
              companyId: 1,
              storeId: sourceStoreId,
              referenceType: "transfer",
              referenceId: transfer.id,
              description: `Automatic posting for outgoing Transfer Order ${transfer.transferNumber || transfer.id} to Store ${destStoreId}`,
              lines: [
                {
                  accountCode: "1400",
                  accountName: "Intercompany Due From Stores",
                  accountType: "assets" as const,
                  debit: Number(totalTransferValue.toFixed(2)),
                  credit: 0
                },
                {
                  accountCode: "1300",
                  accountName: "Inventory Asset",
                  accountType: "assets" as const,
                  debit: 0,
                  credit: Number(totalTransferValue.toFixed(2))
                }
              ]
            }, txUow, tx);

            // 2. Destination Store Debit Inflow & Due To Credit Ledger
            await accountingService.postJournalEntry({
              companyId: 1,
              storeId: destStoreId,
              referenceType: "transfer",
              referenceId: transfer.id,
              description: `Automatic posting for incoming Transfer Order ${transfer.transferNumber || transfer.id} from Store ${sourceStoreId}`,
              lines: [
                {
                  accountCode: "1300",
                  accountName: "Inventory Asset",
                  accountType: "assets" as const,
                  debit: Number(totalTransferValue.toFixed(2)),
                  credit: 0
                },
                {
                  accountCode: "2400",
                  accountName: "Intercompany Due To Stores",
                  accountType: "liabilities" as const,
                  debit: 0,
                  credit: Number(totalTransferValue.toFixed(2))
                }
              ]
            }, txUow, tx);
          }
        }
      } catch (err: any) {
        this.logger.error(`Failed automatic journal posting for Inventory Transfer ${transfer.transferNumber}: ${err.message}`);
        throw err;
      }

      this.logger.info(`Transfer ${transfer.transferNumber} received with final status: ${finalStatus}`);
      return updated;
    });
  }

  public async cancelTransfer(id: number): Promise<any> {
    this.logger.warn(`Attempting to cancel transfer ID: ${id}`);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const transferRepo = txUow.getRepository<any>("transferOrders", tx);
      const transfer = await transferRepo.findById(id);

      if (!transfer) {
        throw new NotFoundException("TransferOrder", id);
      }

      if (transfer.status !== "draft" && transfer.status !== "approved") {
        throw new BusinessRuleException(
          "InvalidStatusTransition",
          `Cannot cancel a transfer order that is in transit or received. Current status: "${transfer.status}"`
        );
      }

      const updated = await transferRepo.update(id, {
        status: "cancelled",
        updatedAt: new Date(),
      });

      return updated;
    });
  }
}
