// src/backend/api/controllers/pos.controller.ts

import { Request, Response, NextFunction } from "express";
import { PosService } from "../../application/services/pos.service.ts";
import { ApiResponse } from "../../application/dtos/dtos.ts";

export class PosController {
  constructor(private readonly service: PosService) {}

  public productLookup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { barcodeOrSku } = req.params;
      const data = await this.service.productLookup(barcodeOrSku);
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

  public searchProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = String(req.query.q || "");
      const data = await this.service.searchProducts(query);
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

  public calculateCheckout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.calculateCheckout(req.body);
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

  public checkout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.checkout(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Checkout transaction completed. Stock and ledger indexes successfully processed.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };
}
