import { Request, Response, NextFunction } from "express";
import { AccountingService } from "../../application/services/accounting.service.ts";

export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  public postJournalEntry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.accountingService.postJournalEntry(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  public getTrialBalance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = {
        storeId: req.query.storeId ? Number(req.query.storeId) : undefined,
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
      };
      const result = await this.accountingService.getTrialBalance(filters);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  public getGeneralLedger = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = {
        storeId: req.query.storeId ? Number(req.query.storeId) : undefined,
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
      };
      const result = await this.accountingService.getGeneralLedger(filters);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  public getBalanceSheet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = {
        storeId: req.query.storeId ? Number(req.query.storeId) : undefined,
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
      };
      const result = await this.accountingService.getBalanceSheet(filters);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  public getProfitAndLoss = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = {
        storeId: req.query.storeId ? Number(req.query.storeId) : undefined,
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
      };
      const result = await this.accountingService.getProfitLoss(filters);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  public getCashFlowStatement = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = {
        storeId: req.query.storeId ? Number(req.query.storeId) : undefined,
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
      };
      const result = await this.accountingService.getCashFlowStatement(filters);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  public getChartOfAccounts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.accountingService.getChartOfAccounts();
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  public createFiscalYear = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { year, startDate, endDate, calendarType } = req.body;
      const result = await this.accountingService.createFiscalYear(
        Number(year),
        new Date(startDate),
        new Date(endDate),
        calendarType
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  public getFiscalYears = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.accountingService.getFiscalYears();
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  public getAccountingPeriods = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const fiscalYearId = req.query.fiscalYearId ? Number(req.query.fiscalYearId) : undefined;
      const result = await this.accountingService.getAccountingPeriods(fiscalYearId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  public updatePeriodStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const periodId = Number(req.params.id);
      const { status, userId, reason } = req.body;
      const result = await this.accountingService.updatePeriodStatus(
        periodId,
        status,
        Number(userId),
        reason
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  public closeAccountingPeriod = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const periodId = Number(req.params.id);
      const { userId, notes } = req.body;
      const result = await this.accountingService.closeAccountingPeriod(
        periodId,
        Number(userId),
        notes
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  public closeFiscalYear = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const fiscalYearId = Number(req.params.id);
      const { userId, notes } = req.body;
      const result = await this.accountingService.closeFiscalYear(
        fiscalYearId,
        Number(userId),
        notes
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  public getPeriodLockAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const periodId = req.query.periodId ? Number(req.query.periodId) : undefined;
      const result = await this.accountingService.getPeriodLockAuditLogs(periodId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  public getFiscalCloseRuns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.accountingService.getFiscalCloseRuns();
      res.json(result);
    } catch (err) {
      next(err);
    }
  };
}
