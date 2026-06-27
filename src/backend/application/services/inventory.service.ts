// src/backend/application/services/inventory.service.ts

import { IUnitOfWork } from "../ports/unit-of-work.interface.ts";
import { ILogger } from "../ports/logger.interface.ts";
import { 
  CreateProductDto, 
  UpdateProductDto, 
  CreateProductVariantDto, 
  UpdateProductVariantDto, 
  CreateCategoryDto, 
  CreateDepartmentDto, 
  InventoryAdjustmentDto,
  CreateInventorySnapshotDto
} from "../dtos/dtos.ts";
import { Validator } from "../dtos/validation.ts";
import { 
  NotFoundException, 
  BusinessRuleException,
  ValidationError
} from "../../domain/exceptions.ts";
import { IInventoryRepository } from "../../domain/repository.interface.ts";
import { AccountingService } from "./accounting.service.ts";

export class InventoryService {
  constructor(
    private readonly uow: IUnitOfWork,
    private readonly logger: ILogger
  ) {}

  // ==========================================
  // Catalog (Products & Variants)
  // ==========================================
  public async createProduct(dto: CreateProductDto): Promise<any> {
    this.logger.info(`Validating new product creation: SKU ${dto.sku}`);
    Validator.validateCreateProduct(dto);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const productRepo = txUow.getRepository<any>("products", tx);
      
      // SKU & Barcode uniqueness check
      const allProd = await productRepo.findAll();
      const duplicateSku = allProd.find((p: any) => p.sku.toLowerCase() === dto.sku.toLowerCase());
      if (duplicateSku) {
        throw new ValidationError({ sku: ["A product with this SKU already exists."] });
      }

      const duplicateBarcode = allProd.find((p: any) => p.barcode === dto.barcode);
      if (duplicateBarcode) {
        throw new ValidationError({ barcode: ["A product with this barcode already exists."] });
      }

      const newProduct = await productRepo.create({
        companyId: dto.companyId,
        sku: dto.sku.trim(),
        barcode: dto.barcode.trim(),
        name: dto.name,
        description: dto.description || null,
        categoryId: dto.categoryId || null,
        departmentId: dto.departmentId || null,
        brand: dto.brand || null,
        costPrice: String(dto.costPrice),
        retailPrice: String(dto.retailPrice),
        taxCategoryId: dto.taxCategoryId || null,
        reorderPoint: dto.reorderPoint !== undefined ? dto.reorderPoint : 5,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      this.logger.info(`Product created: ID ${newProduct.id}, SKU ${newProduct.sku}`);
      return newProduct;
    });
  }

  public async updateProduct(id: number, dto: UpdateProductDto): Promise<any> {
    this.logger.info(`Updating product ID ${id}`);
    return this.uow.runInTransaction(async (txUow, tx) => {
      const productRepo = txUow.getRepository<any>("products", tx);
      const product = await productRepo.findById(id);
      if (!product) {
        throw new NotFoundException("products", id);
      }

      const updateData: Record<string, any> = {
        updatedAt: new Date()
      };

      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.description !== undefined) updateData.description = dto.description;
      if (dto.categoryId !== undefined) updateData.categoryId = dto.categoryId;
      if (dto.departmentId !== undefined) updateData.departmentId = dto.departmentId;
      if (dto.brand !== undefined) updateData.brand = dto.brand;
      if (dto.costPrice !== undefined) updateData.costPrice = String(dto.costPrice);
      if (dto.retailPrice !== undefined) updateData.retailPrice = String(dto.retailPrice);
      if (dto.taxCategoryId !== undefined) updateData.taxCategoryId = dto.taxCategoryId;
      if (dto.reorderPoint !== undefined) updateData.reorderPoint = dto.reorderPoint;

      const updated = await productRepo.update(id, updateData);
      return updated;
    });
  }

  public async deleteProduct(id: number): Promise<boolean> {
    this.logger.warn(`Deleting product ID ${id}`);
    const productRepo = this.uow.getRepository<any>("products");
    const product = await productRepo.findById(id);
    if (!product) {
      throw new NotFoundException("products", id);
    }
    return productRepo.delete(id);
  }

  public async createVariant(dto: CreateProductVariantDto): Promise<any> {
    this.logger.info(`Creating product variant for product parent ID ${dto.productId}`);
    if (!dto.sku || !dto.barcode || !dto.variantName) {
      throw new ValidationError({ variant: ["SKU, Barcode, and Variant Name are required."] });
    }

    return this.uow.runInTransaction(async (txUow, tx) => {
      const variantRepo = txUow.getRepository<any>("productVariants", tx);
      const productRepo = txUow.getRepository<any>("products", tx);

      const product = await productRepo.findById(dto.productId);
      if (!product) {
        throw new NotFoundException("products", dto.productId);
      }

      // Check duplicate sku
      const allVariants = await variantRepo.findAll();
      if (allVariants.find((v: any) => v.sku.toLowerCase() === dto.sku.toLowerCase())) {
        throw new ValidationError({ sku: ["Variant SKU is already registered."] });
      }

      const newVariant = await variantRepo.create({
        productId: dto.productId,
        sku: dto.sku.trim(),
        barcode: dto.barcode.trim(),
        variantName: dto.variantName,
        size: dto.size || null,
        color: dto.color || null,
        material: dto.material || null,
        costPrice: dto.costPrice ? String(dto.costPrice) : null,
        retailPrice: dto.retailPrice ? String(dto.retailPrice) : null,
        isActive: dto.isActive !== undefined ? Boolean(dto.isActive) : true,
        createdAt: new Date()
      });

      this.logger.info(`Product variant created: ID ${newVariant.id} SKU ${newVariant.sku}`);
      return newVariant;
    });
  }

  public async updateVariant(id: number, dto: UpdateProductVariantDto): Promise<any> {
    this.logger.info(`Updating variant ID ${id}`);
    const variantRepo = this.uow.getRepository<any>("productVariants");
    const variant = await variantRepo.findById(id);
    if (!variant) {
      throw new NotFoundException("productVariants", id);
    }

    const payload: Record<string, any> = {};
    if (dto.variantName !== undefined) payload.variantName = dto.variantName;
    if (dto.size !== undefined) payload.size = dto.size;
    if (dto.color !== undefined) payload.color = dto.color;
    if (dto.material !== undefined) payload.material = dto.material;
    if (dto.costPrice !== undefined) payload.costPrice = dto.costPrice ? String(dto.costPrice) : null;
    if (dto.retailPrice !== undefined) payload.retailPrice = dto.retailPrice ? String(dto.retailPrice) : null;
    if (dto.isActive !== undefined) payload.isActive = Boolean(dto.isActive);

    return variantRepo.update(id, payload);
  }

  // ==========================================
  // Categories & Departments
  // ==========================================
  public async createCategory(dto: CreateCategoryDto): Promise<any> {
    if (!dto.name || dto.name.trim() === "") {
      throw new ValidationError({ name: ["Category name is required."] });
    }
    const catRepo = this.uow.getRepository<any>("categories");
    return catRepo.create({
      companyId: dto.companyId,
      name: dto.name,
      parentId: dto.parentId || null,
      createdAt: new Date()
    });
  }

  public async createDepartment(dto: CreateDepartmentDto): Promise<any> {
    if (!dto.name || dto.name.trim() === "") {
      throw new ValidationError({ name: ["Department name is required."] });
    }
    const deptRepo = this.uow.getRepository<any>("departments");
    return deptRepo.create({
      companyId: dto.companyId,
      name: dto.name,
      createdAt: new Date()
    });
  }

  // ==========================================
  // Stock Adjustments
  // ==========================================
  public async adjustInventory(dto: InventoryAdjustmentDto): Promise<any> {
    this.logger.info(`Processing inventory adjustment of ${dto.quantityDelta} units for product ${dto.productId}`);
    Validator.validateInventoryAdjustment(dto);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const inventoryRepo = txUow.getRepository<any>("inventory", tx) as unknown as IInventoryRepository;
      
      const stock = await inventoryRepo.adjustStock(
        dto.warehouseId,
        dto.productId,
        dto.variantId || null,
        dto.quantityDelta,
        dto.reasonCode,
        dto.userId
      );

      // Fetch warehouse details for matching storeId
      const warehouseRepo = txUow.getRepository<any>("warehouses", tx);
      const pWarehouse = await warehouseRepo.findById(dto.warehouseId);
      const storeIdToUse = pWarehouse ? pWarehouse.storeId : null;

      // ==========================================
      // AUTOMATIC POSTING: Inventory Adjustment
      // ==========================================
      try {
        const productRepo = txUow.getRepository<any>("products", tx);
        const product = await productRepo.findById(dto.productId);
        let costPrice = 0;
        if (product) {
          costPrice = Number(product.costPrice || 0);
        }

        if (dto.variantId) {
          const variantRepo = txUow.getRepository<any>("productVariants", tx);
          const variant = await variantRepo.findById(dto.variantId);
          if (variant && variant.costPrice) {
            costPrice = Number(variant.costPrice);
          }
        }

        const totalValue = Number((costPrice * Math.abs(dto.quantityDelta)).toFixed(2));

        if (totalValue > 0) {
          const accountingService = new AccountingService(txUow, this.logger);
          const lines = [];

          if (dto.quantityDelta < 0) {
            // Shrinkage Loss Expense
            lines.push({
              accountCode: "5020",
              accountName: "Inventory Shrinkage Expense",
              accountType: "expenses" as const,
              debit: totalValue,
              credit: 0
            });
            lines.push({
              accountCode: "1300",
              accountName: "Inventory Asset",
              accountType: "assets" as const,
              debit: 0,
              credit: totalValue
            });
          } else {
            // Adjustment Gain
            lines.push({
              accountCode: "1300",
              accountName: "Inventory Asset",
              accountType: "assets" as const,
              debit: totalValue,
              credit: 0
            });
            lines.push({
              accountCode: "5020",
              accountName: "Inventory Shrinkage Expense",
              accountType: "expenses" as const,
              debit: 0,
              credit: totalValue
            });
          }

          await accountingService.postJournalEntry({
            companyId: 1, // Default main company
            storeId: storeIdToUse,
            referenceType: "inventory_adjustment",
            referenceId: stock.id,
            description: `Automatic posting for Inventory Adjustment: ${dto.reasonCode} of SKU ${product ? product.sku : dto.productId}`,
            lines
          }, txUow, tx);
        }
      } catch (err: any) {
        this.logger.error(`Failed automatic journal posting for Inventory Adjustment: ${err.message}`);
        // We throw to guarantee transactional consistency
        throw err;
      }

      this.logger.info(`Inventory adjusted successfully. New Qty: ${stock.quantity}`);
      return stock;
    });
  }

  // ==========================================
  // Inventory Listing & Reorder point checking
  // ==========================================
  public async getInventoryLevels(filters?: Record<string, any>): Promise<any[]> {
    this.logger.info("Listing current stock levels in the enterprise...");
    const inventoryRepo = this.uow.getRepository<any>("inventory");
    return inventoryRepo.findAll(filters);
  }

  public async getInventoryMovements(filters?: Record<string, any>): Promise<any[]> {
    this.logger.info("Fetching transaction log history for inventory movements...");
    const movementRepo = this.uow.getRepository<any>("inventoryMovements");
    return movementRepo.findAll(filters);
  }

  public async checkReorderPoints(): Promise<any[]> {
    this.logger.info("Evaluating stocking levels for items which fell below minimum reorder points...");
    const inventoryRepo = this.uow.getRepository<any>("inventory");
    const productsRepo = this.uow.getRepository<any>("products");
    
    const allStock = await inventoryRepo.findAll();
    const allProducts = await productsRepo.findAll();

    const lowStockItems = [];

    for (const item of allStock) {
      const prod = allProducts.find((p: any) => p.id === item.productId);
      const reorderLevel = item.reorderLevel || prod?.reorderPoint || 5;
      
      if (item.quantity <= reorderLevel) {
        lowStockItems.push({
          inventoryId: item.id,
          warehouseId: item.warehouseId,
          productId: item.productId,
          variantId: item.variantId,
          productName: prod ? prod.name : "Unknown Product",
          sku: prod ? prod.sku : "Unknown SKU",
          currentStock: item.quantity,
          reorderLevel: reorderLevel,
          deficit: reorderLevel - item.quantity
        });
      }
    }

    return lowStockItems;
  }

  // ==========================================
  // Inventory Valuation & Snapshots
  // ==========================================
  public async takeSnapshot(dto: CreateInventorySnapshotDto): Promise<any[]> {
    this.logger.info(`Taking a structured inventory valuation snapshot for warehouse ${dto.warehouseId}`);
    
    return this.uow.runInTransaction(async (txUow, tx) => {
      const inventoryRepo = txUow.getRepository<any>("inventory", tx);
      const productRepo = txUow.getRepository<any>("products", tx);
      const variantRepo = txUow.getRepository<any>("productVariants", tx);
      const snapshotRepo = txUow.getRepository<any>("inventorySnapshots", tx);

      const itemsInWarehouse = await inventoryRepo.findAll({ warehouseId: dto.warehouseId });
      const products = await productRepo.findAll();
      const variants = await variantRepo.findAll();

      const savedSnapshots = [];
      const snapshotDate = new Date();

      for (const item of itemsInWarehouse) {
        const prod = products.find((p: any) => p.id === item.productId);
        if (!prod) continue;

        let unitCost = prod.costPrice;
        let unitRetail = prod.retailPrice;

        if (item.variantId) {
          const v = variants.find((variant: any) => variant.id === item.variantId);
          if (v) {
            if (v.costPrice) unitCost = v.costPrice;
            if (v.retailPrice) unitRetail = v.retailPrice;
          }
        }

        const quantity = item.quantity;
        const valuationCost = String((Number(unitCost) * quantity).toFixed(2));
        const valuationRetail = String((Number(unitRetail) * quantity).toFixed(2));

        const created = await snapshotRepo.create({
          warehouseId: dto.warehouseId,
          productId: item.productId,
          variantId: item.variantId || null,
          snapshotDate,
          quantityCounted: quantity,
          unitCost: String(unitCost),
          unitRetail: String(unitRetail),
          valuationCost,
          valuationRetail,
          snapshotType: dto.snapshotType || "daily",
          createdAt: snapshotDate
        });

        savedSnapshots.push(created);
      }

      this.logger.info(`Snapshot complete inside warehouse ${dto.warehouseId}. Processed ${savedSnapshots.length} entries.`);
      return savedSnapshots;
    });
  }

  public async getSnapshots(filters?: Record<string, any>): Promise<any[]> {
    this.logger.info("Listing archived stock snapshots of valuation profiles...");
    const snapshotRepo = this.uow.getRepository<any>("inventorySnapshots");
    return snapshotRepo.findAll(filters);
  }
}
