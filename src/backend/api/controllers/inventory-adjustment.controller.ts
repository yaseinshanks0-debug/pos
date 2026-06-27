// src/backend/api/controllers/inventory-adjustment.controller.ts

import { Request, Response, NextFunction } from "express";
import { InventoryAdjustmentService } from "../../application/services/inventory-adjustment.service.ts";
import { ApiResponse } from "../../application/dtos/dtos.ts";

export class InventoryAdjustmentController {
  constructor(private readonly service: InventoryAdjustmentService) {}

  public createAdjustment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.createAdjustment(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Inventory adjustment created successfully in draft mode.",
        data,
        timestamp: new Date().toISOString(),
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  public postAdjustment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const { approvedByUserId } = req.body;

      if (!approvedByUserId) {
        res.status(400).json({
          success: false,
          message: '"approvedByUserId" is required to post adjustment.',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const data = await this.service.postAdjustment(id, approvedByUserId);
      const response: ApiResponse = {
        success: true,
        message: "Inventory adjustment posted successfully. On-hand quantity adjusted and general ledger entries recorded.",
        data,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public cancelAdjustment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const data = await this.service.cancelAdjustment(id);
      const response: ApiResponse = {
        success: true,
        message: "Inventory adjustment cancelled.",
        data,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };
}
