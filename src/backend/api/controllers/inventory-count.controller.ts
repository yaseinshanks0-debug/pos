// src/backend/api/controllers/inventory-count.controller.ts

import { Request, Response, NextFunction } from "express";
import { InventoryCountService } from "../../application/services/inventory-count.service.ts";
import { ApiResponse } from "../../application/dtos/dtos.ts";

export class InventoryCountController {
  constructor(private readonly service: InventoryCountService) {}

  public startCountSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.startCountSession(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Inventory count session started successfully.",
        data,
        timestamp: new Date().toISOString(),
      };
      res.status(210).json(response); // Use 201 or standard 200
    } catch (err) {
      next(err);
    }
  };

  public submitCounts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const data = await this.service.submitCounts({ id, ...req.body });
      const response: ApiResponse = {
        success: true,
        message: "Counts submitted successfully.",
        data,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public approveCountSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const { approvedByUserId } = req.body;

      if (!approvedByUserId) {
        res.status(400).json({
          success: false,
          message: '"approvedByUserId" is required to approve count session.',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const data = await this.service.approveCountSession(id, approvedByUserId);
      const response: ApiResponse = {
        success: true,
        message: "Count session approved. Actual stock adjusted and double-entry postings logged.",
        data,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public cancelCountSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const data = await this.service.cancelCountSession(id);
      const response: ApiResponse = {
        success: true,
        message: "Inventory count session cancelled.",
        data,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };
}
