// src/backend/api/controllers/transfer-order.controller.ts

import { Request, Response, NextFunction } from "express";
import { TransferOrderService } from "../../application/services/transfer-order.service.ts";
import { ApiResponse } from "../../application/dtos/dtos.ts";

export class TransferOrderController {
  constructor(private readonly service: TransferOrderService) {}

  public create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.createTransfer(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Transfer order created successfully in draft mode.",
        data,
        timestamp: new Date().toISOString(),
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  public approve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const { userId } = req.body; // Normally parsed from auth session token

      if (!userId) {
        res.status(400).json({
          success: false,
          message: '"userId" is required in the request body to approve.',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const data = await this.service.approveTransfer(id, userId);
      const response: ApiResponse = {
        success: true,
        message: "Transfer order approved successfully.",
        data,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public ship = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const data = await this.service.shipTransfer(id);
      const response: ApiResponse = {
        success: true,
        message: "Transfer order successfully shipped and in transit. Source inventory adjusted.",
        data,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public receive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const { userId, items } = req.body;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: '"userId" is required to receive.',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!items || !Array.isArray(items)) {
        res.status(400).json({
          success: false,
          message: '"items" array containing itemId and qtyReceived is required.',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const data = await this.service.receiveTransfer(id, userId, items);
      const response: ApiResponse = {
        success: true,
        message: `Transfer order reception completed. Final status: ${data.status}.`,
        data,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const data = await this.service.cancelTransfer(id);
      const response: ApiResponse = {
        success: true,
        message: "Transfer order cancelled.",
        data,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };
}
