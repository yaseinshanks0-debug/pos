// src/backend/api/controllers/return.controller.ts

import { Request, Response, NextFunction } from "express";
import { ReturnService } from "../../application/services/return.service.ts";
import { ApiResponse } from "../../application/dtos/dtos.ts";

export class ReturnController {
  constructor(private readonly service: ReturnService) {}

  public processReturn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.processReturn(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Sales return registered. Refund transaction and stock restocking processed.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  public processExchange = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { returnPayload, exchangeItems, cashierId, payments } = req.body;
      const data = await this.service.processExchange(
        returnPayload,
        exchangeItems,
        cashierId,
        payments || []
      );
      const response: ApiResponse = {
        success: true,
        message: "Unified product exchange cycle executed successfully. Logs reconciled.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };
}
