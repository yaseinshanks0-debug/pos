// src/backend/api/controllers/shift.controller.ts

import { Request, Response, NextFunction } from "express";
import { ShiftService } from "../../application/services/shift.service.ts";
import { ApiResponse } from "../../application/dtos/dtos.ts";

export class ShiftController {
  constructor(private readonly service: ShiftService) {}

  public openShift = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.openShift(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Shift started successfully. Cash drawer status changed to OPEN.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  public closeShift = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shiftId = Number(req.params.id);
      const data = await this.service.closeShift(shiftId, req.body);
      const response: ApiResponse = {
        success: true,
        message: "Shift closed. Cash reconcile metrics completed.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public getDrawerStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const data = await this.service.getDrawerStatus(id);
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

  public listDrawers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const storeId = req.query.storeId ? Number(req.query.storeId) : undefined;
      const filters = storeId ? { storeId } : {};
      const data = await this.service.listDrawers(filters);
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

  public createDrawer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { storeId, drawerName } = req.body;
      const data = await this.service.createDrawer(storeId, drawerName);
      const response: ApiResponse = {
        success: true,
        message: "New terminal register registered successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  public getActiveShiftForDrawer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const drawerId = Number(req.params.drawerId);
      const data = await this.service.getActiveShiftForDrawer(drawerId);
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
