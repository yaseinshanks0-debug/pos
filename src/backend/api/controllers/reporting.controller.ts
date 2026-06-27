// src/backend/api/controllers/reporting.controller.ts

import { Request, Response, NextFunction } from "express";
import { ReportingService } from "../../application/services/reporting.service.ts";
import { ApiResponse } from "../../application/dtos/dtos.ts";

export class ReportingController {
  constructor(private readonly service: ReportingService) {}

  // Existing standard Sales Overview
  public getSalesReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = {
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
        storeId: req.query.storeId ? Number(req.query.storeId) : undefined,
        cashierId: req.query.cashierId ? Number(req.query.cashierId) : undefined,
        productId: req.query.productId ? Number(req.query.productId) : undefined,
        categoryId: req.query.categoryId ? Number(req.query.categoryId) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };
      
      const salesOverview = await this.service.getSalesAggregatedReport(filter);
      const salesByStore = await this.service.getSalesByStore(filter);
      const salesByCashier = await this.service.getSalesByCashier(filter);
      const salesByProduct = await this.service.getSalesByProduct(filter);
      const salesByCategory = await this.service.getSalesByCategory(filter);

      res.status(200).json({
        success: true,
        data: {
          salesOverview,
          salesByStore,
          salesByCashier,
          salesByProduct,
          salesByCategory
        },
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      next(err);
    }
  };

  // Inventory Valuation & On Hand
  public getInventoryReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getInventoryReport();
      res.status(200).json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (err) {
      next(err);
    }
  };

  public getLowStockReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getLowStockReport();
      res.status(200).json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (err) {
      next(err);
    }
  };

  public getDeadStockReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = {
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
      };
      const data = await this.service.getDeadStockReport(filter);
      res.status(200).json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (err) {
      next(err);
    }
  };

  public getInventoryMovements = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = {
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
      };
      const data = await this.service.getInventoryMovements(filter);
      res.status(200).json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (err) {
      next(err);
    }
  };

  // Financial Profits Report
  public getFinancialReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = {
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
        storeId: req.query.storeId ? Number(req.query.storeId) : undefined,
      };
      const data = await this.service.getFinancialProfitsReport(filter);
      res.status(200).json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (err) {
      next(err);
    }
  };

  public getCustomerReportsSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getCustomerReportsSummary();
      res.status(200).json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (err) {
      next(err);
    }
  };

  public getHQBranchComparisonReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getHQBranchComparisonReport();
      res.status(200).json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (err) {
      next(err);
    }
  };

  // ==========================================
  // STAGE 6 - NEW Analytics API routes
  // ==========================================

  public getDashboardData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = {
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
        storeId: req.query.storeId ? Number(req.query.storeId) : undefined,
      };
      const data = await this.service.getExecutiveKpis(filter);
      res.status(200).json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (err) {
      next(err);
    }
  };

  public getKpiReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = {
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
        storeId: req.query.storeId ? Number(req.query.storeId) : undefined,
      };
      const data = await this.service.getExecutiveKpis(filter);
      res.status(200).json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (err) {
      next(err);
    }
  };

  public getFullFinancialReports = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = {
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
        storeId: req.query.storeId ? Number(req.query.storeId) : undefined,
        accountCode: req.query.accountCode ? String(req.query.accountCode) : undefined,
      };

      const trialBalance = await this.service.getTrialBalanceReport(filter);
      const balanceSheet = await this.service.getBalanceSheetReport(filter);
      const incomeStatement = await this.service.getIncomeStatementReport(filter);
      const cashFlow = await this.service.getCashFlowReport(filter);
      const generalLedger = await this.service.getGeneralLedgerReport(filter);
      const journalReport = await this.service.getJournalReport(filter);
      const budgetVsActual = await this.service.getBudgetVsActualReport(filter);
      const comparative = await this.service.getMultiPeriodComparativeStatements(filter);
      const consolidated = await this.service.getConsolidatedMultiStoreFinancialStatements(filter);

      res.status(200).json({
        success: true,
        data: {
          trialBalance,
          balanceSheet,
          incomeStatement,
          cashFlow,
          generalLedger,
          journalReport,
          budgetVsActual,
          comparative,
          consolidated
        },
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      next(err);
    }
  };

  public getInventoryAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = {
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
        storeId: req.query.storeId ? Number(req.query.storeId) : undefined,
      };
      const data = await this.service.getInventoryAnalytics(filter);
      res.status(200).json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (err) {
      next(err);
    }
  };

  public getSalesAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = {
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
        storeId: req.query.storeId ? Number(req.query.storeId) : undefined,
      };
      const data = await this.service.getSalesAnalytics(filter);
      res.status(200).json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (err) {
      next(err);
    }
  };

  public getArAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = {
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
        storeId: req.query.storeId ? Number(req.query.storeId) : undefined,
      };
      const data = await this.service.getARAnalytics(filter);
      res.status(200).json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (err) {
      next(err);
    }
  };

  public getApAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = {
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
        storeId: req.query.storeId ? Number(req.query.storeId) : undefined,
      };
      const data = await this.service.getAPAnalytics(filter);
      res.status(200).json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (err) {
      next(err);
    }
  };

  public getFixedAssetAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = {
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
        storeId: req.query.storeId ? Number(req.query.storeId) : undefined,
      };
      const data = await this.service.getFixedAssetAnalytics(filter);
      res.status(200).json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (err) {
      next(err);
    }
  };

  // Saved reports endpoints
  public createSavedReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { companyId, name, reportType, filters, createdByUserId } = req.body;
      if (!companyId || !name || !reportType || !filters) {
        res.status(400).json({ success: false, message: "Missing required saved report fields" });
        return;
      }
      const data = await this.service.saveReport({ companyId, name, reportType, filters, createdByUserId });
      res.status(201).json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (err) {
      next(err);
    }
  };

  public listSavedReports = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = req.query.companyId ? Number(req.query.companyId) : 1; // Default fallback to first company
      const data = await this.service.getSavedReports(companyId);
      res.status(200).json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (err) {
      next(err);
    }
  };

  public getSavedReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const data = await this.service.getSavedReportById(id);
      res.status(200).json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (err) {
      next(err);
    }
  };

  public deleteSavedReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      await this.service.deleteSavedReport(id);
      res.status(200).json({ success: true, message: "Saved report deleted successfully", timestamp: new Date().toISOString() });
    } catch (err) {
      next(err);
    }
  };

  // Exporters
  public exportReportToExcel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const reportType = req.query.reportType ? String(req.query.reportType) : "sales";
      const filter = {
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
        storeId: req.query.storeId ? Number(req.query.storeId) : undefined,
      };
      const csvContent = await this.service.exportReportToCSV(reportType, filter);

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=${reportType}_report.csv`);
      res.status(200).send(csvContent);
    } catch (err) {
      next(err);
    }
  };

  public exportReportToPDF = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const reportType = req.query.reportType ? String(req.query.reportType) : "sales";
      const filter = {
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
        storeId: req.query.storeId ? Number(req.query.storeId) : undefined,
      };
      const htmlContent = await this.service.exportReportToDownloadableHTML(reportType, filter);

      res.setHeader("Content-Type", "text/html");
      res.status(200).send(htmlContent);
    } catch (err) {
      next(err);
    }
  };
}
