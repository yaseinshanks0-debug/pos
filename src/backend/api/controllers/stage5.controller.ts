// src/backend/api/controllers/stage5.controller.ts

import { Request, Response, NextFunction } from "express";
import { Stage5Service } from "../../application/services/stage5.service.ts";
import { ApiResponse } from "../../application/dtos/dtos.ts";

export class Stage5Controller {
  constructor(private readonly service: Stage5Service) {}

  // ==========================================
  // BANK ACCOUNTS
  // ==========================================

  public createBankAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.createBankAccount(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Bank account created successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  public getBankAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const data = await this.service.getBankAccount(id);
      const response: ApiResponse = {
        success: true,
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public listBankAccounts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) {
        res.status(400).json({ success: false, message: "companyId query param is required." });
        return;
      }
      const data = await this.service.listBankAccounts(companyId);
      const response: ApiResponse = {
        success: true,
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  // ==========================================
  // VENDOR INVOICES & PAYMENTS (AP)
  // ==========================================

  public createVendorInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.createVendorInvoice(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Vendor invoice added (draft state).",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  public postVendorInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const data = await this.service.postVendorInvoice(id);
      const response: ApiResponse = {
        success: true,
        message: "Vendor invoice posted to General Ledger.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public payVendorInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.payVendorInvoice(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Vendor payment applied successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  public reverseVendorPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const { reason } = req.body;
      const data = await this.service.reverseVendorPayment(id, reason || "Payment cancellation");
      const response: ApiResponse = {
        success: true,
        message: "Vendor payment reversed successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public getVendorAging = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = Number(req.params.companyId);
      const data = await this.service.getVendorAging(companyId);
      const response: ApiResponse = {
        success: true,
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  // ==========================================
  // CUSTOMER INVOICES & RECEIPTS (AR)
  // ==========================================

  public createCustomerInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.createCustomerInvoice(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Customer invoice added (draft state).",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  public postCustomerInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const data = await this.service.postCustomerInvoice(id);
      const response: ApiResponse = {
        success: true,
        message: "Customer invoice posted to General Ledger.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public receiveCustomerPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.receiveCustomerPayment(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Customer receipt registered successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  public reverseCustomerReceipt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const { reason } = req.body;
      const data = await this.service.reverseCustomerReceipt(id, reason || "Receipt cancellation");
      const response: ApiResponse = {
        success: true,
        message: "Customer receipt reversed successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public getCustomerAging = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = Number(req.params.companyId);
      const data = await this.service.getCustomerAging(companyId);
      const response: ApiResponse = {
        success: true,
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  // ==========================================
  // CREDIT NOTES
  // ==========================================

  public createCreditNote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.createCreditNote(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Credit note added (draft state).",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  public postCreditNote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const data = await this.service.postCreditNote(id);
      const response: ApiResponse = {
        success: true,
        message: "Credit note posted to General Ledger.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public applyCreditNote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const { invoiceId } = req.body;
      const data = await this.service.applyCreditNote(id, Number(invoiceId));
      const response: ApiResponse = {
        success: true,
        message: "Credit note applied to invoice successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  // ==========================================
  // BANK STATEMENT IMPORT & RECONCILIATION
  // ==========================================

  public importBankTransactions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.importBankTransactions(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Bank statement transactions imported.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  public matchBankTransaction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.matchBankTransaction(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Bank statement transaction matched successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public postReconciliationAdjustment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.postReconciliationAdjustment(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Reconciliation adjustment posted.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public reconcileBankAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.reconcileBankAccount(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Bank account reconciled and statement closed successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };
}
