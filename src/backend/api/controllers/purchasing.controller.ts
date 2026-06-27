// src/backend/api/controllers/purchasing.controller.ts

import { Request, Response, NextFunction } from "express";
import { PurchasingService } from "../../application/services/purchasing.service.ts";
import { ApiResponse } from "../../application/dtos/dtos.ts";

export class PurchasingController {
  constructor(private readonly service: PurchasingService) {}

  // ==========================================
  // Vendor Endpoints
  // ==========================================
  public createVendor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.createVendor(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Supplier profile registered successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  public updateVendor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const data = await this.service.updateVendor(id, req.body);
      const response: ApiResponse = {
        success: true,
        message: "Supplier profile revised.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public getVendor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const data = await this.service.getVendor(id);
      const response: ApiResponse = {
        success: true,
        message: "Supplier information retrieved.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public listVendors = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters: Record<string, any> = {};
      if (req.query.companyId) filters.companyId = Number(req.query.companyId);
      if (req.query.status) filters.status = req.query.status;

      const data = await this.service.listVendors(filters);
      const response: ApiResponse = {
        success: true,
        message: "Enterprise suppliers catalog fully loaded.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public recordVendorCredit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.recordVendorCredit(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Vendor credit threshold adjusted successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  // ==========================================
  // Purchase Order Endpoints
  // ==========================================
  public createPurchaseOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.createPurchaseOrder(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Purchase order created in draft mode.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  public submitPO = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const data = await this.service.submitPO(id);
      const response: ApiResponse = {
        success: true,
        message: "Purchase Purchase order submitted.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public approvePO = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const data = await this.service.approvePO(id);
      const response: ApiResponse = {
        success: true,
        message: "Purchase order finalized & approved.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public markSentPO = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const data = await this.service.markSent(id);
      const response: ApiResponse = {
        success: true,
        message: "Purchase order dispatched to vendor.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public receivePO = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const data = await this.service.receivePurchaseOrder(id, req.body);
      const response: ApiResponse = {
        success: true,
        message: "Stock arrivals fully verified, updated in warehouse inventory.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public getPurchaseOrderDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const data = await this.service.getPurchaseOrderDetails(id);
      const response: ApiResponse = {
        success: true,
        message: "Purchase order line details loaded.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public listPurchaseOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters: Record<string, any> = {};
      if (req.query.companyId) filters.companyId = Number(req.query.companyId);
      if (req.query.vendorId) filters.vendorId = Number(req.query.vendorId);
      if (req.query.status) filters.status = req.query.status;

      const data = await this.service.listPurchaseOrders(filters);
      const response: ApiResponse = {
        success: true,
        message: "Purchase order history retrieved.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };
}
