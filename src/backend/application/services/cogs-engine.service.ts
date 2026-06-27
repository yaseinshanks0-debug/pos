// src/backend/application/services/cogs-engine.service.ts

import { IUnitOfWork } from "../ports/unit-of-work.interface.ts";
import { ILogger } from "../ports/logger.interface.ts";
import { BusinessRuleException, NotFoundException } from "../../domain/exceptions.ts";

export class CogsEngineService {
  constructor(
    private readonly uow: IUnitOfWork,
    private readonly logger: ILogger
  ) {}

  /**
   * Resolve Store-Specific Retail Pricing Override
   * If a store price override is active for the current store, use it.
   */
  public async getStorePrice(storeId: number, variantId: number, basePrice: number): Promise<number> {
    try {
      const storePricesRepo = this.uow.getRepository<any>("storePrices");
      const overrides = await storePricesRepo.findAll({ storeId, variantId });
      
      if (overrides && overrides.length > 0) {
        const activeOverride = overrides[0];
        const now = new Date();
        
        // Check if there is a promotional pricing window
        if (activeOverride.isPromo) {
          const start = activeOverride.promoStart ? new Date(activeOverride.promoStart) : null;
          const end = activeOverride.promoEnd ? new Date(activeOverride.promoEnd) : null;
          
          if ((!start || now >= start) && (!end || now <= end)) {
            this.logger.info(`Applying promotional store price override for Variant ID ${variantId} at Store ${storeId}: $${activeOverride.overridePrice}`);
            return Number(activeOverride.overridePrice);
          }
        }
        
        this.logger.info(`Applying standard store price override for Variant ID ${variantId} at Store ${storeId}: $${activeOverride.overridePrice}`);
        return Number(activeOverride.overridePrice);
      }
    } catch (err: any) {
      this.logger.error(`Error resolving store pricing override: ${err.message}. Cascading to base retail price.`);
    }
    return basePrice;
  }

  /**
   * Instantiate an Inventory Cost Layer (FIFO Seed) when merchandise is received (POs, returns, manual gains).
   */
  public async createCostLayer(
    companyId: number,
    storeId: number,
    variantId: number,
    quantityReceived: number,
    unitCost: number,
    referenceType: string,
    referenceId: number,
    tx?: any
  ): Promise<any> {
    this.logger.info(`Instantiating FIFO cost layer batch for Store ${storeId}, Variant ${variantId}: Qty ${quantityReceived} at Cost $${unitCost}`);
    
    const layerRepo = this.uow.getRepository<any>("inventoryCostLayers", tx);
    return layerRepo.create({
      companyId,
      storeId,
      variantId,
      receivedDate: new Date(),
      referenceType,
      referenceId,
      quantityReceived: String(Number(quantityReceived).toFixed(2)),
      quantityRemaining: String(Number(quantityReceived).toFixed(2)),
      unitCost: String(Number(unitCost).toFixed(2)),
      createdAt: new Date()
    });
  }

  /**
   * Deplete FIFO Cost Layers for a given sale / checkout movement.
   * Drains quantities from layers using 'receivedDate ASC' order.
   */
  public async depleteFifoLayers(
    companyId: number,
    storeId: number,
    variantId: number,
    quantityToDeplete: number,
    saleItemId: number | null,
    movementId: number,
    tx?: any
  ): Promise<{
    totalCOGS: number;
    consumptions: Array<{ layerId: number; qtyConsumed: number; unitCost: number; cogsPosted: number }>;
  }> {
    this.logger.info(`Draining FIFO cost layers for SKU ${variantId} at Store ${storeId}: requested qty ${quantityToDeplete}`);
    
    if (quantityToDeplete <= 0) {
      return { totalCOGS: 0, consumptions: [] };
    }

    const layerRepo = this.uow.getRepository<any>("inventoryCostLayers", tx);
    const consumptionRepo = this.uow.getRepository<any>("inventoryCostLayerConsumptions", tx);

    // Fetch all layers of this variant inside this store
    const allLayers = await layerRepo.findAll({ storeId, variantId });
    
    // Sort oldest first (FIFO)
    const sortedActiveLayers = allLayers
      .filter((layer: any) => Number(layer.quantityRemaining) > 0)
      .sort((a: any, b: any) => new Date(a.receivedDate).getTime() - new Date(b.receivedDate).getTime());

    let remainingNeed = quantityToDeplete;
    let totalCOGS = 0;
    const consumptions: any[] = [];

    for (const layer of sortedActiveLayers) {
      if (remainingNeed <= 0) break;

      const layerRemaining = Number(layer.quantityRemaining);
      const consumedQty = Math.min(layerRemaining, remainingNeed);
      const cost = Number(layer.unitCost);
      const cogsAmount = consumedQty * cost;

      // Update layer remaining
      const updatedRemaining = layerRemaining - consumedQty;
      await layerRepo.update(layer.id, {
        quantityRemaining: String(updatedRemaining.toFixed(2))
      });

      // Write consumption link
      const loggedConsumption = await consumptionRepo.create({
        costLayerId: layer.id,
        saleItemId: saleItemId || null,
        movementId: movementId,
        quantityConsumed: String(consumedQty.toFixed(2)),
        cogsPosted: String(cogsAmount.toFixed(2)),
        createdAt: new Date()
      });

      this.logger.info(`FIFO Match: Consumed ${consumedQty} units from Layer ID ${layer.id} (Cost $${cost.toFixed(2)})`);

      consumptions.push({
        layerId: layer.id,
        qtyConsumed: consumedQty,
        unitCost: cost,
        cogsPosted: cogsAmount,
        consumptionId: loggedConsumption.id
      });

      totalCOGS += cogsAmount;
      remainingNeed -= consumedQty;
    }

    // Negative Inventory Correction:
    // If we depleted all active layers and we still have a deficit (sale of unreceived stock or negative inventory),
    // we backfill with a temporary fallback cost. We resolve the variant's catalog cost.
    if (remainingNeed > 0) {
      this.logger.warn(`Deficit of ${remainingNeed} items under variant ${variantId} for Store ${storeId}. Creating dummy correction layer.`);
      
      // Attempt to resolve variant/product cost
      const variantRepo = this.uow.getRepository<any>("productVariants", tx);
      const productRepo = this.uow.getRepository<any>("products", tx);
      let catalogCost = 0;
      
      try {
        const variant = await variantRepo.findById(variantId);
        if (variant) {
          if (variant.costPrice) {
            catalogCost = Number(variant.costPrice);
          } else {
            const product = await productRepo.findById(variant.productId);
            if (product) catalogCost = Number(product.costPrice || 0);
          }
        }
      } catch (err: any) {
        this.logger.error(`Could not resolve catalog cost to backfill negative inventory: ${err.message}`);
      }

      // Create a dummy negative-offset layer to track the deficit
      const negativeLayer = await layerRepo.create({
        companyId,
        storeId,
        variantId,
        receivedDate: new Date(),
        referenceType: "negative_deficit_correction",
        referenceId: movementId,
        quantityReceived: "0.00",
        // Record negative remainder to reconcile when the next PO is received
        quantityRemaining: String((-remainingNeed).toFixed(2)),
        unitCost: String(catalogCost.toFixed(2)),
        createdAt: new Date()
      });

      const deficitCost = remainingNeed * catalogCost;
      totalCOGS += deficitCost;

      const loggedConsumption = await consumptionRepo.create({
        costLayerId: negativeLayer.id,
        saleItemId: saleItemId || null,
        movementId: movementId,
        quantityConsumed: String(remainingNeed.toFixed(2)),
        cogsPosted: String(deficitCost.toFixed(2)),
        createdAt: new Date()
      });

      consumptions.push({
        layerId: negativeLayer.id,
        qtyConsumed: remainingNeed,
        unitCost: catalogCost,
        cogsPosted: deficitCost,
        consumptionId: loggedConsumption.id
      });
    }

    return {
      totalCOGS,
      consumptions
    };
  }

  /**
   * Reconcile Negative Deficits
   * When a Purchase Order is received, this method searches for negative_deficit_correction layers
   * of the same SKU and store, and applies the newly received batch cost to reconcile historical COGS adjustments.
   */
  public async reconcileNegativeDeficits(
    storeId: number,
    variantId: number,
    newQuantityReceived: number,
    newUnitCost: number,
    tx?: any
  ): Promise<number> {
    this.logger.info(`Reconciling negative inventory deficits for SKU ${variantId} at Store ${storeId} using incoming batch of Qty ${newQuantityReceived} at Cost $${newUnitCost}`);
    
    const layerRepo = this.uow.getRepository<any>("inventoryCostLayers", tx);
    
    // Find all layers of this variant in this store
    const allLayers = await layerRepo.findAll({ storeId, variantId });
    
    // Sort oldest negative layers first
    const negativeLayers = allLayers
      .filter((layer: any) => layer.referenceType === "negative_deficit_correction" && Number(layer.quantityRemaining) < 0)
      .sort((a: any, b: any) => new Date(a.receivedDate).getTime() - new Date(b.receivedDate).getTime());

    let availablePool = newQuantityReceived;
    let totalAdjustedCogs = 0;

    for (const negLayer of negativeLayers) {
      if (availablePool <= 0) break;

      const deficitQty = Math.abs(Number(negLayer.quantityRemaining));
      const reconciledQty = Math.min(deficitQty, availablePool);

      const oldUnitCost = Number(negLayer.unitCost);
      const costDifference = reconciledQty * (newUnitCost - oldUnitCost);

      const updatedRemaining = Number(negLayer.quantityRemaining) + reconciledQty;
      await layerRepo.update(negLayer.id, {
        quantityRemaining: String(updatedRemaining.toFixed(2)),
        // Re-align the layer unit cost to record accurate historical audits
        unitCost: String(newUnitCost.toFixed(2))
      });

      availablePool -= reconciledQty;
      totalAdjustedCogs += costDifference;

      this.logger.info(`Reconciled deficit of ${reconciledQty} units on Layer ID ${negLayer.id}; Cost adjustments difference: $${costDifference.toFixed(2)}`);
    }

    return availablePool;
  }

  /**
   * Reinstate/Restore depleted cost layers during a Sale Return.
   * Scans original consumptions and restores quantityRemaining on the original cost layers in reverse order.
   */
  public async reinstateRefundedLayers(
    saleItemId: number,
    returnQty: number,
    tx?: any
  ): Promise<void> {
    this.logger.info(`Restoring depleted cost layers for Sale Item ID ${saleItemId} returned quantity: ${returnQty}`);
    
    const consumptionRepo = this.uow.getRepository<any>("inventoryCostLayerConsumptions", tx);
    const layerRepo = this.uow.getRepository<any>("inventoryCostLayers", tx);

    const originalConsumptions = await consumptionRepo.findAll({ saleItemId });
    
    // Sort descending of creation to reverse oldest consumption layers
    const sortedConsumptions = originalConsumptions.sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    let remainingReturnQty = returnQty;

    for (const consumption of sortedConsumptions) {
      if (remainingReturnQty <= 0) break;

      const qtyInConsumption = Number(consumption.quantityConsumed);
      const refundingAmt = Math.min(qtyInConsumption, remainingReturnQty);

      const parentLayer = await layerRepo.findById(consumption.costLayerId);
      if (parentLayer) {
        const currentRemaining = Number(parentLayer.quantityRemaining);
        const reinstatedRemaining = currentRemaining + refundingAmt;

        await layerRepo.update(parentLayer.id, {
          quantityRemaining: String(reinstatedRemaining.toFixed(2))
        });

        this.logger.info(`Reinstated FIFO restore: Returned ${refundingAmt} units to Cost Layer ID ${parentLayer.id} (Current layer remainder: ${reinstatedRemaining})`);
        
        // Update consumption record to reflect return adjustment
        const newConsumptionQty = Math.max(0, qtyInConsumption - refundingAmt);
        const updatedCogs = newConsumptionQty * Number(parentLayer.unitCost);
        await consumptionRepo.update(consumption.id, {
          quantityConsumed: String(newConsumptionQty.toFixed(2)),
          cogsPosted: String(updatedCogs.toFixed(2))
        });

        remainingReturnQty -= refundingAmt;
      }
    }

    if (remainingReturnQty > 0) {
      this.logger.warn(`Returned quantity of ${returnQty} exceeded original sale consumption of ${returnQty - remainingReturnQty} for sale item ${saleItemId}. Excess returns dropped.`);
    }
  }
}
