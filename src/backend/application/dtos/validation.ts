// src/backend/application/dtos/validation.ts

import { ValidationError } from "../../domain/exceptions.ts";
import { 
  CreateTransferOrderDto, 
  UpdateTransferOrderDto, 
  CreateSalesReturnDto,
  CreateSaleDto,
  OpenShiftDto,
  CloseShiftDto,
  CreateCustomerDto,
  SyncPayloadDto,
  ResolveConflictDto,
  ReportFilterDto,
  CreateJournalEntryDto
} from "./dtos.ts";

export class Validator {
  public static validateCreateTransferOrder(dto: CreateTransferOrderDto): void {
    const errors: Record<string, string[]> = {};

    if (!dto.transferNumber || dto.transferNumber.trim() === "") {
      errors.transferNumber = ["Transfer number is required."];
    }

    if (!dto.sourceStoreId) {
      errors.sourceStoreId = ["Source store ID is required."];
    }

    if (!dto.sourceWarehouseId) {
      errors.sourceWarehouseId = ["Source warehouse ID is required."];
    }

    if (!dto.destinationStoreId) {
      errors.destinationStoreId = ["Destination store ID is required."];
    }

    if (!dto.destinationWarehouseId) {
      errors.destinationWarehouseId = ["Destination warehouse ID is required."];
    }

    if (dto.sourceStoreId && dto.destinationStoreId && dto.sourceStoreId === dto.destinationStoreId) {
      errors.destinationStoreId = errors.destinationStoreId || [];
      errors.destinationStoreId.push("Source and destination store must be different.");
    }

    if (dto.sourceWarehouseId && dto.destinationWarehouseId && dto.sourceWarehouseId === dto.destinationWarehouseId) {
      errors.destinationWarehouseId = errors.destinationWarehouseId || [];
      errors.destinationWarehouseId.push("Source and destination warehouse must be different.");
    }

    if (!dto.items || dto.items.length === 0) {
      errors.items = ["At least one transfer item must be provided."];
    } else {
      dto.items.forEach((item, index) => {
        if (!item.productId) {
          errors[`items[${index}].productId`] = ["Product ID is required."];
        }
        if (!item.quantityRequest || item.quantityRequest <= 0) {
          errors[`items[${index}].quantityRequest`] = ["Quantity request must be greater than zero."];
        }
      });
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError(errors);
    }
  }

  public static validateUpdateTransferOrder(dto: UpdateTransferOrderDto): void {
    const errors: Record<string, string[]> = {};

    if (dto.status) {
      const validStatuses = ["draft", "approved", "in_transit", "partially_received", "received", "cancelled"];
      if (!validStatuses.includes(dto.status)) {
        errors.status = [`Status must be one of: ${validStatuses.join(", ")}.`];
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError(errors);
    }
  }

  public static validateCreateSalesReturn(dto: CreateSalesReturnDto): void {
    const errors: Record<string, string[]> = {};

    if (!dto.returnNumber || dto.returnNumber.trim() === "") {
      errors.returnNumber = ["Return number is required."];
    }

    if (!dto.storeId) {
      errors.storeId = ["Store ID is required."];
    }

    if (!dto.cashierId) {
      errors.cashierId = ["Cashier ID is required."];
    }

    if (!dto.refundMethod) {
      errors.refundMethod = ["Refund method is required."];
    }

    if (!dto.items || dto.items.length === 0) {
      errors.items = ["At least one return item is required."];
    } else {
      dto.items.forEach((item, index) => {
        if (!item.productId) {
          errors[`items[${index}].productId`] = ["Product ID is required."];
        }
        if (!item.qty || item.qty <= 0) {
          errors[`items[${index}].qty`] = ["Quantity must be greater than zero."];
        }
        if (item.unitPrice < 0) {
          errors[`items[${index}].unitPrice`] = ["Unit price cannot be negative."];
        }
        if (item.refundAmount < 0) {
          errors[`items[${index}].refundAmount`] = ["Refund amount cannot be negative."];
        }
      });
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError(errors);
    }
  }

  public static validateCreateProduct(dto: any): void {
    const errors: Record<string, string[]> = {};
    if (!dto.companyId) errors.companyId = ["Company ID is required."];
    if (!dto.sku || dto.sku.trim() === "") errors.sku = ["SKU is required."];
    if (!dto.barcode || dto.barcode.trim() === "") errors.barcode = ["Barcode is required."];
    if (!dto.name || dto.name.trim() === "") errors.name = ["Product name is required."];
    if (dto.costPrice === undefined || Number(dto.costPrice) < 0) errors.costPrice = ["Cost price must be zero or positive."];
    if (dto.retailPrice === undefined || Number(dto.retailPrice) < 0) errors.retailPrice = ["Retail price must be zero or positive."];
    if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  }

  public static validateInventoryAdjustment(dto: any): void {
    const errors: Record<string, string[]> = {};
    if (!dto.warehouseId) errors.warehouseId = ["Warehouse ID is required."];
    if (!dto.productId) errors.productId = ["Product ID is required."];
    if (dto.quantityDelta === undefined || Number(dto.quantityDelta) === 0) {
      errors.quantityDelta = ["Quantity delta is required and must not be zero."];
    }
    if (!dto.reasonCode || dto.reasonCode.trim() === "") {
      errors.reasonCode = ["Reason code is required."];
    }
    if (!dto.userId) errors.userId = ["User ID in charge is required."];
    if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  }

  public static validateCreateCountSession(dto: any): void {
    const errors: Record<string, string[]> = {};
    if (!dto.companyId) errors.companyId = ["Company ID is required."];
    if (!dto.storeId) errors.storeId = ["Store ID is required."];
    if (!dto.warehouseId) errors.warehouseId = ["Warehouse ID is required."];
    if (!dto.type || !["cycle", "full"].includes(dto.type)) {
      errors.type = ["Session type must be 'cycle' or 'full'."];
    }
    if (!dto.createdByUserId) errors.createdByUserId = ["Created by user ID is required."];
    if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  }

  public static validateSubmitCountSession(dto: any): void {
    const errors: Record<string, string[]> = {};
    if (!dto.id) errors.id = ["Count session ID is required."];
    if (!dto.items || dto.items.length === 0) {
      errors.items = ["Count items are required."];
    } else {
      dto.items.forEach((item: any, index: number) => {
        if (!item.productId) {
          errors[`items[${index}].productId`] = ["Product ID is required."];
        }
        if (item.countedQuantity === undefined || item.countedQuantity < 0) {
          errors[`items[${index}].countedQuantity`] = ["Counted quantity must be zero or positive."];
        }
      });
    }
    if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  }

  public static validateCreateInventoryAdjustment(dto: any): void {
    const errors: Record<string, string[]> = {};
    if (!dto.companyId) errors.companyId = ["Company ID is required."];
    if (!dto.storeId) errors.storeId = ["Store ID is required."];
    if (!dto.warehouseId) errors.warehouseId = ["Warehouse ID is required."];
    if (!dto.type || !["shrinkage", "damage", "expiration", "theft", "manual"].includes(dto.type)) {
      errors.type = ["Adjustment type must be one of: shrinkage, damage, expiration, theft, manual."];
    }
    if (!dto.createdByUserId) errors.createdByUserId = ["Created by user ID is required."];
    if (!dto.items || dto.items.length === 0) {
      errors.items = ["At least one adjustment item is required."];
    } else {
      dto.items.forEach((item: any, index: number) => {
        if (!item.productId) {
          errors[`items[${index}].productId`] = ["Product ID is required."];
        }
        if (item.quantityAdjusted === undefined || item.quantityAdjusted === 0) {
          errors[`items[${index}].quantityAdjusted`] = ["Quantity adjusted is required and cannot be zero."];
        }
        if (!item.reasonCode || item.reasonCode.trim() === "") {
          errors[`items[${index}].reasonCode`] = ["Reason code is required."];
        }
      });
    }
    if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  }

  public static validateCreateVendor(dto: any): void {
    const errors: Record<string, string[]> = {};
    if (!dto.companyId) errors.companyId = ["Company ID is required."];
    if (!dto.name || dto.name.trim() === "") errors.name = ["Vendor name is required."];
    if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  }

  public static validateCreatePurchaseOrder(dto: any): void {
    const errors: Record<string, string[]> = {};
    if (!dto.companyId) errors.companyId = ["Company ID is required."];
    if (!dto.poNumber || dto.poNumber.trim() === "") errors.poNumber = ["PO number is required."];
    if (!dto.vendorId) errors.vendorId = ["Vendor ID is required."];
    if (!dto.storeId) errors.storeId = ["Store ID is required."];
    
    if (!dto.items || dto.items.length === 0) {
      errors.items = ["At least one item is required in the purchase order."];
    } else {
      dto.items.forEach((item: any, i: number) => {
        if (!item.productId) errors[`items[${i}].productId`] = ["Product ID is required."];
        if (item.orderedQty === undefined || Number(item.orderedQty) <= 0) {
          errors[`items[${i}].orderedQty`] = ["Ordered quantity must be greater than zero."];
        }
        if (item.unitCost === undefined || Number(item.unitCost) < 0) {
          errors[`items[${i}].unitCost`] = ["Unit cost must be zero or positive."];
        }
      });
    }
    if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  }

  public static validateReceivePurchaseOrder(dto: any): void {
    const errors: Record<string, string[]> = {};
    if (!dto.warehouseId) errors.warehouseId = ["Warehouse ID is required for received inventory."];
    if (!dto.receivedByUserId) errors.receivedByUserId = ["Received by user ID is required."];
    if (!dto.items || dto.items.length === 0) {
      errors.items = ["No items provided for receiving check."];
    } else {
      dto.items.forEach((item: any, i: number) => {
        if (!item.productId) errors[`items[${i}].productId`] = ["Product ID is required."];
        if (item.receivedQty === undefined || Number(item.receivedQty) < 0) {
          errors[`items[${i}].receivedQty`] = ["Received quantity cannot be negative."];
        }
      });
    }
    if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  }

  public static validateCreateSale(dto: CreateSaleDto): void {
    const errors: Record<string, string[]> = {};
    if (!dto.storeId) errors.storeId = ["Store ID is required."];
    if (!dto.cashierId) errors.cashierId = ["Cashier ID is required."];

    // Handle robust fallbacks for missing subtotal/totalAmount
    if (dto.subtotal === undefined && dto.totalAmount !== undefined) {
      dto.subtotal = dto.totalAmount;
    }
    if (dto.totalAmount === undefined && dto.subtotal !== undefined) {
      dto.totalAmount = dto.subtotal;
    }

    if (dto.subtotal === undefined || Number(dto.subtotal) < 0) errors.subtotal = ["Subtotal must be zero or positive."];
    if (dto.totalAmount === undefined || Number(dto.totalAmount) < 0) errors.totalAmount = ["Total amount must be zero or positive."];

    if (!dto.items || dto.items.length === 0) {
      errors.items = ["At least one item must be added to the cart."];
    } else {
      dto.items.forEach((item: any, i: number) => {
        if (!item.productId) errors[`items[${i}].productId`] = ["Product ID is required."];
        if (item.qty === undefined || Number(item.qty) <= 0) errors[`items[${i}].qty`] = ["Quantity must be greater than zero."];
        
        // Robust fallback for item unitPrice
        if (item.unitPrice === undefined) {
          item.unitPrice = 0; // default to zero, service layer will override it anyway
        }
        if (item.unitPrice === undefined || Number(item.unitPrice) < 0) errors[`items[${i}].unitPrice`] = ["Unit price must be zero or positive."];
      });
    }

    // Robust fallback for payments array using single payment fields if present
    const anyDto = dto as any;
    if ((!dto.payments || dto.payments.length === 0) && anyDto.paymentMethod && dto.totalAmount !== undefined) {
      dto.payments = [{
        paymentMethod: anyDto.paymentMethod,
        amount: dto.totalAmount
      }];
    }

    if (!dto.payments || dto.payments.length === 0) {
      errors.payments = ["At least one payment must be provided for the transaction."];
    } else {
      let totalPaid = 0;
      dto.payments.forEach((p: any, i: number) => {
        // Robust fallback: if there is only 1 payment and its amount is <= 0 but dto has a positive totalAmount, auto-correct it
        if (dto.payments.length === 1 && (p.amount === undefined || Number(p.amount) <= 0) && dto.totalAmount !== undefined && Number(dto.totalAmount) > 0) {
          p.amount = dto.totalAmount;
        }
        if (!p.paymentMethod) errors[`payments[${i}].paymentMethod`] = ["Payment method is required."];
        if (p.amount === undefined || Number(p.amount) <= 0) errors[`payments[${i}].amount`] = ["Payment amount must be greater than zero."];
        totalPaid += Number(p.amount || 0);
      });
    }

    if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  }

  public static validateOpenShift(dto: OpenShiftDto): void {
    const errors: Record<string, string[]> = {};
    if (!dto.cashDrawerId) errors.cashDrawerId = ["Cash drawer ID is required."];
    if (!dto.userId) errors.userId = ["User ID is required."];
    if (dto.openingCash === undefined || Number(dto.openingCash) < 0) errors.openingCash = ["Opening cash must be zero or positive."];
    if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  }

  public static validateCloseShift(dto: CloseShiftDto): void {
    const errors: Record<string, string[]> = {};
    if (dto.actualCash === undefined || Number(dto.actualCash) < 0) errors.actualCash = ["Actual cash counted must be zero or positive."];
    if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  }

  public static validateCreateCustomer(dto: CreateCustomerDto): void {
    const errors: Record<string, string[]> = {};
    if (!dto.name || dto.name.trim() === "") errors.name = ["Customer name is required."];
    if (!dto.mobileNumber || dto.mobileNumber.trim() === "") errors.mobileNumber = ["Mobile number is required."];
    if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  }

  public static validateSyncPayload(dto: SyncPayloadDto): void {
    const errors: Record<string, string[]> = {};
    if (!dto.storeId) errors.storeId = ["Store ID is required."];
    if (!dto.operations || !Array.isArray(dto.operations)) {
      errors.operations = ["operations list must be a valid array."];
    } else {
      dto.operations.forEach((op, index) => {
        if (!op.entityType) errors[`operations[${index}].entityType`] = ["Entity type is required."];
        if (!op.entityId) errors[`operations[${index}].entityId`] = ["Entity ID is required."];
        if (!op.actionType) errors[`operations[${index}].actionType`] = ["Action type is required."];
        if (!op.payload) errors[`operations[${index}].payload`] = ["Payload body is required."];
      });
    }
    if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  }

  public static validateResolveConflict(dto: ResolveConflictDto): void {
    const errors: Record<string, string[]> = {};
    if (!dto.resolutionStrategy) errors.resolutionStrategy = ["Resolution strategy is required."];
    if (!dto.resolvedByUserId) errors.resolvedByUserId = ["Resolved status creator user ID is required."];
    if (dto.resolutionStrategy === "manual" && !dto.manualData) {
      errors.manualData = ["Manual resolved data body must be specified for manual strategies."];
    }
    if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  }

  public static validateReportFilter(dto: ReportFilterDto): void {
    const errors: Record<string, string[]> = {};
    if (dto.startDate && isNaN(Date.parse(dto.startDate))) {
      errors.startDate = ["Start date format is invalid."];
    }
    if (dto.endDate && isNaN(Date.parse(dto.endDate))) {
      errors.endDate = ["End date format is invalid."];
    }
    if (dto.startDate && dto.endDate && new Date(dto.startDate) > new Date(dto.endDate)) {
      errors.dateRange = ["Start date must be set prior to end date."];
    }
    if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  }

  public static validateCreateJournalEntry(dto: CreateJournalEntryDto): void {
    const errors: Record<string, string[]> = {};
    if (!dto.companyId) errors.companyId = ["Company ID is required."];
    if (!dto.description || dto.description.trim() === "") errors.description = ["Description is required."];

    // AP/AR control accounts lock for manual entries
    const isManual = !dto.referenceType || dto.referenceType === "manual" || dto.referenceType === "general" || dto.referenceType === "manual_adjustment";
    if (isManual && dto.lines && Array.isArray(dto.lines)) {
      const hasControlAccount = dto.lines.some(l => l.accountCode === "2010" || l.accountCode === "1200");
      if (hasControlAccount) {
        errors.controlLock = ["Direct manual postings to Accounts Payable Control (2010) or Accounts Receivable Control (1200) are strictly forbidden. All movements must originate from official business documents."];
      }
    }
    if (!dto.lines || !Array.isArray(dto.lines) || dto.lines.length < 2) {
      errors.lines = ["At least two balanced entries (journal lines) are required."];
    } else {
      let sumDebits = 0;
      let sumCredits = 0;
      dto.lines.forEach((l, idx) => {
        if (!l.accountCode || l.accountCode.trim() === "") {
          errors[`lines[${idx}].accountCode`] = ["Account Code is required."];
        }
        if (!l.accountName || l.accountName.trim() === "") {
          errors[`lines[${idx}].accountName`] = ["Account Name is required."];
        }
        if (!l.accountType) {
          errors[`lines[${idx}].accountType`] = ["Account Type is required."];
        }
        const deb = Number(l.debit || 0);
        const cred = Number(l.credit || 0);
        if (deb < 0) errors[`lines[${idx}].debit`] = ["Debit must be non-negative."];
        if (cred < 0) errors[`lines[${idx}].credit`] = ["Credit must be non-negative."];
        if (deb > 0 && cred > 0) {
          errors[`lines[${idx}].values`] = ["A single ledger line cannot contain both debit and credit values."];
        }
        if (deb === 0 && cred === 0) {
          errors[`lines[${idx}].values`] = ["Either debit or credit amount must be greater than zero."];
        }
        sumDebits += deb;
        sumCredits += cred;
      });

      if (Math.abs(sumDebits - sumCredits) > 0.01) {
        errors.balance = [`Double entry validation failed. Debits sum (${sumDebits.toFixed(2)}) must equal Credits sum (${sumCredits.toFixed(2)}).`];
      }
    }
    if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  }

  public static validateCreateBankAccount(dto: any): void {
    const errors: Record<string, string[]> = {};
    if (!dto.companyId) errors.companyId = ["Company ID is required."];
    if (!dto.name || dto.name.trim() === "") errors.name = ["Name is required."];
    if (!dto.accountNumber || dto.accountNumber.trim() === "") errors.accountNumber = ["Account number is required."];
    if (!dto.ledgerAccountCode || dto.ledgerAccountCode.trim() === "") errors.ledgerAccountCode = ["Ledger account code is required."];
    if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  }

  public static validateCreateVendorInvoice(dto: any): void {
    const errors: Record<string, string[]> = {};
    if (!dto.companyId) errors.companyId = ["Company ID is required."];
    if (!dto.vendorId) errors.vendorId = ["Vendor ID is required."];
    if (!dto.invoiceNumber || dto.invoiceNumber.trim() === "") errors.invoiceNumber = ["Invoice number is required."];
    if (!dto.invoiceDate) errors.invoiceDate = ["Invoice date is required."];
    if (!dto.dueDate) errors.dueDate = ["Due date is required."];
    if (!dto.items || !Array.isArray(dto.items) || dto.items.length === 0) {
      errors.items = ["At least one invoice item must be provided."];
    } else {
      dto.items.forEach((item: any, idx: number) => {
        if (!item.accountCode || item.accountCode.trim() === "") {
          errors[`items[${idx}].accountCode`] = ["Account code is required."];
        }
        if (Number(item.quantity || 0) <= 0) {
          errors[`items[${idx}].quantity`] = ["Quantity must be greater than zero."];
        }
        if (Number(item.unitPrice || 0) < 0) {
          errors[`items[${idx}].unitPrice`] = ["Unit price cannot be negative."];
        }
      });
    }
    if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  }

  public static validateCreateVendorPayment(dto: any): void {
    const errors: Record<string, string[]> = {};
    if (!dto.companyId) errors.companyId = ["Company ID is required."];
    if (!dto.vendorId) errors.vendorId = ["Vendor ID is required."];
    if (!dto.bankAccountId) errors.bankAccountId = ["Bank account ID is required."];
    if (!dto.paymentDate) errors.paymentDate = ["Payment date is required."];
    if (!dto.paymentMethod) errors.paymentMethod = ["Payment method is required."];
    if (Number(dto.amount || 0) <= 0) errors.amount = ["Amount must be greater than zero."];
    if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  }

  public static validateCreateCustomerInvoice(dto: any): void {
    const errors: Record<string, string[]> = {};
    if (!dto.companyId) errors.companyId = ["Company ID is required."];
    if (!dto.customerId) errors.customerId = ["Customer ID is required."];
    if (!dto.invoiceNumber || dto.invoiceNumber.trim() === "") errors.invoiceNumber = ["Invoice number is required."];
    if (!dto.invoiceDate) errors.invoiceDate = ["Invoice date is required."];
    if (!dto.dueDate) errors.dueDate = ["Due date is required."];
    if (!dto.items || !Array.isArray(dto.items) || dto.items.length === 0) {
      errors.items = ["At least one invoice item must be provided."];
    } else {
      dto.items.forEach((item: any, idx: number) => {
        if (!item.accountCode || item.accountCode.trim() === "") {
          errors[`items[${idx}].accountCode`] = ["Account code is required."];
        }
        if (Number(item.quantity || 0) <= 0) {
          errors[`items[${idx}].quantity`] = ["Quantity must be greater than zero."];
        }
        if (Number(item.unitPrice || 0) < 0) {
          errors[`items[${idx}].unitPrice`] = ["Unit price cannot be negative."];
        }
      });
    }
    if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  }

  public static validateCreateCustomerReceipt(dto: any): void {
    const errors: Record<string, string[]> = {};
    if (!dto.companyId) errors.companyId = ["Company ID is required."];
    if (!dto.customerId) errors.customerId = ["Customer ID is required."];
    if (!dto.bankAccountId) errors.bankAccountId = ["Bank account ID is required."];
    if (!dto.receiptDate) errors.receiptDate = ["Receipt date is required."];
    if (!dto.paymentMethod) errors.paymentMethod = ["Payment method is required."];
    if (Number(dto.amount || 0) <= 0) errors.amount = ["Amount must be greater than zero."];
    if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  }

  public static validateCreateCreditNote(dto: any): void {
    const errors: Record<string, string[]> = {};
    if (!dto.companyId) errors.companyId = ["Company ID is required."];
    if (!dto.type || !["vendor", "customer"].includes(dto.type)) {
      errors.type = ["Type must be 'vendor' or 'customer'."];
    }
    if (!dto.entityId) errors.entityId = ["Entity ID is required."];
    if (!dto.creditNoteNumber || dto.creditNoteNumber.trim() === "") errors.creditNoteNumber = ["Credit note number is required."];
    if (!dto.creditNoteDate) errors.creditNoteDate = ["Credit note date is required."];
    if (Number(dto.amount || 0) <= 0) errors.amount = ["Amount must be greater than zero."];
    if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  }
}
