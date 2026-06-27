// src/backend/api/controllers/fixed-asset.controller.ts

import { Request, Response, NextFunction } from "express";
import { FixedAssetService } from "../../application/services/fixed-asset.service.ts";
import { ApiResponse } from "../../application/dtos/dtos.ts";

export class FixedAssetController {
  constructor(private readonly service: FixedAssetService) {}

  public createCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.createCategory(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Asset category registered successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  public getCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = Number(req.query.companyId || req.body.companyId || 1);
      const data = await this.service.getCategories(companyId);
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

  public acquireAsset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.acquireAsset(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Fixed asset acquired and posted to General Ledger successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  public runMonthlyDepreciation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { companyId, storeId, date } = req.body;
      const parsedDate = date ? new Date(date) : undefined;
      const data = await this.service.runMonthlyDepreciation(Number(companyId || 1), storeId ? Number(storeId) : undefined, parsedDate);
      const response: ApiResponse = {
        success: true,
        message: `Depreciation schedule run executed. Processed ${data.length} assets.`,
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public disposeAsset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.disposeAsset(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Asset disposed and historical cost cleared from ledger successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public transferAsset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.transferAsset(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Asset transferred and movement logged successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public impairAsset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.impairAsset(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Asset impairment loss posted to ledger successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public revalueAsset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.revalueAsset(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Asset revaluation completed and revaluation reserve adjusted.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  // =========================================================================
  // REPORTS
  // =========================================================================

  public getAssetRegister = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = Number(req.params.companyId || req.query.companyId || 1);
      const filters = {
        storeId: req.query.storeId ? Number(req.query.storeId) : undefined,
        status: req.query.status as string,
        categoryCode: req.query.categoryCode as string,
      };
      const data = await this.service.getAssetRegister(companyId, filters);
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

  public getDepreciationSchedule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = Number(req.params.companyId || req.query.companyId || 1);
      const assetId = req.query.assetId ? Number(req.query.assetId) : undefined;
      const data = await this.service.getDepreciationSchedule(companyId, assetId);
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

  public getAssetMovementReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = Number(req.params.companyId || req.query.companyId || 1);
      const data = await this.service.getAssetMovementReport(companyId);
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

  public getAssetDisposalReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = Number(req.params.companyId || req.query.companyId || 1);
      const data = await this.service.getAssetDisposalReport(companyId);
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

  public getAssetAuditTrail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = Number(req.params.companyId || req.query.companyId || 1);
      const assetId = req.query.assetId ? Number(req.query.assetId) : undefined;
      const data = await this.service.getAssetAuditTrail(companyId, assetId);
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
