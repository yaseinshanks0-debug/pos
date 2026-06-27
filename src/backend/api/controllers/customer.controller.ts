// src/backend/api/controllers/customer.controller.ts

import { Request, Response, NextFunction } from "express";
import { CustomerService } from "../../application/services/customer.service.ts";
import { ApiResponse } from "../../application/dtos/dtos.ts";

export class CustomerController {
  constructor(private readonly service: CustomerService) {}

  public createCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.createCustomer(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Customer profile added to CRM database.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  public lookupCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = String(req.query.q || "");
      const data = await this.service.lookupCustomer(query);
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

  public getCustomerById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const data = await this.service.getCustomerById(id);
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

  public adjustStoreCredit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const { amount, reason, referenceType, referenceId, userId } = req.body;
      const data = await this.service.adjustStoreCredit(
        id,
        Number(amount),
        reason,
        referenceType,
        referenceId,
        userId
      );
      const response: ApiResponse = {
        success: true,
        message: "Customer store credit ledger revised successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public lookupGiftCard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { cardNumber } = req.params;
      const data = await this.service.lookupGiftCard(cardNumber);
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
