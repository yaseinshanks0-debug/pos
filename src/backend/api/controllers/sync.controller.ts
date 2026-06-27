// src/backend/api/controllers/sync.controller.ts

import { Request, Response, NextFunction } from "express";
import { SyncService } from "../../application/services/sync.service.ts";
import { OfflineSyncService } from "../../application/services/offline-sync.service.ts";
import { ApiResponse } from "../../application/dtos/dtos.ts";

export class SyncController {
  constructor(
    private readonly service: SyncService,
    private readonly offlineSyncService: OfflineSyncService
  ) {}

  public syncStoreData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.syncStoreData(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Ingested store synchronization changes. Conflict rules evaluated.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public fetchStoreUpdates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const storeId = Number(req.params.storeId);
      const lastSyncTime = req.query.lastSyncTime ? String(req.query.lastSyncTime) : undefined;
      const data = await this.service.fetchStoreUpdates(storeId, lastSyncTime);
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

  public getPendingConflicts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getPendingConflicts();
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

  public getConflictById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const data = await this.service.getConflictById(id);
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

  public resolveConflict = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const conflictId = Number(req.params.id);
      const data = await this.service.resolveConflict(conflictId, req.body);
      const response: ApiResponse = {
        success: true,
        message: "Conflict resolved status. Targets synchronized successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public getSyncHealthMetrics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.fetchSyncHealthMetrics();
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

  public runRetryWorker = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.executeSyncRetryWorker();
      const response: ApiResponse = {
        success: true,
        message: "Offline sync retry routine cycles ended successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  // ==========================================
  // STAGE 3 OFFLINE SYNC CONTROLLER ENDPOINTS
  // ==========================================

  public enqueueOfflineTransaction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.offlineSyncService.enqueueOfflineTransaction(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Offline transaction enqueued into the transaction queue successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  public getOfflineQueue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const storeId = Number(req.params.storeId);
      const data = await this.offlineSyncService.getOfflineQueue(storeId);
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

  public createExchangeBatch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sourceStoreId, destinationStoreId } = req.body;
      const data = await this.offlineSyncService.createExchangeBatch(sourceStoreId, destinationStoreId);
      const response: ApiResponse = {
        success: true,
        message: "Store exchange batch packaged and created successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  public processExchangeBatch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const batchId = Number(req.params.id);
      const data = await this.offlineSyncService.processExchangeBatch(batchId);
      const response: ApiResponse = {
        success: true,
        message: "Store exchange batch sequential replay executed.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public synchronizeStore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const storeId = Number(req.params.storeId);
      const data = await this.offlineSyncService.synchronizeStore(storeId);
      const response: ApiResponse = {
        success: true,
        message: "Store integrated offline transaction synchronization completed.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public getStage3Conflicts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.offlineSyncService.getPendingConflicts();
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

  public resolveStage3Conflict = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.offlineSyncService.resolveConflict(req.body);
      const response: ApiResponse = {
        success: true,
        message: "Stage 3 sync conflict resolved successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  public reconcileMultiStoreState = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const storeId = Number(req.params.storeId);
      const data = await this.offlineSyncService.reconcileMultiStoreState(storeId);
      const response: ApiResponse = {
        success: true,
        message: "Multi-store reconciliation audit executed successfully.",
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };
}
