// src/backend/application/services/purchasing.service.ts

import { IUnitOfWork } from "../ports/unit-of-work.interface.ts";
import { ILogger } from "../ports/logger.interface.ts";
import { 
  CreateVendorDto, 
  UpdateVendorDto, 
  CreatePurchaseOrderDto, 
  ReceivePurchaseOrderDto,
  RecordVendorCreditDto
} from "../dtos/dtos.ts";
import { Validator } from "../dtos/validation.ts";
import { 
  NotFoundException, 
  BusinessRuleException,
  ValidationError 
} from "../../domain/exceptions.ts";
import { IInventoryRepository } from "../../domain/repository.interface.ts";
import { AccountingService } from "./accounting.service.ts";
import { CogsEngineService } from "./cogs-engine.service.ts";

export class PurchasingService {
  constructor(
    private readonly uow: IUnitOfWork,
    private readonly logger: ILogger
  ) {}

  // ==========================================
  // Vendors Management
  // ==========================================
  public async createVendor(dto: CreateVendorDto): Promise<any> {
    this.logger.info(`Creating standard vendor: ${dto.name}`);
    Validator.validateCreateVendor(dto);

    const vendorRepo = this.uow.getRepository<any>("vendors");
    
    // Check duplicate name under the same company
    const allVendors = await vendorRepo.findAll({ companyId: dto.companyId });
    if (allVendors.find((v: any) => v.name.toLowerCase() === dto.name.toLowerCase())) {
      throw new ValidationError({ name: ["A vendor with this name is already registered."] });
    }

    return vendorRepo.create({
      companyId: dto.companyId,
      name: dto.name,
      contactName: dto.contactName || null,
      email: dto.email || null,
      phone: dto.phone || null,
      address: dto.address || null,
      paymentTerms: dto.paymentTerms || "cash",
      creditLimit: dto.creditLimit ? String(dto.creditLimit) : "0.00",
      status: "active",
      createdAt: new Date()
    });
  }

  public async updateVendor(id: number, dto: UpdateVendorDto): Promise<any> {
    this.logger.info(`Updating vendor ID: ${id}`);
    const vendorRepo = this.uow.getRepository<any>("vendors");
    const vendor = await vendorRepo.findById(id);
    if (!vendor) {
      throw new NotFoundException("vendors", id);
    }

    const payload: Record<string, any> = {};
    if (dto.name !== undefined) payload.name = dto.name;
    if (dto.contactName !== undefined) payload.contactName = dto.contactName;
    if (dto.email !== undefined) payload.email = dto.email;
    if (dto.phone !== undefined) payload.phone = dto.phone;
    if (dto.address !== undefined) payload.address = dto.address;
    if (dto.paymentTerms !== undefined) payload.paymentTerms = dto.paymentTerms;
    if (dto.creditLimit !== undefined) payload.creditLimit = String(dto.creditLimit);
    if (dto.status !== undefined) payload.status = dto.status;

    return vendorRepo.update(id, payload);
  }

  public async getVendor(id: number): Promise<any> {
    const vendorRepo = this.uow.getRepository<any>("vendors");
    const vendor = await vendorRepo.findById(id);
    if (!vendor) {
      throw new NotFoundException("vendors", id);
    }
    return vendor;
  }

  public async listVendors(filters?: Record<string, any>): Promise<any[]> {
    const vendorRepo = this.uow.getRepository<any>("vendors");
    return vendorRepo.findAll(filters);
  }

  // ==========================================
  // Vendor Credit Handling
  // ==========================================
  public async recordVendorCredit(dto: RecordVendorCreditDto): Promise<any> {
    this.logger.info(`Recording credits offset on vendor ID: ${dto.vendorId}`);
    
    return this.uow.runInTransaction(async (txUow, tx) => {
      const vendorRepo = txUow.getRepository<any>("vendors", tx);
      const vendor = await vendorRepo.findById(dto.vendorId);
      if (!vendor) {
        throw new NotFoundException("vendors", dto.vendorId);
      }

      // We handle credit by updating the vendor's creditLimit or appending credit transactions.
      const updatedBalance = Number(vendor.creditLimit) + Number(dto.amount);
      
      const updatedVendor = await vendorRepo.update(dto.vendorId, {
        creditLimit: String(updatedBalance.toFixed(2))
      });

      // Record standard audit log
      const auditRepo = txUow.getRepository<any>("auditLogs", tx);
      await auditRepo.create({
        action: "VENDOR_CREDIT_RECORDED",
        entityName: "vendors",
        entityId: dto.vendorId,
        details: `Vendor credit transaction of ${dto.amount} logged. Reason: ${dto.reason}. New Vendor credit limit: ${updatedBalance}`,
        createdAt: new Date()
      });

      this.logger.info(`Vendor ID ${dto.vendorId} credits updated. New Limit: ${updatedBalance}`);
      return updatedVendor;
    });
  }

  // ==========================================
  // Purchase Orders core workflows
  // ==========================================
  public async createPurchaseOrder(dto: CreatePurchaseOrderDto): Promise<any> {
    this.logger.info(`Processing Purchase Order request: ${dto.poNumber}`);
    Validator.validateCreatePurchaseOrder(dto);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const poRepo = txUow.getRepository<any>("purchaseOrders", tx);
      const itemsRepo = txUow.getRepository<any>("purchaseOrderItems", tx);
      const vendorRepo = txUow.getRepository<any>("vendors", tx);

      // Verify vendor exists
      const vendor = await vendorRepo.findById(dto.vendorId);
      if (!vendor) {
        throw new NotFoundException("vendors", dto.vendorId);
      }

      // Check unique poNumber
      const allPo = await poRepo.findAll();
      if (allPo.find((p: any) => p.poNumber.toLowerCase() === dto.poNumber.toLowerCase())) {
        throw new ValidationError({ poNumber: ["Purchase order number is already taken."] });
      }

      // Calculate total amount
      let totalAmount = 0;
      dto.items.forEach(item => {
        totalAmount += Number(item.orderedQty) * Number(item.unitCost);
      });

      // Part 1: Main PO Record
      const createdPO = await poRepo.create({
        companyId: dto.companyId,
        poNumber: dto.poNumber.trim(),
        vendorId: dto.vendorId,
        storeId: dto.storeId,
        status: "draft",
        totalAmount: String(totalAmount.toFixed(2)),
        notes: dto.notes || null,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Part 2: PO items creation
      const savedItems = [];
      for (const item of dto.items) {
        const product = await txUow.getRepository<any>("products", tx).findById(item.productId);
        if (!product) {
          throw new NotFoundException("products", item.productId);
        }

        const savedItem = await itemsRepo.create({
          purchaseOrderId: createdPO.id,
          productId: item.productId,
          variantId: item.variantId || null,
          orderedQty: item.orderedQty,
          receivedQty: 0,
          unitCost: String(item.unitCost)
        });
        savedItems.push(savedItem);
      }

      this.logger.info(`PO ${dto.poNumber} successfully initialized with ${savedItems.length} lines.`);
      return { ...createdPO, items: savedItems };
    });
  }

  public async submitPO(id: number): Promise<any> {
    return this.uow.runInTransaction(async (txUow, tx) => {
      const poRepo = txUow.getRepository<any>("purchaseOrders", tx);
      const po = await poRepo.findById(id);
      if (!po) throw new NotFoundException("purchaseOrders", id);

      if (po.status !== "draft") {
        throw new BusinessRuleException("InvalidStatusTransition", `Only draft POs can be submitted. Current: ${po.status}`);
      }

      return poRepo.update(id, {
        status: "submitted",
        updatedAt: new Date()
      });
    });
  }

  public async approvePO(id: number): Promise<any> {
    return this.uow.runInTransaction(async (txUow, tx) => {
      const poRepo = txUow.getRepository<any>("purchaseOrders", tx);
      const po = await poRepo.findById(id);
      if (!po) throw new NotFoundException("purchaseOrders", id);

      if (po.status !== "submitted") {
        throw new BusinessRuleException("InvalidStatusTransition", `Only submitted POs can be approved. Current: ${po.status}`);
      }

      return poRepo.update(id, {
        status: "approved",
        updatedAt: new Date()
      });
    });
  }

  public async markSent(id: number): Promise<any> {
    return this.uow.runInTransaction(async (txUow, tx) => {
      const poRepo = txUow.getRepository<any>("purchaseOrders", tx);
      const po = await poRepo.findById(id);
      if (!po) throw new NotFoundException("purchaseOrders", id);

      if (po.status !== "approved") {
        throw new BusinessRuleException("InvalidStatusTransition", `Only approved POs can be sent to vendors. Current: ${po.status}`);
      }

      return poRepo.update(id, {
        status: "sent",
        updatedAt: new Date()
      });
    });
  }

  // ==========================================
  // Full & Partial Stock Receiving Workflow
  // ==========================================
  public async receivePurchaseOrder(id: number, dto: ReceivePurchaseOrderDto): Promise<any> {
    this.logger.info(`Receiving inventory arrival check for Purchase Order: ID ${id}`);
    Validator.validateReceivePurchaseOrder(dto);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const poRepo = txUow.getRepository<any>("purchaseOrders", tx);
      const poItemsRepo = txUow.getRepository<any>("purchaseOrderItems", tx);
      const inventoryRepo = txUow.getRepository<any>("inventory", tx) as unknown as IInventoryRepository;
      const movementRepo = txUow.getRepository<any>("inventoryMovements", tx);

      const po = await poRepo.findById(id);
      if (!po) {
        throw new NotFoundException("purchaseOrders", id);
      }

      // PO receiving is allowed from 'sent_to_supplier' or approved/submitted states as backup
      if (po.status !== "sent" && po.status !== "approved") {
        throw new BusinessRuleException(
          "InvalidStatusTransition",
          `Only "sent" or "approved" Purchase Orders can receive items. Current Status: ${po.status}`
        );
      }

      const activePOItems = await poItemsRepo.findAll({ purchaseOrderId: id });
      
      // Update receiving quantities and stock levels
      for (const rxItem of dto.items) {
        const matchItem = activePOItems.find((item: any) => 
          item.productId === rxItem.productId && 
          item.variantId === (rxItem.variantId || null)
        );

        if (!matchItem) {
          throw new BusinessRuleException(
            "ProductNotInPO",
            `Product ID ${rxItem.productId} was not specified inside this Purchase Order registration.`
          );
        }

        const currentReceived = matchItem.receivedQty || 0;
        const targetReceived = currentReceived + rxItem.receivedQty;

        if (targetReceived > matchItem.orderedQty) {
          this.logger.warn(`Excess shipment detected: Received ${targetReceived} vs Ordered ${matchItem.orderedQty}. Logging. `);
        }

        // Update PO item
        await poItemsRepo.update(matchItem.id, {
          receivedQty: targetReceived
        });

        // Add or adjust inside warehouse inventory stock
        let stock = await inventoryRepo.findByWarehouseAndProduct(
          dto.warehouseId,
          rxItem.productId,
          rxItem.variantId || null
        );

        if (!stock) {
          stock = await inventoryRepo.create({
            warehouseId: dto.warehouseId,
            productId: rxItem.productId,
            variantId: rxItem.variantId || null,
            quantity: rxItem.receivedQty,
            reorderLevel: 5,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        } else {
          await inventoryRepo.update(stock.id, {
            quantity: stock.quantity + rxItem.receivedQty,
            updatedAt: new Date()
          });
        }

        // Add FIFO costing layers
        let resolvedVariantId = rxItem.variantId;
        if (!resolvedVariantId) {
          const variantRepo = txUow.getRepository<any>("productVariants", tx);
          const allPVs = await variantRepo.findAll({ productId: rxItem.productId });
          if (allPVs && allPVs.length > 0) {
            resolvedVariantId = allPVs[0].id;
          }
        }

        if (resolvedVariantId) {
          const cogsEngine = new CogsEngineService(txUow, this.logger);
          const pWarehouse = await txUow.getRepository<any>("warehouses", tx).findById(dto.warehouseId);
          const currentStoreId = pWarehouse ? pWarehouse.storeId : 1;
          const unitCostVal = Number(matchItem.unitCost || 0);

          // Reconcile historic negative deficits prior to layer creation
          const incrementalQty = await cogsEngine.reconcileNegativeDeficits(
            currentStoreId,
            resolvedVariantId,
            rxItem.receivedQty,
            unitCostVal,
            tx
          );

          if (incrementalQty > 0) {
            await cogsEngine.createCostLayer(
              po.companyId || 1,
              currentStoreId,
              resolvedVariantId,
              incrementalQty,
              unitCostVal,
              "receiving",
              po.id,
              tx
            );
          }
        }

        // Write inventory movement log
        await movementRepo.create({
          inventoryId: stock.id,
          type: "receiving",
          quantity: rxItem.receivedQty,
          unitCost: String(matchItem.unitCost),
          reasonCode: "purchase_order_receiving",
          referenceType: "purchase_order",
          referenceId: po.id,
          userId: dto.receivedByUserId,
          createdAt: new Date()
        });
      }

      // Re-fetch items to verify total completion (Full vs Partial)
      const reLoadedItems = await poItemsRepo.findAll({ purchaseOrderId: id });
      
      let fullyReceived = true;
      for (const subItem of reLoadedItems) {
        if (subItem.receivedQty < subItem.orderedQty) {
          fullyReceived = false;
          break;
        }
      }

      let finalStatus: string;
      if (dto.forceClose) {
        finalStatus = "closed";
      } else if (fullyReceived) {
        finalStatus = "received";
      } else {
        // Keep in sent/approved or label partially received under notes
        finalStatus = "approved"; // remains active for other receptions
      }

      const updatedFields: Record<string, any> = {
        updatedAt: new Date(),
        status: finalStatus
      };
      if (dto.notes) {
        updatedFields.notes = po.notes ? `${po.notes}\n${dto.notes}` : dto.notes;
      }

      const updatedPO = await poRepo.update(id, updatedFields);

      // ==========================================
      // AUTOMATIC POSTING: Double-Entry Accounting
      // ==========================================
      let totalPOReceivedCost = 0;
      for (const rxItem of dto.items) {
        const matchItem = activePOItems.find((item: any) => 
          item.productId === rxItem.productId && 
          item.variantId === (rxItem.variantId || null)
        );
        if (matchItem) {
          totalPOReceivedCost += Number(matchItem.unitCost || 0) * rxItem.receivedQty;
        }
      }

      if (totalPOReceivedCost > 0) {
        try {
          const warehouseRepo = txUow.getRepository<any>("warehouses", tx);
          const pWarehouse = await warehouseRepo.findById(dto.warehouseId);
          const storeIdToUse = pWarehouse ? pWarehouse.storeId : null;

          const accountingService = new AccountingService(txUow, this.logger);
          await accountingService.postJournalEntry({
            companyId: 1, // Default main company
            storeId: storeIdToUse,
            referenceType: "receiving",
            referenceId: po.id,
            description: `Automatic posting for Purchase Order ${po.orderNumber || po.id} receiving of stock items`,
            lines: [
              {
                accountCode: "1300",
                accountName: "Inventory Asset",
                accountType: "assets" as const,
                debit: Number(totalPOReceivedCost.toFixed(2)),
                credit: 0
              },
              {
                accountCode: "2012",
                accountName: "Accrued Inventory Liability",
                accountType: "liabilities" as const,
                debit: 0,
                credit: Number(totalPOReceivedCost.toFixed(2))
              }
            ]
          }, txUow, tx);
        } catch (err: any) {
          this.logger.error(`Failed automatic journal posting for Purchase Order receiving: ${err.message}`);
          throw err;
        }
      }

      this.logger.info(`PO ID ${id} receive processed. Status changed to: ${finalStatus}`);
      return updatedPO;
    });
  }

  public async getPurchaseOrderDetails(id: number): Promise<any> {
    const poRepo = this.uow.getRepository<any>("purchaseOrders");
    const itemsRepo = this.uow.getRepository<any>("purchaseOrderItems");
    
    const po = await poRepo.findById(id);
    if (!po) throw new NotFoundException("purchaseOrders", id);

    const items = await itemsRepo.findAll({ purchaseOrderId: id });
    return { ...po, items };
  }

  public async listPurchaseOrders(filters?: Record<string, any>): Promise<any[]> {
    const poRepo = this.uow.getRepository<any>("purchaseOrders");
    return poRepo.findAll(filters);
  }

  public async postVendorInvoice(poId: number, invoiceNumber: string): Promise<any> {
    this.logger.info(`Posting vendor invoice for PO ID: ${poId}, invoice #: ${invoiceNumber}`);
    
    return this.uow.runInTransaction(async (txUow, tx) => {
      const poRepo = txUow.getRepository<any>("purchaseOrders", tx);
      const poItemsRepo = txUow.getRepository<any>("purchaseOrderItems", tx);
      const po = await poRepo.findById(poId);
      if (!po) {
        throw new NotFoundException("purchaseOrders", poId);
      }

      // Calculate total received cost based on actual received items in PO Items
      const activePOItems = await poItemsRepo.findAll({ purchaseOrderId: poId });
      let totalReceivedCost = 0;
      for (const item of activePOItems) {
        totalReceivedCost += Number(item.unitCost || 0) * (item.receivedQty || 0);
      }

      if (totalReceivedCost <= 0) {
        throw new BusinessRuleException(
          "UnreceivedPurchaseOrder",
          `Cannot post vendor invoice for PO ${poId} as no items have been received yet.`
        );
      }

      // Check if we've already posted an invoice for this PO ID to avoid double-posting
      const ledgerRepo = txUow.getRepository<any>("generalLedgerEntries", tx);
      const existingLedgerRecords = await ledgerRepo.findAll();
      const alreadyInvoiced = existingLedgerRecords.some(
        (le: any) => le.referenceType === "vendor_invoice" && le.referenceId === poId
      );

      if (alreadyInvoiced) {
        throw new BusinessRuleException(
          "VendorInvoiceAlreadyPosted",
          `A vendor invoice has already been posted and matched for Purchase Order ID ${poId}.`
        );
      }

      // Create liability reclassification journal entry
      const accountingService = new AccountingService(txUow, this.logger);
      await accountingService.postJournalEntry({
        companyId: po.companyId || 1,
        storeId: po.storeId,
        referenceType: "vendor_invoice",
        referenceId: poId,
        description: `Vendor invoice #${invoiceNumber} match & GRNI liability reclassification for PO ${po.poNumber}`,
        lines: [
          {
            accountCode: "2012",
            accountName: "Accrued Inventory Liability",
            accountType: "liabilities" as const,
            debit: Number(totalReceivedCost.toFixed(2)),
            credit: 0
          },
          {
            accountCode: "2010",
            accountName: "Accounts Payable",
            accountType: "liabilities" as const,
            debit: 0,
            credit: Number(totalReceivedCost.toFixed(2))
          }
        ]
      }, txUow, tx);

      // Append verification note to the PO notes
      const updatedNotes = po.notes 
        ? `${po.notes}\n[Invoice Linked: #${invoiceNumber}, Amount: $${totalReceivedCost.toFixed(2)}]` 
        : `[Invoice Linked: #${invoiceNumber}, Amount: $${totalReceivedCost.toFixed(2)}]`;

      await poRepo.update(poId, {
        notes: updatedNotes,
        status: "closed", // Close the PO as fully processed (received and invoiced)
        updatedAt: new Date()
      });

      this.logger.info(`Vendor invoice #${invoiceNumber} matched & posted successfully for PO #${po.poNumber || poId}. Status updated to CLOSED.`);
      return { success: true, invoiceAmount: totalReceivedCost };
    });
  }
}
