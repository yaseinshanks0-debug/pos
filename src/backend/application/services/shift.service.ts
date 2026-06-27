// src/backend/application/services/shift.service.ts

import { IUnitOfWork } from "../ports/unit-of-work.interface.ts";
import { ILogger } from "../ports/logger.interface.ts";
import { OpenShiftDto, CloseShiftDto } from "../dtos/dtos.ts";
import { Validator } from "../dtos/validation.ts";
import { NotFoundException, BusinessRuleException } from "../../domain/exceptions.ts";

export class ShiftService {
  constructor(
    private readonly uow: IUnitOfWork,
    private readonly logger: ILogger
  ) {}

  public async openShift(dto: OpenShiftDto): Promise<any> {
    this.logger.info(`Validating open shift request for drawer ID ${dto.cashDrawerId}`);
    Validator.validateOpenShift(dto);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const drawerRepo = txUow.getRepository<any>("cashDrawers", tx);
      const shiftRepo = txUow.getRepository<any>("shifts", tx);

      // Verify cash drawer exists
      const drawer = await drawerRepo.findById(dto.cashDrawerId);
      if (!drawer) {
        throw new NotFoundException("cashDrawers", dto.cashDrawerId);
      }

      // Check if drawer is already occupied/opened
      if (drawer.status === "open") {
        throw new BusinessRuleException(
          "DrawerAlreadyOpen",
          `Cash drawer "${drawer.drawerName}" is already open. Close the active shift first.`
        );
      }

      // Create Shift
      const shift = await shiftRepo.create({
        cashDrawerId: dto.cashDrawerId,
        userId: dto.userId,
        openingTime: new Date(),
        openingCash: String(Number(dto.openingCash).toFixed(2)),
        expectedCash: String(Number(dto.openingCash).toFixed(2)),
        status: "open"
      });

      // Update cash drawer status to open
      await drawerRepo.update(dto.cashDrawerId, {
        status: "open"
      });

      this.logger.info(`Shift ID ${shift.id} successfully opened for drawer ${drawer.drawerName}`);
      return shift;
    });
  }

  public async closeShift(shiftId: number, dto: CloseShiftDto): Promise<any> {
    this.logger.info(`Closing shift ID ${shiftId}`);
    Validator.validateCloseShift(dto);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const shiftRepo = txUow.getRepository<any>("shifts", tx);
      const drawerRepo = txUow.getRepository<any>("cashDrawers", tx);
      const salesRepo = txUow.getRepository<any>("sales", tx);
      const paymentsRepo = txUow.getRepository<any>("payments", tx);
      const returnsRepo = txUow.getRepository<any>("salesReturns", tx);

      const shift = await shiftRepo.findById(shiftId);
      if (!shift) {
        throw new NotFoundException("shifts", shiftId);
      }

      if (shift.status !== "open") {
        throw new BusinessRuleException("ShiftAlreadyClosed", `Shift ID ${shiftId} is already closed.`);
      }

      // Fetch all sales processed on this shift
      const shiftSales = await salesRepo.findAll({ shiftId });
      
      // Calculate total cash payments processed during the shift
      let cashReceivedTotal = 0;
      for (const sale of shiftSales) {
        const salePayments = await paymentsRepo.findAll({ saleId: sale.id });
        const cashPmts = salePayments.filter((p: any) => p.paymentMethod === "cash");
        cashReceivedTotal += cashPmts.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      }

      // Fetch all returns processed during this shift
      // In our schema, returns don't link directly to shiftId, but we can query them by cashierId, storeOrByCashier or timestamp.
      // Alternatively, we look for returns whose cash refund was processed during the shift's timeframe.
      const allReturns = await returnsRepo.findAll({ storeId: shiftSales[0]?.storeId || 1 });
      const activeReturnsOnShift = allReturns.filter((r: any) => {
        const rDate = new Date(r.createdAt || r.updatedAt);
        const shiftOpened = new Date(shift.openingTime);
        return rDate >= shiftOpened && r.cashierId === shift.userId && r.refundMethod === "cash";
      });
      const cashRefundedTotal = activeReturnsOnShift.reduce((sum: number, r: any) => sum + Number(r.refundAmount), 0);

      const openingCash = Number(shift.openingCash);
      const expectedCash = openingCash + cashReceivedTotal - cashRefundedTotal;
      const actualCash = Number(dto.actualCash);
      const variance = actualCash - expectedCash;

      this.logger.info(`Reconciliation matrix: Opening: ${openingCash}, Received: ${cashReceivedTotal}, Refunded: ${cashRefundedTotal}, Expected: ${expectedCash}, Actual: ${actualCash}, Variance: ${variance}`);

      const closedShift = await shiftRepo.update(shiftId, {
        closingTime: new Date(),
        expectedCash: String(expectedCash.toFixed(2)),
        actualCash: String(actualCash.toFixed(2)),
        variance: String(variance.toFixed(2)),
        status: "closed"
      });

      // Close the cash drawer
      await drawerRepo.update(shift.cashDrawerId, {
         status: "closed"
      });

      // Record standard audit log
      const auditRepo = txUow.getRepository<any>("auditLogs", tx);
      await auditRepo.create({
        action: "SHIFT_CLOSED",
        entityName: "shifts",
        entityId: shiftId,
        details: `Cashed out shift ID ${shiftId}. Variance scored: ${variance.toFixed(2)}`,
        createdAt: new Date()
      });

      return closedShift;
    });
  }

  // ==========================================
  // Cash Drawer APIs
  // ==========================================
  public async getDrawerStatus(id: number): Promise<any> {
    const drawerRepo = this.uow.getRepository<any>("cashDrawers");
    const drawer = await drawerRepo.findById(id);
    if (!drawer) {
      throw new NotFoundException("cashDrawers", id);
    }
    return drawer;
  }

  public async listDrawers(filters?: Record<string, any>): Promise<any[]> {
    const drawerRepo = this.uow.getRepository<any>("cashDrawers");
    return drawerRepo.findAll(filters);
  }

  public async createDrawer(storeId: number, drawerName: string): Promise<any> {
    const drawerRepo = this.uow.getRepository<any>("cashDrawers");
    return drawerRepo.create({
      storeId,
      drawerName,
      status: "closed",
      createdAt: new Date()
    });
  }

  public async getActiveShiftForDrawer(drawerId: number): Promise<any> {
    const shiftRepo = this.uow.getRepository<any>("shifts");
    const all = await shiftRepo.findAll({ cashDrawerId: drawerId });
    return all.find((s: any) => s.status === "open") || null;
  }
}
