// src/backend/application/services/product-engine.service.ts

import { IUnitOfWork } from "../ports/unit-of-work.interface.ts";
import { ILogger } from "../ports/logger.interface.ts";
import { GenerateProductMatrixDto, CreateCustomerPricingRuleDto } from "../dtos/dtos.ts";
import { BusinessRuleException, ValidationError } from "../../domain/exceptions.ts";

export class ProductEngineService {
  constructor(
    private readonly uow: IUnitOfWork,
    private readonly logger: ILogger
  ) {}

  public async generateMatrix(dto: GenerateProductMatrixDto): Promise<any[]> {
    this.logger.info(`Generating matrix for product ${dto.productId}`);
    
    // Simple Cartesian product generator for attributes
    const attributeCombinations = this.generateCombinations(dto.attributes);
    
    return this.uow.runInTransaction(async (txUow, tx) => {
      const variantRepo = txUow.getRepository<any>("productVariants", tx);
      const generatedVariants = [];

      for (const combo of attributeCombinations) {
        const variantName = combo.map(c => c.value).join(" ");
        const sku = `${dto.baseSku}-${combo.map(c => c.value.substring(0, 3).toUpperCase()).join("-")}`;
        
        // Basic SKU uniqueness check
        const allVariants = await variantRepo.findAll();
        if (allVariants.find((v: any) => v.sku === sku)) {
          this.logger.warn(`Skipping duplicate SKU: ${sku}`);
          continue;
        }

        const variant = await variantRepo.create({
          productId: dto.productId,
          sku: sku,
          barcode: `${dto.baseBarcode}-${Math.floor(Math.random() * 10000)}`,
          variantName: variantName,
          size: combo.find(c => c.name === "Size")?.value || null,
          color: combo.find(c => c.name === "Color")?.value || null,
          material: combo.find(c => c.name === "Material")?.value || null,
          style: combo.find(c => c.name === "Style")?.value || null,
          costPrice: String(dto.baseCost),
          retailPrice: String(dto.baseRetail),
          isActive: true,
          createdAt: new Date()
        });
        generatedVariants.push(variant);
      }
      return generatedVariants;
    });
  }

  private generateCombinations(attributes: Array<{ name: string; values: string[] }>): Array<Array<{ name: string; value: string }>> {
    const result: Array<Array<{ name: string; value: string }>> = [];
    
    const helper = (index: number, current: Array<{ name: string; value: string }>) => {
      if (index === attributes.length) {
        result.push([...current]);
        return;
      }
      for (const value of attributes[index].values) {
        helper(index + 1, [...current, { name: attributes[index].name, value }]);
      }
    };
    
    helper(0, []);
    return result;
  }

  public async createCustomerPricingRule(dto: CreateCustomerPricingRuleDto): Promise<any> {
    this.logger.info(`Creating pricing rule for product ${dto.productId}`);
    const rulesRepo = this.uow.getRepository<any>("customerPricingRules");
    
    return rulesRepo.create({
      companyId: dto.companyId,
      customerId: dto.customerId || null,
      customerGroupId: dto.customerGroupId || null,
      productId: dto.productId,
      variantId: dto.variantId || null,
      price: String(dto.price),
      discountPercentage: dto.discountPercentage ? String(dto.discountPercentage) : null,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      createdAt: new Date()
    });
  }

  public async trackInventoryItem(dto: {
    inventoryId: number;
    serialNumber?: string;
    lotNumber?: string;
    expirationDate?: Date;
    quantity: number;
  }): Promise<any> {
    const repo = this.uow.getRepository<any>("inventoryLotsSerials");
    return repo.create({
      ...dto,
      status: "available",
      createdAt: new Date()
    });
  }
}
