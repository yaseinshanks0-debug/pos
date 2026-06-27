// src/backend/application/services/customer.service.ts

import { IUnitOfWork } from "../ports/unit-of-work.interface.ts";
import { ILogger } from "../ports/logger.interface.ts";
import { CreateCustomerDto } from "../dtos/dtos.ts";
import { Validator } from "../dtos/validation.ts";
import { NotFoundException, BusinessRuleException, ValidationError } from "../../domain/exceptions.ts";
import { AccountingService } from "./accounting.service.ts";

export class CustomerService {
  constructor(
    private readonly uow: IUnitOfWork,
    private readonly logger: ILogger
  ) {}

  public async createCustomer(dto: CreateCustomerDto): Promise<any> {
    this.logger.info(`Validating dynamic customer registration signature for: ${dto.name}`);
    Validator.validateCreateCustomer(dto);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const customerRepo = txUow.getRepository<any>("customers", tx);

      // Verify unique mobile number
      const allCustomers = await customerRepo.findAll();
      const duplicate = allCustomers.find(
        (c: any) => c.mobileNumber.replace(/[\s+-]/g, "") === dto.mobileNumber.replace(/[\s+-]/g, "")
      );

      if (duplicate) {
        throw new ValidationError({ mobileNumber: ["A customer with this mobile number is already registered."] });
      }

      const customer = await customerRepo.create({
        name: dto.name,
        mobileNumber: dto.mobileNumber.trim(),
        email: dto.email || null,
        address: dto.address || null,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        customerGroupId: dto.customerGroupId || null,
        loyaltyPoints: 0,
        balance: "0.00",
        storeCredit: "0.00",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      this.logger.info(`Successfully created customer ID ${customer.id}`);
      return customer;
    });
  }

  public async lookupCustomer(query: string): Promise<any[]> {
    this.logger.info(`Searching customer registers with query key: ${query}`);
    const customerRepo = this.uow.getRepository<any>("customers");
    const all = await customerRepo.findAll();
    
    const searchVal = query.toLowerCase().trim();
    if (!searchVal) return all;

    return all.filter((c: any) => 
      c.name.toLowerCase().includes(searchVal) ||
      c.mobileNumber.includes(searchVal) ||
      (c.email && c.email.toLowerCase().includes(searchVal))
    );
  }

  public async getCustomerById(id: number): Promise<any> {
    const customerRepo = this.uow.getRepository<any>("customers");
    const customer = await customerRepo.findById(id);
    if (!customer) {
      throw new NotFoundException("customers", id);
    }
    return customer;
  }

  public async earnLoyaltyPoints(id: number, points: number, saleId?: number): Promise<any> {
    this.logger.info(`Adding ${points} loyalty points to customer ID ${id}`);
    
    return this.uow.runInTransaction(async (txUow, tx) => {
      const customerRepo = txUow.getRepository<any>("customers", tx);
      const loyaltyRepo = txUow.getRepository<any>("loyaltyTransactions", tx);
      const customer = await customerRepo.findById(id);

      if (!customer) {
        throw new NotFoundException("customers", id);
      }

      const updated = await customerRepo.update(id, {
        loyaltyPoints: customer.loyaltyPoints + points,
        updatedAt: new Date()
      });

      await loyaltyRepo.create({
        customerId: id,
        saleId: saleId || null,
        pointsEarned: points,
        pointsRedeemed: 0,
        transactionType: "earn",
        createdAt: new Date()
      });

      return updated;
    });
  }

  public async redeemLoyaltyPoints(id: number, points: number, saleId?: number): Promise<any> {
    this.logger.info(`Redeeming ${points} loyalty points from customer ID ${id}`);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const customerRepo = txUow.getRepository<any>("customers", tx);
      const loyaltyRepo = txUow.getRepository<any>("loyaltyTransactions", tx);
      const customer = await customerRepo.findById(id);

      if (!customer) {
        throw new NotFoundException("customers", id);
      }

      if (customer.loyaltyPoints < points) {
        throw new BusinessRuleException(
          "InsufficientLoyaltyPoints",
          `Customer only has ${customer.loyaltyPoints} points. Requested: ${points}`
        );
      }

      const updated = await customerRepo.update(id, {
        loyaltyPoints: customer.loyaltyPoints - points,
        updatedAt: new Date()
      });

      await loyaltyRepo.create({
        customerId: id,
        saleId: saleId || null,
        pointsEarned: 0,
        pointsRedeemed: points,
        transactionType: "redeem",
        createdAt: new Date()
      });

      return updated;
    });
  }

  public async adjustStoreCredit(
    id: number,
    amount: number, // Positive to add credit, negative to consume
    reason: string,
    referenceType?: "sale" | "return" | "manual",
    referenceId?: number,
    userId?: number
  ): Promise<any> {
    this.logger.info(`Adjusting store credit by ${amount} for customer ID ${id}`);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const customerRepo = txUow.getRepository<any>("customers", tx);
      const ledgerRepo = txUow.getRepository<any>("storeCreditTransactions", tx);
      const customer = await customerRepo.findById(id);

      if (!customer) {
        throw new NotFoundException("customers", id);
      }

      const currentCredit = Number(customer.storeCredit || 0);
      const newCredit = currentCredit + amount;

      if (newCredit < 0) {
        throw new BusinessRuleException(
          "InsufficientStoreCredit",
          `Requested debit of ${Math.abs(amount)} exceeds available store credit: ${currentCredit}`
        );
      }

      const updated = await customerRepo.update(id, {
        storeCredit: String(newCredit.toFixed(2)),
        updatedAt: new Date()
      });

      const ledger = await ledgerRepo.create({
        customerId: id,
        type: amount > 0 ? "issuance" : "redemption",
        amount: String(amount.toFixed(2)),
        balanceAfter: String(newCredit.toFixed(2)),
        referenceType: referenceType || "manual",
        referenceId: referenceId || null,
        createdByUserId: userId || null,
        notes: reason,
        createdAt: new Date()
      });

      // ==========================================
      // AUTOMATIC POSTING: Double-Entry Accounting
      // ==========================================
      // Only post to GL if manual (POS and Returns flows trigger their own postings to avoid double-posting)
      if (!referenceType || referenceType === "manual") {
        try {
          const accountingService = new AccountingService(txUow, this.logger);
          const totalValue = Math.abs(amount);
          
          if (totalValue > 0) {
            const lines = [];
            if (amount > 0) {
              // We're creating a store credit liability for the customer
              // Debit: Customer Support/Loyalty Expense
              // Credit: Store Credit Liability
              lines.push({
                accountCode: "5030",
                accountName: "Customer Loyalty/Awards Expense",
                accountType: "expenses" as const,
                debit: Number(totalValue.toFixed(2)),
                credit: 0
              });
              lines.push({
                accountCode: "2100",
                accountName: "Store Credit Liability",
                accountType: "liabilities" as const,
                debit: 0,
                credit: Number(totalValue.toFixed(2))
              });
            } else {
              // We're manually reducing/cancelling store credit liability
              // Debit: Store Credit Liability
              // Credit: Customer Loyalty/Awards Expense (offset)
              lines.push({
                accountCode: "2100",
                accountName: "Store Credit Liability",
                accountType: "liabilities" as const,
                debit: Number(totalValue.toFixed(2)),
                credit: 0
              });
              lines.push({
                accountCode: "5030",
                accountName: "Customer Loyalty/Awards Expense",
                accountType: "expenses" as const,
                debit: 0,
                credit: Number(totalValue.toFixed(2))
              });
            }

            await accountingService.postJournalEntry({
              companyId: 1, // Default company
              referenceType: "store_credit",
              referenceId: ledger.id,
              description: `Automatic posting for manual Store Credit update: ${reason}`,
              lines
            }, txUow, tx);
          }
        } catch (err: any) {
          this.logger.error(`Failed automatic journal posting for Store Credit update: ${err.message}`);
          throw err;
        }
      }

      return updated;
    });
  }

  // ==========================================
  // Gift Cards Operations
  // ==========================================
  public async lookupGiftCard(cardNumber: string): Promise<any> {
    this.logger.info(`Looking up gift card code: ${cardNumber}`);
    const gcRepo = this.uow.getRepository<any>("giftCards") as any;
    
    // Fallback to generic find since custom is registered on specialized
    const all = await gcRepo.findAll();
    const card = all.find((g: any) => g.cardNumber.toLowerCase() === cardNumber.toLowerCase().trim());
    if (!card) {
      throw new NotFoundException("giftCards", 0); // Trigger standard not found
    }
    return card;
  }
}
