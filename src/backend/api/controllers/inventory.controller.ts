// src/backend/api/controllers/inventory.controller.ts

import { Request, Response, NextFunction } from "express";
import { InventoryService } from "../../application/services/inventory.service.ts";
import { ApiResponse } from "../../application/dtos/dtos.ts";

export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  // ==========================================
  // Products & Variants
  // ==========================================
  public createProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.createProduct(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Product created successfully in Catalog master registry.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  public updateProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const data = await this.service.updateProduct(id, req.body);
      const response: ApiResponse = {
        success: true,
        message: "Product revised successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public deleteProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      await this.service.deleteProduct(id);
      const response: ApiResponse = {
        success: true,
        message: "Product record purged successfully.",
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public createVariant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.createVariant(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Product matrix variant added successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  public updateVariant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const data = await this.service.updateVariant(id, req.body);
      const response: ApiResponse = {
        success: true,
        message: "Matrix variant updated successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  // ==========================================
  // Categories & Departments
  // ==========================================
  public createCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.createCategory(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Product category mapped successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  public createDepartment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.createDepartment(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Enterprise business department added.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  // ==========================================
  // Inventory Stock Adjustments & Listing
  // ==========================================
  public adjustStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.adjustInventory(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Inventory stock delta reported and audited successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public getInventoryLevels = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters: Record<string, any> = {};
      if (req.query.warehouseId) filters.warehouseId = Number(req.query.warehouseId);
      if (req.query.productId) filters.productId = Number(req.query.productId);
      if (req.query.variantId) filters.variantId = Number(req.query.variantId);

      const data = await this.service.getInventoryLevels(filters);
      const response: ApiResponse = {
        success: true,
        message: "Current stock allocations retrieved.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public getInventoryMovements = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters: Record<string, any> = {};
      if (req.query.inventoryId) filters.inventoryId = Number(req.query.inventoryId);
      if (req.query.type) filters.type = req.query.type;
      if (req.query.userId) filters.userId = Number(req.query.userId);

      const data = await this.service.getInventoryMovements(filters);
      const response: ApiResponse = {
        success: true,
        message: "Inventory audit logs and item movements fetched.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public checkReorderPoints = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.checkReorderPoints();
      const response: ApiResponse = {
        success: true,
        message: "Reorder levels and items deficiency checks compiled successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  // ==========================================
  // Snapshots & Valuation
  // ==========================================
  public takeSnapshot = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.takeSnapshot(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Warehouse stock valuation snapshot generated and safely saved.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  public getSnapshots = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters: Record<string, any> = {};
      if (req.query.warehouseId) filters.warehouseId = Number(req.query.warehouseId);
      if (req.query.snapshotType) filters.snapshotType = req.query.snapshotType;

      const data = await this.service.getSnapshots(filters);
      const response: ApiResponse = {
        success: true,
        message: "Audit valuation snapshots list loaded.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };
}
