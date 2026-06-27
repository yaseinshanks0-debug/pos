// src/backend/application/services/pos.service.ts

import { IUnitOfWork } from "../ports/unit-of-work.interface.ts";
import { ILogger } from "../ports/logger.interface.ts";
import { CreateSaleDto } from "../dtos/dtos.ts";
import { Validator } from "../dtos/validation.ts";
import { NotFoundException, BusinessRuleException, ValidationError } from "../../domain/exceptions.ts";
import { AccountingService } from "./accounting.service.ts";
import { CogsEngineService } from "./cogs-engine.service.ts";

export class PosService {
  constructor(
    private readonly uow: IUnitOfWork,
    private readonly logger: ILogger
  ) {}

  // ==========================================
  // Product Search & Barcode Lookup
  // ==========================================
  public async productLookup(barcodeOrSku: string): Promise<any> {
    this.logger.info(`Performing dynamic POS lookup for SKU/Barcode: ${barcodeOrSku}`);
    
    const productRepo = this.uow.getRepository<any>("products");
    const variantRepo = this.uow.getRepository<any>("productVariants");

    const allProducts = await productRepo.findAll();
    const allVariants = await variantRepo.findAll();

    // 1. Search variants
    const variant = allVariants.find(
      (v: any) => v.barcode === barcodeOrSku || v.sku === barcodeOrSku
    );
    if (variant) {
      const parent = allProducts.find((p: any) => p.id === variant.productId);
      return {
        isVariant: true,
        productId: parent ? parent.id : variant.productId,
        variantId: variant.id,
        sku: variant.sku,
        barcode: variant.barcode,
        name: parent ? `${parent.name} (${variant.variantName})` : variant.variantName,
        retailPrice: Number(variant.retailPrice || (parent ? parent.retailPrice : 0)),
        costPrice: Number(variant.costPrice || (parent ? parent.costPrice : 0)),
        isActive: variant.isActive !== false,
      };
    }

    // 2. Search products
    const product = allProducts.find(
      (p: any) => p.barcode === barcodeOrSku || p.sku === barcodeOrSku
    );
    if (product) {
      return {
        isVariant: false,
        productId: product.id,
        variantId: null,
        sku: product.sku,
        barcode: product.barcode,
        name: product.name,
        retailPrice: Number(product.retailPrice || 0),
        costPrice: Number(product.costPrice || 0),
        isActive: true,
      };
    }

    throw new NotFoundException("products", 0);
  }

  public async searchProducts(query: string): Promise<any[]> {
    this.logger.info(`Searching product catalog with keyword: ${query}`);
    const productRepo = this.uow.getRepository<any>("products");
    const variantRepo = this.uow.getRepository<any>("productVariants");

    const allProducts = await productRepo.findAll();
    const allVariants = await variantRepo.findAll();

    const searchStr = query.toLowerCase().trim();
    if (!searchStr) {
      return allProducts.map((p: any) => ({
        id: p.id,
        sku: p.sku,
        barcode: p.barcode,
        name: p.name,
        retailPrice: Number(p.retailPrice),
        costPrice: Number(p.costPrice),
        variants: allVariants.filter((v: any) => v.productId === p.id),
      }));
    }

    const matchedProducts = allProducts.filter(
      (p: any) =>
        p.name.toLowerCase().includes(searchStr) ||
        p.sku.toLowerCase().includes(searchStr) ||
        p.barcode.includes(searchStr)
    );

    const matches: any[] = [];
    matchedProducts.forEach((p: any) => {
      const variants = allVariants.filter((v: any) => v.productId === p.id);
      matches.push({
        id: p.id,
        sku: p.sku,
        barcode: p.barcode,
        name: p.name,
        retailPrice: Number(p.retailPrice),
        costPrice: Number(p.costPrice),
        variants: variants,
      });
    });

    // Also look up variants directly
    allVariants.forEach((v: any) => {
      if (
        (v.variantName.toLowerCase().includes(searchStr) ||
          v.sku.toLowerCase().includes(searchStr) ||
          v.barcode.includes(searchStr)) &&
        !matches.some((m) => m.id === v.productId)
      ) {
        const parent = allProducts.find((p: any) => p.id === v.productId);
        if (parent) {
          matches.push({
            id: parent.id,
            sku: parent.sku,
            barcode: parent.barcode,
            name: parent.name,
            retailPrice: Number(parent.retailPrice),
            costPrice: Number(parent.costPrice),
            variants: [v],
          });
        }
      }
    });

    return matches;
  }

  // ==========================================
  // Calculations / Cart Estimation
  // ==========================================
  public async calculateCheckout(dto: Partial<CreateSaleDto>): Promise<any> {
    this.logger.info(`Calculating tax and discount metrics for tentative cart list`);
    
    let subtotal = 0;
    let taxAmount = 0;
    let discountAmount = Number(dto.discountAmount || 0);

    const productRepo = this.uow.getRepository<any>("products");
    const variantRepo = this.uow.getRepository<any>("productVariants");
    const cogsEngine = new CogsEngineService(this.uow, this.logger);

    const itemsCalculated = [];
    if (dto.items && dto.items.length > 0) {
      for (const item of dto.items) {
        let price = Number(item.unitPrice || 0);
        let origCost = 0;
        
        if (item.productId) {
          const product = await productRepo.findById(item.productId);
          if (product) {
            price = !!item.unitPrice ? Number(item.unitPrice) : Number(product.retailPrice);
            origCost = Number(product.costPrice || 0);
          }
          if (item.variantId) {
            const variant = await variantRepo.findById(item.variantId);
            if (variant) {
              price = !!item.unitPrice ? Number(item.unitPrice) : Number(variant.retailPrice || price);
              origCost = Number(variant.costPrice || origCost);
              if (!item.unitPrice && dto.storeId) {
                price = await cogsEngine.getStorePrice(dto.storeId, item.variantId, price);
              }
            }
          } else if (dto.storeId) {
            // Find default/first variant under this product to check overrides
            const allPVs = await variantRepo.findAll({ productId: item.productId });
            if (allPVs && allPVs.length > 0 && !item.unitPrice) {
              price = await cogsEngine.getStorePrice(dto.storeId, allPVs[0].id, price);
            }
          }
        }

        const qty = Number(item.qty || 1);
        const itemSubtotal = price * qty;
        
        // Simple default dynamic 10% tax categorizer rule if tax rule is not explicit
        const itemTax = itemSubtotal * 0.10; 
        const itemDiscount = Number(item.discountAmount || 0);

        subtotal += itemSubtotal;
        taxAmount += itemTax;

        itemsCalculated.push({
          productId: item.productId,
          variantId: item.variantId || null,
          qty,
          unitPrice: price,
          costPrice: origCost,
          subtotal: itemSubtotal,
          discountAmount: itemDiscount,
          taxAmount: itemTax,
        });
      }
    }

    const totalAmount = subtotal + taxAmount - discountAmount;

    return {
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount: Math.max(0, totalAmount),
      items: itemsCalculated,
    };
  }

  // ==========================================
  // Checkout POS Transaction (Engine Core)
  // ==========================================
  public async checkout(dto: CreateSaleDto): Promise<any> {
    this.logger.info(`Starting POS checkout routing flow for cashier: ${dto.cashierId}`);
    Validator.validateCreateSale(dto);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const salesRepo = txUow.getRepository<any>("sales", tx);
      const saleItemsRepo = txUow.getRepository<any>("saleItems", tx);
      const paymentsRepo = txUow.getRepository<any>("payments", tx);
      const invoicesRepo = txUow.getRepository<any>("invoices", tx);
      const receiptsRepo = txUow.getRepository<any>("receipts", tx);

      const customerRepo = txUow.getRepository<any>("customers", tx);
      const warehouseRepo = txUow.getRepository<any>("warehouses", tx);
      const inventoryRepo = txUow.getRepository<any>("inventory", tx);
      const movementRepo = txUow.getRepository<any>("inventoryMovements", tx);
      const auditRepo = txUow.getRepository<any>("auditLogs", tx);

      // 1. Resolve Warehouse corresponding to the current checkout store
      const allWarehouses = await warehouseRepo.findAll();
      let storeWarehouse = allWarehouses.find((w: any) => w.storeId === dto.storeId && w.status === "active");
      
      if (!storeWarehouse) {
        // Fallback to absolute first warehouse if store specific is missing
        storeWarehouse = allWarehouses[0];
        if (!storeWarehouse) {
          throw new BusinessRuleException("NoActiveWarehouses", "No warehouses exist. Cannot deduct stock levels.");
        }
      }

      // Calculate totals
      const calcResult = await this.calculateCheckout(dto);

      // Validate Shift status if shiftId is provided
      if (dto.shiftId) {
        const shiftRepo = txUow.getRepository<any>("shifts", tx);
        const activeShift = await shiftRepo.findById(dto.shiftId);
        if (!activeShift || activeShift.status !== "open") {
          throw new BusinessRuleException("InvalidShift", `Shift ${dto.shiftId} is not active/open.`);
        }
      }

      // 2. Validate and deduct customer balances (gift_card, store_credit, loyalty points)
      let totalAmountToCollect = calcResult.totalAmount;

      const giftCardRepo = txUow.getRepository<any>("giftCards", tx);
      const gcTxRepo = txUow.getRepository<any>("giftCardTransactions", tx);

      for (const pmt of dto.payments) {
        if (pmt.paymentMethod === "gift_card") {
          if (!dto.giftCardNumberUsed) {
            throw new BusinessRuleException("GiftCardMissing", "Gift card code must be provided.");
          }
          const allCards = await giftCardRepo.findAll();
          const card = allCards.find((c: any) => c.cardNumber === dto.giftCardNumberUsed);
          if (!card || card.status !== "active") {
            throw new BusinessRuleException("InvalidGiftCard", "The specified gift card is inactive or not found.");
          }

          const bal = Number(card.currentBalance);
          const deduct = Math.min(bal, Number(pmt.amount));

          const newGCBal = bal - deduct;
          await giftCardRepo.update(card.id, {
            currentBalance: String(newGCBal.toFixed(2)),
            status: newGCBal <= 0 ? "disabled" : "active",
            updatedAt: new Date()
          });

          await gcTxRepo.create({
            giftCardId: card.id,
            type: "redeem",
            amount: String((-deduct).toFixed(2)),
            balanceAfter: String(newGCBal.toFixed(2)),
            referenceType: "sale",
            createdAt: new Date()
          });

          this.logger.info(`Deducted ${deduct} from gift card code ${card.cardNumber}`);
        }

        if (pmt.paymentMethod === "store_credit") {
          if (!dto.customerId) {
            throw new BusinessRuleException("CustomerRequiredForCredit", "Customer profile is required to spend store credits.");
          }
          const customer = await customerRepo.findById(dto.customerId);
          if (!customer) {
            throw new NotFoundException("customers", dto.customerId);
          }

          const scBal = Number(customer.storeCredit || 0);
          const deduct = Math.min(scBal, Number(pmt.amount));

          const newSCBal = scBal - deduct;
          await customerRepo.update(dto.customerId, {
            storeCredit: String(newSCBal.toFixed(2)),
            updatedAt: new Date()
          });

          const ledgerRepo = txUow.getRepository<any>("storeCreditTransactions", tx);
          await ledgerRepo.create({
            customerId: dto.customerId,
            type: "redemption",
            amount: String((-deduct).toFixed(2)),
            balanceAfter: String(newSCBal.toFixed(2)),
            referenceType: "sale",
            createdByUserId: dto.cashierId,
            notes: `Consumed store credit during checkout transaction`,
            createdAt: new Date()
          });

          this.logger.info(`Redeemed ${deduct} store credit elements from customer ID ${dto.customerId}`);
        }
      }

      // 3. Deduct stock and write transaction details
      const invoiceNum = `INV-POS-${Date.now().toString().slice(-6)}`;
      const cogsEngine = new CogsEngineService(txUow, this.logger);

      const settingsRepo = txUow.getRepository<any>("settings", tx);
      const allStoreSettings = await settingsRepo.findAll({ storeId: dto.storeId });
      const allowNegSetting = allStoreSettings.find(
        (s: any) => s.key === "allow_negative_inventory" || s.key === "AllowNegativeInventory"
      );
      const allowNegative = allowNegSetting ? allowNegSetting.value !== "false" : true;

      const sale = await salesRepo.create({
        invoiceNumber: invoiceNum,
        storeId: dto.storeId,
        customerId: dto.customerId || null,
        cashierId: dto.cashierId,
        shiftId: dto.shiftId || null,
        subtotal: String(calcResult.subtotal.toFixed(2)),
        discountAmount: String(calcResult.discountAmount.toFixed(2)),
        taxAmount: String(calcResult.taxAmount.toFixed(2)),
        totalAmount: String(totalAmountToCollect.toFixed(2)),
        paymentStatus: "paid",
        syncStatus: "synced",
        createdAt: new Date()
      });

      // Insert Items & adjust physical stocks
      const saleItemsCreated = [];
      for (const item of calcResult.items) {
        const addedItem = await saleItemsRepo.create({
          saleId: sale.id,
          productId: item.productId,
          variantId: item.variantId,
          qty: item.qty,
          unitPrice: String(item.unitPrice.toFixed(2)),
          costPrice: String(item.costPrice.toFixed(2)),
          discountAmount: String(item.discountAmount.toFixed(2)),
          taxAmount: String(item.taxAmount.toFixed(2)),
        });
        saleItemsCreated.push(addedItem);

        // Deduct Inventory Stock Level
        const allInventory = await inventoryRepo.findAll();
        let invRow = allInventory.find(
          (i: any) =>
            i.warehouseId === storeWarehouse.id &&
            i.productId === item.productId &&
            (item.variantId ? i.variantId === item.variantId : !i.variantId)
        );

        if (!invRow) {
          // Setup initial index if missing
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

        const nextQuantity = invRow.quantity - item.qty;
        if (!allowNegative && nextQuantity < 0) {
          throw new BusinessRuleException(
            "InsufficientStock",
            `Insufficient stock remaining for product variant ID ${item.variantId || item.productId} at store ${dto.storeId}. AllowNegativeInventory is disabled.`
          );
        }
        await inventoryRepo.update(invRow.id, {
          quantity: nextQuantity,
          updatedAt: new Date()
        });

        // Add movement log
        const mLog = await movementRepo.create({
          inventoryId: invRow.id,
          type: "sale",
          quantity: -item.qty,
          unitCost: String(item.costPrice.toFixed(2)),
          referenceType: "sale",
          referenceId: sale.id,
          userId: dto.cashierId,
          createdAt: new Date()
        });

        // FIFO Cost Layer Depletion Process
        let resolvedVariantId = item.variantId;
        if (!resolvedVariantId) {
          const variantRepo = txUow.getRepository<any>("productVariants", tx);
          const allPVs = await variantRepo.findAll({ productId: item.productId });
          if (allPVs && allPVs.length > 0) {
            resolvedVariantId = allPVs[0].id;
          }
        }

        if (resolvedVariantId) {
          const depletion = await cogsEngine.depleteFifoLayers(
            1, // CompanyId defaults to 1
            dto.storeId,
            resolvedVariantId,
            item.qty,
            addedItem.id,
            mLog.id,
            tx
          );
          
          if (depletion.totalCOGS > 0) {
            const fifoUnitCost = depletion.totalCOGS / item.qty;
            await saleItemsRepo.update(addedItem.id, {
              costPrice: String(fifoUnitCost.toFixed(2))
            });
            item.costPrice = fifoUnitCost;
            
            // Re-align the inventory movement cost to matched FIFO unit cost
            await movementRepo.update(mLog.id, {
              unitCost: String(fifoUnitCost.toFixed(2))
            });
          }
        }
      }

      // Add payments records
      for (const pmt of dto.payments) {
        await paymentsRepo.create({
          saleId: sale.id,
          paymentMethod: pmt.paymentMethod,
          amount: String(Number(pmt.amount).toFixed(2)),
          transactionRef: pmt.transactionRef || null,
          createdAt: new Date()
        });
      }

      // 4. Update Customer Loyalty program point metrics
      if (dto.customerId) {
        const customer = await customerRepo.findById(dto.customerId);
        if (customer) {
          // Standard Rule: Earn 1 point per $10 spent
          const pointsEarned = Math.floor(totalAmountToCollect / 10);
          let newPoints = customer.loyaltyPoints + pointsEarned;
          
          if (dto.pointsRedeemed && dto.pointsRedeemed > 0) {
            newPoints = Math.max(0, newPoints - dto.pointsRedeemed);
            const loyaltyRepo = txUow.getRepository<any>("loyaltyTransactions", tx);
            await loyaltyRepo.create({
              customerId: dto.customerId,
              saleId: sale.id,
              pointsEarned: 0,
              pointsRedeemed: dto.pointsRedeemed,
              transactionType: "redeem",
              createdAt: new Date()
            });
          }

          if (pointsEarned > 0) {
            const loyaltyRepo = txUow.getRepository<any>("loyaltyTransactions", tx);
            await loyaltyRepo.create({
              customerId: dto.customerId,
              saleId: sale.id,
              pointsEarned,
              pointsRedeemed: 0,
              transactionType: "earn",
              createdAt: new Date()
            });
          }

          await customerRepo.update(dto.customerId, {
            loyaltyPoints: newPoints,
            updatedAt: new Date()
          });
        }
      }

      // 5. Invoicing & receipt compilation
      const invoice = await invoicesRepo.create({
        saleId: sale.id,
        invoiceNumber: invoiceNum,
        dueDate: new Date(),
        status: "paid",
        createdAt: new Date()
      });

      const receipt = await receiptsRepo.create({
        saleId: sale.id,
        receiptNumber: `RCT-${sale.id}-${Date.now().toString().slice(-4)}`,
        type: "print",
        sentTo: null,
        status: "sent",
        sentAt: new Date(),
        createdAt: new Date()
      });

      await auditRepo.create({
        action: "SALE_CHECKOUT",
        entityName: "sales",
        entityId: sale.id,
        details: `Successfully completed checkout on invoice ${invoiceNum}. Total: ${totalAmountToCollect}`,
        createdAt: new Date()
      });

      // ==========================================
      // AUTOMATIC POSTING: Double-Entry Accounting
      // ==========================================
      try {
        const accountingService = new AccountingService(txUow, this.logger);
        
        let gcRedeemed = 0;
        let scRedeemed = 0;
        let cashCollected = 0;

        dto.payments.forEach((pmt) => {
          const amt = Number(pmt.amount);
          if (pmt.paymentMethod === "gift_card") {
            gcRedeemed += amt;
          } else if (pmt.paymentMethod === "store_credit") {
            scRedeemed += amt;
          } else {
            cashCollected += amt;
          }
        });

        const lines = [];

        // Credits:
        // Revenue (Normally Credited)
        const netRev = calcResult.subtotal - calcResult.discountAmount;
        if (netRev > 0) {
          lines.push({
            accountCode: "4010",
            accountName: "Sales Revenue",
            accountType: "revenue" as const,
            debit: 0,
            credit: Number(netRev.toFixed(2))
          });
        }
        // Taxes (Normally Credited)
        if (calcResult.taxAmount > 0) {
          lines.push({
            accountCode: "2300",
            accountName: "Taxes Payable",
            accountType: "liabilities" as const,
            debit: 0,
            credit: Number(calcResult.taxAmount.toFixed(2))
          });
        }

        // Debits:
        if (gcRedeemed > 0) {
          lines.push({
            accountCode: "2200",
            accountName: "Gift Card Liability",
            accountType: "liabilities" as const,
            debit: Number(gcRedeemed.toFixed(2)),
            credit: 0
          });
        }
        if (scRedeemed > 0) {
          lines.push({
            accountCode: "2100",
            accountName: "Store Credit Liability",
            accountType: "liabilities" as const,
            debit: Number(scRedeemed.toFixed(2)),
            credit: 0
          });
        }
        if (cashCollected > 0) {
          lines.push({
            accountCode: "1010",
            accountName: "Cash and Cash Equivalents",
            accountType: "assets" as const,
            debit: Number(cashCollected.toFixed(2)),
            credit: 0
          });
        }

        // Balancing check & adjustment
        const entriesSum = lines.reduce((acc, l) => acc + (l.debit || 0), 0);
        const creditsSum = lines.reduce((acc, l) => acc + (l.credit || 0), 0);
        const diff = entriesSum - creditsSum;
        if (Math.abs(diff) > 0.001) {
          const lineToAdjust = lines.find(l => l.accountCode === "1010") || lines.find(l => l.accountCode === "4010");
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
            companyId: 1, // Default main company
            storeId: dto.storeId,
            referenceType: "sale",
            referenceId: sale.id,
            description: `Automatic posting for POS Sale invoice ${invoiceNum}`,
            lines
          }, txUow, tx);
        }

        // COGS Posting
        let totalCOGS = 0;
        calcResult.items.forEach((it) => {
          totalCOGS += (it.costPrice * it.qty);
        });

        if (totalCOGS > 0) {
          await accountingService.postJournalEntry({
            companyId: 1,
            storeId: dto.storeId,
            referenceType: "sale",
            referenceId: sale.id,
            description: `Automatic COGS posting for POS Sale invoice ${invoiceNum}`,
            lines: [
              {
                accountCode: "5010",
                accountName: "Cost of Goods Sold (COGS)",
                accountType: "expenses" as const,
                debit: Number(totalCOGS.toFixed(2)),
                credit: 0
              },
              {
                accountCode: "1300",
                accountName: "Inventory Asset",
                accountType: "assets" as const,
                debit: 0,
                credit: Number(totalCOGS.toFixed(2))
              }
            ]
          }, txUow, tx);
        }
      } catch (err: any) {
        this.logger.error(`Failed automatic journal posting for POS Sale: ${err.message}`);
        throw err;
      }

      this.logger.info(`Checkout completely compiled. Sale ID ${sale.id} issued successfully.`);

      return {
        sale,
        items: saleItemsCreated,
        invoice,
        receipt,
      };
    });
  }
}
