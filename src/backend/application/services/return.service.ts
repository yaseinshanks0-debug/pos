// src/backend/application/services/return.service.ts

import { IUnitOfWork } from "../ports/unit-of-work.interface.ts";
import { ILogger } from "../ports/logger.interface.ts";
import { CreateSalesReturnDto, CreateExchangeDto } from "../dtos/dtos.ts";
import { Validator } from "../dtos/validation.ts";
import { NotFoundException, BusinessRuleException, ValidationError } from "../../domain/exceptions.ts";
import { AccountingService } from "./accounting.service.ts";
import { CogsEngineService } from "./cogs-engine.service.ts";

export class ReturnService {
  constructor(
    private readonly uow: IUnitOfWork,
    private readonly logger: ILogger
  ) {}

  // ==========================================
  // Process Sales Return & Item Restocking
  // ==========================================
  public async processReturn(dto: CreateSalesReturnDto): Promise<any> {
    this.logger.info(`Processing Sales Return number ${dto.returnNumber} for cashier: ${dto.cashierId}`);
    Validator.validateCreateSalesReturn(dto);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const salesRepo = txUow.getRepository<any>("sales", tx);
      const saleItemsRepo = txUow.getRepository<any>("saleItems", tx);
      const returnsRepo = txUow.getRepository<any>("salesReturns", tx);
      const returnItemsRepo = txUow.getRepository<any>("returnItems", tx);
      
      const customerRepo = txUow.getRepository<any>("customers", tx);
      const warehouseRepo = txUow.getRepository<any>("warehouses", tx);
      const inventoryRepo = txUow.getRepository<any>("inventory", tx);
      const movementRepo = txUow.getRepository<any>("inventoryMovements", tx);
      
      const giftCardRepo = txUow.getRepository<any>("giftCards", tx);
      const giftCardTxRepo = txUow.getRepository<any>("giftCardTransactions", tx);
      const auditRepo = txUow.getRepository<any>("auditLogs", tx);

      // Validate Original Sale (if provided)
      let originalSale: any = null;
      if (dto.saleId) {
        originalSale = await salesRepo.findById(dto.saleId);
        if (!originalSale) {
          throw new NotFoundException("sales", dto.saleId);
        }
      }

      // 1. Calculate Refund Totals
      let refundSubtotal = 0;
      let refundTaxTotal = 0;
      let totalRefundToProcess = 0;

      for (const item of dto.items) {
        let originalItem: any = null;
        if (dto.saleId && item.saleItemId) {
          originalItem = await saleItemsRepo.findById(item.saleItemId);
          if (!originalItem) {
            throw new BusinessRuleException(
              "SaleItemNotFound",
              `Sale item with ID ${item.saleItemId} does not match the referenced sale.`
            );
          }
          if (item.qty > originalItem.qty) {
            throw new BusinessRuleException(
              "ReturnQtyExceeded",
              `Proposed return qty: ${item.qty} exceeds original purchased qty: ${originalItem.qty}`
            );
          }
        }

        const price = originalItem ? Number(originalItem.unitPrice) : Number(item.unitPrice || 0);
        refundSubtotal += price * item.qty;
        
        // Match proportional items taxes
        const taxRate = originalItem ? (Number(originalItem.taxAmount) / (Number(originalItem.unitPrice) * originalItem.qty)) : 0.10;
        refundTaxTotal += (price * item.qty) * taxRate;
        totalRefundToProcess += Number(item.refundAmount || (price * item.qty * 1.10));
      }

      // 2. Process Refund logic depending on dynamic refundMethod selections
      if (dto.refundMethod === "store_credit") {
        if (!dto.customerId) {
          throw new BusinessRuleException("CustomerRequiredForCredit", "Customer profile must be linked to return refunds as store credit.");
        }
        const customer = await customerRepo.findById(dto.customerId);
        if (!customer) {
          throw new NotFoundException("customers", dto.customerId);
        }

        const currentCredit = Number(customer.storeCredit || 0);
        const nextCredit = currentCredit + totalRefundToProcess;
        
        await customerRepo.update(dto.customerId, {
          storeCredit: String(nextCredit.toFixed(2)),
          updatedAt: new Date()
        });

        // Add ledger record
        const ledgerRepo = txUow.getRepository<any>("storeCreditTransactions", tx);
        await ledgerRepo.create({
          customerId: dto.customerId,
          type: "issuance",
          amount: String(totalRefundToProcess.toFixed(2)),
          balanceAfter: String(nextCredit.toFixed(2)),
          referenceType: "return",
          createdByUserId: dto.cashierId,
          notes: `refund addition from Sales Return: ${dto.returnNumber}`,
          createdAt: new Date()
        });
      } else if (dto.refundMethod === "gift_card") {
        // Find a matching gift card for the customer or create/top-up one
        const allCards = await giftCardRepo.findAll();
        let targetCard = allCards.find((c: any) => c.customerId === dto.customerId && c.status === "active");

        if (!targetCard) {
          // Fallback to issuing a new gift card
          const randomCardNum = `GC-${Math.floor(100000 + Math.random() * 900000)}`;
          targetCard = await giftCardRepo.create({
            companyId: 1, // Default Corporate Company
            cardNumber: randomCardNum,
            initialBalance: String(totalRefundToProcess.toFixed(2)),
            currentBalance: String(totalRefundToProcess.toFixed(2)),
            status: "active",
            customerId: dto.customerId || null,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        } else {
          const bal = Number(targetCard.currentBalance);
          const nextBal = bal + totalRefundToProcess;
          await giftCardRepo.update(targetCard.id, {
            currentBalance: String(nextBal.toFixed(2)),
            updatedAt: new Date()
          });
        }

        await giftCardTxRepo.create({
          giftCardId: targetCard.id,
          type: "refund_to_card",
          amount: String(totalRefundToProcess.toFixed(2)),
          balanceAfter: String((Number(targetCard.currentBalance) + totalRefundToProcess).toFixed(2)),
          referenceType: "return",
          createdByUserId: dto.cashierId,
          createdAt: new Date()
        });
      }

      // 3. Resolve Warehouse corresponding to the current store
      const allWarehouses = await warehouseRepo.findAll();
      let storeWarehouse = allWarehouses.find((w: any) => w.storeId === dto.storeId && w.status === "active");
      
      if (!storeWarehouse) {
        storeWarehouse = allWarehouses[0];
        if (!storeWarehouse) {
          throw new BusinessRuleException("NoActiveWarehouses", "No warehouses exist. Cannot restock items.");
        }
      }

      // 4. Create Sales Return Records
      const salesReturn = await returnsRepo.create({
        returnNumber: dto.returnNumber,
        saleId: dto.saleId || null,
        storeId: dto.storeId,
        customerId: dto.customerId || null,
        cashierId: dto.cashierId,
        subtotal: String(refundSubtotal.toFixed(2)),
        taxAmount: String(refundTaxTotal.toFixed(2)),
        totalAmount: String((refundSubtotal + refundTaxTotal).toFixed(2)),
        refundAmount: String(totalRefundToProcess.toFixed(2)),
        refundMethod: dto.refundMethod,
        status: "completed",
        notes: dto.notes || null,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Insert Return Items and adjust stocks if restocked is checked
      for (const item of dto.items) {
        await returnItemsRepo.create({
          returnId: salesReturn.id,
          saleItemId: item.saleItemId || null,
          productId: item.productId,
          variantId: item.variantId || null,
          qty: item.qty,
          unitPrice: String(item.unitPrice.toFixed(2)),
          refundAmount: String(item.refundAmount.toFixed(2)),
          restocked: item.restocked,
          reasonCode: item.reasonCode || null
        });

        if (item.restocked) {
          const allInventory = await inventoryRepo.findAll();
          let invRow = allInventory.find(
            (i: any) =>
              i.warehouseId === storeWarehouse.id &&
              i.productId === item.productId &&
              (item.variantId ? i.variantId === item.variantId : !i.variantId)
          );

          if (!invRow) {
            invRow = await inventoryRepo.create({
              warehouseId: storeWarehouse.id,
              productId: item.productId,
              variantId: item.variantId || null,
              quantity: 0,
              reorderLevel: 5,
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }

          const nextQty = invRow.quantity + item.qty;
          await inventoryRepo.update(invRow.id, {
            quantity: nextQty,
            updatedAt: new Date()
          });

          // Insert restorative physical movement records
          await movementRepo.create({
            inventoryId: invRow.id,
            type: "receiving", // restock
            quantity: item.qty,
            unitCost: String(item.unitPrice.toFixed(2)),
            reasonCode: item.reasonCode || "customer_return",
            referenceType: "return",
            referenceId: salesReturn.id,
            userId: dto.cashierId,
            createdAt: new Date()
          });

          // FIFO Cost Layer Reinstating Process
          if (item.saleItemId) {
            const cogsEngine = new CogsEngineService(txUow, this.logger);
            await cogsEngine.reinstateRefundedLayers(item.saleItemId, item.qty, tx);
          }
        }
      }

      await auditRepo.create({
        action: "SALES_RETURN",
        entityName: "sales_returns",
        entityId: salesReturn.id,
        details: `Processed sales return ${dto.returnNumber}. Total Refund: ${totalRefundToProcess}`,
        createdAt: new Date()
      });

      // ==========================================
      // AUTOMATIC POSTING: Double-Entry Accounting
      // ==========================================
      try {
        const accountingService = new AccountingService(txUow, this.logger);
        const lines = [];

        // Debits:
        // Contra Sales Revenue (Initially Debited)
        if (refundSubtotal > 0) {
          lines.push({
            accountCode: "4020",
            accountName: "Sales Returns & Refunds",
            accountType: "revenue" as const,
            debit: Number(refundSubtotal.toFixed(2)),
            credit: 0
          });
        }
        // Taxes Reversal (Normally Debited)
        if (refundTaxTotal > 0) {
          lines.push({
            accountCode: "2300",
            accountName: "Taxes Payable",
            accountType: "liabilities" as const,
            debit: Number(refundTaxTotal.toFixed(2)),
            credit: 0
          });
        }

        // Credits:
        const refundAmt = Number(totalRefundToProcess);
        if (refundAmt > 0) {
          if (dto.refundMethod === "store_credit") {
            lines.push({
              accountCode: "2100",
              accountName: "Store Credit Liability",
              accountType: "liabilities" as const,
              debit: 0,
              credit: refundAmt
            });
          } else if (dto.refundMethod === "gift_card") {
            lines.push({
              accountCode: "2200",
              accountName: "Gift Card Liability",
              accountType: "liabilities" as const,
              debit: 0,
              credit: refundAmt
            });
          } else {
            lines.push({
              accountCode: "1010",
              accountName: "Cash and Cash Equivalents",
              accountType: "assets" as const,
              debit: 0,
              credit: refundAmt
            });
          }
        }

        // Balancing adjust
        const entriesSum = lines.reduce((acc, l) => acc + (l.debit || 0), 0);
        const creditsSum = lines.reduce((acc, l) => acc + (l.credit || 0), 0);
        const diff = entriesSum - creditsSum;
        if (Math.abs(diff) > 0.001) {
          const lineToAdjust = lines.find(l => l.accountCode === "4020") || lines.find(l => l.accountCode === "1010");
          if (lineToAdjust) {
            if (lineToAdjust.debit > 0) {
              lineToAdjust.debit = Number((lineToAdjust.debit - diff).toFixed(2));
            } else {
              lineToAdjust.credit = Number((lineToAdjust.credit + diff).toFixed(2));
            }
          }
        }

        if (lines.length >= 2) {
          await accountingService.postJournalEntry({
            companyId: 1,
            storeId: dto.storeId,
            referenceType: "return",
            referenceId: salesReturn.id,
            description: `Automatic posting for Sales Return ${dto.returnNumber}`,
            lines
          }, txUow, tx);
        }

        // COGS Restocking Entry
        let returnedCOGS = 0;
        const prodRepo = txUow.getRepository<any>("products", tx);
        const varRepo = txUow.getRepository<any>("productVariants", tx);

        for (const item of dto.items) {
          if (item.restocked) {
            const product = await prodRepo.findById(item.productId);
            let costPrice = product ? Number(product.costPrice || 0) : Number(item.unitPrice || 0);
            
            if (item.variantId) {
              const variant = await varRepo.findById(item.variantId);
              if (variant && variant.costPrice) {
                costPrice = Number(variant.costPrice);
              }
            }
            returnedCOGS += costPrice * item.qty;
          }
        }

        if (returnedCOGS > 0) {
          await accountingService.postJournalEntry({
            companyId: 1,
            storeId: dto.storeId,
            referenceType: "return",
            referenceId: salesReturn.id,
            description: `Automatic restocking inventory recovery for return ${dto.returnNumber}`,
            lines: [
              {
                accountCode: "1300",
                accountName: "Inventory Asset",
                accountType: "assets" as const,
                debit: Number(returnedCOGS.toFixed(2)),
                credit: 0
              },
              {
                accountCode: "5010",
                accountName: "Cost of Goods Sold (COGS)",
                accountType: "expenses" as const,
                debit: 0,
                credit: Number(returnedCOGS.toFixed(2))
              }
            ]
          }, txUow, tx);
        }
      } catch (err: any) {
        this.logger.error(`Failed automatic journal posting for Sales Return ${dto.returnNumber}: ${err.message}`);
        throw err;
      }

      this.logger.info(`Sales Return successfully recorded with ID ${salesReturn.id}`);
      return salesReturn;
    });
  }

  // ==========================================
  // Process Even/Uneven Exchange Workflow
  // ==========================================
  public async processExchange(
    returnPayload: CreateSalesReturnDto,
    exchangeItems: any[], // Simple product / variants payload to purchase
    cashierId: number,
    payments: any[]
  ): Promise<any> {
    this.logger.info(`Starting unified POS exchange cycle (Return + Checkout)`);

    return this.uow.runInTransaction(async (txUow, tx) => {
      // 1. Process the Return first
      const completedReturn = await this.processReturn(returnPayload);
      const refundAmountDecimal = Number(completedReturn.refundAmount);

      // 2. Prepare dynamic cart calculated totals for the replacement items
      const posRepo = txUow.getRepository<any>("sales", tx); // We can construct Checkout locally in tx
      
      let newSubtotal = 0;
      let newTax = 0;
      const productRepo = txUow.getRepository<any>("products", tx);
      const variantRepo = txUow.getRepository<any>("productVariants", tx);

      const computedItems = [];
      for (const item of exchangeItems) {
        const product = await productRepo.findById(item.productId);
        if (!product) {
          throw new NotFoundException("products", item.productId);
        }
        let price = Number(product.retailPrice);
        if (item.variantId) {
          const variant = await variantRepo.findById(item.variantId);
          if (variant) price = Number(variant.retailPrice || price);
        }

        const qty = Number(item.qty || 1);
        const rawTax = (price * qty) * 0.10; // default 10%
        newSubtotal += price * qty;
        newTax += rawTax;

        computedItems.push({
          productId: item.productId,
          variantId: item.variantId || null,
          qty,
          unitPrice: price,
          costPrice: Number(product.costPrice || 0),
          discountAmount: 0,
          taxAmount: rawTax,
        });
      }

      const newTotalAmount = newSubtotal + newTax;
      const differenceAmount = newTotalAmount - refundAmountDecimal;

      // 3. Process new Checkout Sale
      const salesRepo = txUow.getRepository<any>("sales", tx);
      const saleItemsRepo = txUow.getRepository<any>("saleItems", tx);
      const paymentsRepo = txUow.getRepository<any>("payments", tx);
      const invoicesRepo = txUow.getRepository<any>("invoices", tx);
      const receiptsRepo = txUow.getRepository<any>("receipts", tx);
      const exchangeRepo = txUow.getRepository<any>("exchanges", tx);
      const auditRepo = txUow.getRepository<any>("auditLogs", tx);
      const warehouseRepo = txUow.getRepository<any>("warehouses", tx);
      const inventoryRepo = txUow.getRepository<any>("inventory", tx);
      const movementRepo = txUow.getRepository<any>("inventoryMovements", tx);

      const invoiceNum = `INV-EX-${Date.now().toString().slice(-6)}`;
      const newSale = await salesRepo.create({
        invoiceNumber: invoiceNum,
        storeId: returnPayload.storeId,
        customerId: returnPayload.customerId || null,
        cashierId: cashierId,
        shiftId: null,
        subtotal: String(newSubtotal.toFixed(2)),
        discountAmount: "0.00",
        taxAmount: String(newTax.toFixed(2)),
        totalAmount: String(newTotalAmount.toFixed(2)),
        paymentStatus: "paid",
        syncStatus: "synced",
        createdAt: new Date()
      });

      // Resolve Warehouse
      const allWH = await warehouseRepo.findAll();
      let storeWarehouse = allWH.find((w: any) => w.storeId === returnPayload.storeId && w.status === "active") || allWH[0];

      // Insert item and deduct stock
      for (const item of computedItems) {
        await saleItemsRepo.create({
          saleId: newSale.id,
          productId: item.productId,
          variantId: item.variantId,
          qty: item.qty,
          unitPrice: String(item.unitPrice.toFixed(2)),
          costPrice: String(item.costPrice.toFixed(2)),
          discountAmount: "0.00",
          taxAmount: String(item.taxAmount.toFixed(2)),
        });

        const allInv = await inventoryRepo.findAll();
        let invRow = allInv.find(
          (i: any) =>
            i.warehouseId === storeWarehouse.id &&
            i.productId === item.productId &&
            (item.variantId ? i.variantId === item.variantId : !i.variantId)
        );

        if (!invRow) {
          invRow = await inventoryRepo.create({
            warehouseId: storeWarehouse.id,
            productId: item.productId,
            variantId: item.variantId || null,
            quantity: 0,
            reorderLevel: 5,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }

        await inventoryRepo.update(invRow.id, {
          quantity: invRow.quantity - item.qty,
          updatedAt: new Date()
        });

        await movementRepo.create({
          inventoryId: invRow.id,
          type: "sale",
          quantity: -item.qty,
          unitCost: String(item.costPrice.toFixed(2)),
          referenceType: "sale",
          referenceId: newSale.id,
          userId: cashierId,
          createdAt: new Date()
        });
      }

      // Record payments
      // Auto-credit the refund amount from the return payload
      await paymentsRepo.create({
        saleId: newSale.id,
        paymentMethod: "store_credit", // Refund credited directly
        amount: String(Math.min(newTotalAmount, refundAmountDecimal).toFixed(2)),
        transactionRef: `Exchange return offset ID ${completedReturn.id}`,
        createdAt: new Date()
      });

      // Record any cash/credit difference collection
      if (differenceAmount > 0) {
        for (const pmt of payments) {
          await paymentsRepo.create({
            saleId: newSale.id,
            paymentMethod: pmt.paymentMethod,
            amount: String(Number(pmt.amount).toFixed(2)),
            transactionRef: pmt.transactionRef || null,
            createdAt: new Date()
          });
        }
      }

      await invoicesRepo.create({
        saleId: newSale.id,
        invoiceNumber: invoiceNum,
        dueDate: new Date(),
        status: "paid",
        createdAt: new Date()
      });

      await receiptsRepo.create({
        saleId: newSale.id,
        receiptNumber: `RCT-EX-${newSale.id}-${Date.now().toString().slice(-4)}`,
        type: "print",
        status: "sent",
        sentAt: new Date(),
        createdAt: new Date()
      });

      // Create linkage inside exchanges registry
      const exchangeRec = await exchangeRepo.create({
        exchangeNumber: `EX-${Date.now().toString().slice(-6)}`,
        storeId: returnPayload.storeId,
        customerId: returnPayload.customerId || null,
        cashierId: cashierId,
        returnId: completedReturn.id,
        newSaleId: newSale.id,
        differenceAmount: String(differenceAmount.toFixed(2)),
        paymentStatus: differenceAmount === 0 ? "even_exchange" : (differenceAmount > 0 ? "paid" : "refunded"),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await auditRepo.create({
        action: "PRODUCT_EXCHANGE",
        entityName: "exchanges",
        entityId: exchangeRec.id,
        details: `Completed product exchange session. Linked return: ${completedReturn.id}, linked sale: ${newSale.id}, cash diff: ${differenceAmount.toFixed(2)}`,
        createdAt: new Date()
      });

      this.logger.info(`Exchange workflow completed perfectly. Records mapped correctly.`);

      return {
        exchange: exchangeRec,
        return: completedReturn,
        sale: newSale,
      };
    });
  }
}
