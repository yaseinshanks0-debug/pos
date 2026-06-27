// src/backend/api/controllers/stage5_2.controller.ts

import { Request, Response, NextFunction } from "express";
import { Stage5_2Service } from "../../application/services/stage5_2.service.ts";
import { ApiResponse } from "../../application/dtos/dtos.ts";

export class Stage5_2Controller {
  constructor(private readonly service: Stage5_2Service) {}

  // =========================================================================
  // 1. MULTI-CURRENCY
  // =========================================================================

  public createCurrency = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.createCurrency(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Currency registered successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  public setExchangeRate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.setExchangeRate(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Exchange rate defined successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  public postUnrealizedRevaluation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.postUnrealizedRevaluation(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Period-end foreign currency revaluation executed and posted.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  // =========================================================================
  // 2. CASH MANAGEMENT
  // =========================================================================

  public transferCash = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.transferCash(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Cash transfer completed successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  public pettyCashTransaction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.pettyCashTransaction(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Cash transaction logged successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  public getCashPosition = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = Number(req.params.companyId);
      const data = await this.service.getCashPosition(companyId);
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

  // =========================================================================
  // 3. BUDGETING ENGINE
  // =========================================================================

  public createBudget = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.createBudget(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Annual budget registered successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  public reviseBudget = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const budgetId = Number(req.params.id);
      const { revisedAmount, reason, revisedByUserId } = req.body;
      const data = await this.service.reviseBudget({
        budgetId,
        revisedAmount,
        reason,
        revisedByUserId
      });
      const response: ApiResponse = {
        success: true,
        message: "Budget revised successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public getBudgetVsActual = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = Number(req.query.companyId);
      const fiscalYearId = Number(req.query.fiscalYearId);
      const departmentId = req.query.departmentId ? Number(req.query.departmentId) : undefined;
      const storeId = req.query.storeId ? Number(req.query.storeId) : undefined;

      if (!companyId || !fiscalYearId) {
        res.status(400).json({ success: false, message: "companyId and fiscalYearId are required query parameters." });
        return;
      }

      const data = await this.service.getBudgetVsActual(companyId, fiscalYearId, departmentId, storeId);
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

  // =========================================================================
  // 4. FINANCIAL REPORTING
  // =========================================================================

  public getBalanceSheet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = Number(req.params.companyId);
      const date = req.query.date ? new Date(req.query.date as string) : new Date();
      const data = await this.service.getBalanceSheet(companyId, date);
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

  public getIncomeStatement = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = Number(req.params.companyId);
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      const data = await this.service.getIncomeStatement(companyId, startDate, endDate);
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

  public getCashFlowStatement = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = Number(req.params.companyId);
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      const data = await this.service.getCashFlowStatement(companyId, startDate, endDate);
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

  public getGeneralLedgerReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = Number(req.params.companyId);
      const accountCode = req.query.accountCode ? (req.query.accountCode as string) : undefined;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      
      const data = await this.service.getGeneralLedgerReport(companyId, { accountCode, startDate, endDate });
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

  public getApAgingReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = Number(req.params.companyId);
      const date = req.query.date ? new Date(req.query.date as string) : new Date();
      const data = await this.service.getApAgingReport(companyId, date);
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

  public getArAgingReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = Number(req.params.companyId);
      const date = req.query.date ? new Date(req.query.date as string) : new Date();
      const data = await this.service.getArAgingReport(companyId, date);
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
}
