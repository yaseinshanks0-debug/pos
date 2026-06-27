// src/backend/api/controllers/base.controller.ts

import { Request, Response, NextFunction } from "express";
import { BaseService } from "../../application/services/base.service.ts";
import { ApiResponse } from "../../application/dtos/dtos.ts";

export class BaseController<T> {
  constructor(
    protected readonly service: BaseService<T>,
    protected readonly entityFriendlyName: string
  ) {}

  public getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: "ID must be a valid integer.",
          timestamp: new Date().toISOString(),
        });
        return;
      }
      const data = await this.service.getById(id);
      const response: ApiResponse<T> = {
        success: true,
        data,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Map query params to filters
      const filters = req.query as Record<string, any>;
      const data = await this.service.getAll(filters);
      const response: ApiResponse<T[]> = {
        success: true,
        data,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.create(req.body);
      const response: ApiResponse<T> = {
        success: true,
        message: `${this.entityFriendlyName} was created successfully.`,
        data,
        timestamp: new Date().toISOString(),
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  public update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: "ID must be a valid integer.",
          timestamp: new Date().toISOString(),
        });
        return;
      }
      const data = await this.service.update(id, req.body);
      const response: ApiResponse<T> = {
        success: true,
        message: `${this.entityFriendlyName} was updated successfully.`,
        data,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: "ID must be a valid integer.",
          timestamp: new Date().toISOString(),
        });
        return;
      }
      const success = await this.service.delete(id);
      const response: ApiResponse<{ success: boolean }> = {
        success: true,
        message: `${this.entityFriendlyName} was deleted successfully.`,
        data: { success },
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };
}
