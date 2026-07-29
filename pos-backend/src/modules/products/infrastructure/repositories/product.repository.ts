import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, inArray } from 'drizzle-orm';
import { IProductRepository } from '../../domain/repositories/product.repository.interface';
import { Product, ProductPrice } from '../../domain/entities/product.entity';
import { Barcode } from '../../domain/value-objects/barcode.vo';
import { Money } from '../../domain/value-objects/money.vo';
import * as schema from '../../../../infrastructure/database/schema/product.schema';

export const DATABASE_CONNECTION = 'DATABASE_CONNECTION';

@Injectable()
export class ProductRepository implements IProductRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  private mapToDomain(row: any): Product {
    const product = new Product(
      row.id,
      row.name,
      row.sku,
      row.categoryId,
      row.brandId,
      row.unitOfMeasure,
      row.isTracked,
      row.isActive,
      row.description
    );

    if (row.barcodes) {
      row.barcodes.forEach((b: any) => {
        product.addBarcode(new Barcode(b.barcode, b.barcodeType, b.isPrimary));
      });
    }

    if (row.prices) {
      row.prices.forEach((p: any) => {
        product.addPrice(
          new ProductPrice(
            p.id,
            new Money(parseFloat(p.price), p.currency),
            p.priceTier,
            p.storeId,
            p.effectiveDate,
            p.endDate
          )
        );
      });
    }

    product.clearEvents(); // Reset domain events after loading from db
    return product;
  }

  async findById(id: string): Promise<Product | null> {
    const rows = await this.db.query.products.findFirst({
      where: eq(schema.products.id, id),
      with: {
        barcodes: true,
        prices: true,
      },
    });

    if (!rows) return null;
    return this.mapToDomain(rows);
  }

  async findBySku(sku: string): Promise<Product | null> {
    const rows = await this.db.query.products.findFirst({
      where: eq(schema.products.sku, sku),
      with: {
        barcodes: true,
        prices: true,
      },
    });

    if (!rows) return null;
    return this.mapToDomain(rows);
  }

  async findByBarcode(barcodeValue: string): Promise<Product | null> {
    const barcodeRow = await this.db.query.productBarcodes.findFirst({
      where: eq(schema.productBarcodes.barcode, barcodeValue),
    });

    if (!barcodeRow) return null;

    return this.findById(barcodeRow.productId);
  }

  async findAll(limit: number = 100, offset: number = 0): Promise<Product[]> {
    const rows = await this.db.query.products.findMany({
      limit,
      offset,
      with: {
        barcodes: true,
        prices: true,
      },
    });

    return rows.map((row) => this.mapToDomain(row));
  }

  async save(product: Product): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(schema.products).values({
        id: product.id,
        name: product.name,
        sku: product.sku,
        description: product.description,
        categoryId: product.categoryId,
        brandId: product.brandId,
        unitOfMeasure: product.unitOfMeasure,
        isTracked: product.isTracked,
        isActive: product.isActive,
      });

      if (product.barcodes.length > 0) {
        await tx.insert(schema.productBarcodes).values(
          product.barcodes.map((b) => ({
            productId: product.id,
            barcode: b.value,
            barcodeType: b.type,
            isPrimary: b.isPrimary,
          }))
        );
      }

      if (product.prices.length > 0) {
        await tx.insert(schema.productPrices).values(
          product.prices.map((p) => ({
            id: p.id,
            productId: product.id,
            priceTier: p.priceTier,
            storeId: p.storeId,
            price: p.price.amount.toString(),
            currency: p.price.currency,
            effectiveDate: p.effectiveDate,
            endDate: p.endDate,
          }))
        );
      }
    });
  }

  async update(product: Product): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.update(schema.products)
        .set({
          name: product.name,
          sku: product.sku,
          description: product.description,
          categoryId: product.categoryId,
          brandId: product.brandId,
          unitOfMeasure: product.unitOfMeasure,
          isTracked: product.isTracked,
          isActive: product.isActive,
          updatedAt: new Date(),
        })
        .where(eq(schema.products.id, product.id));

      // Handle Barcodes Delta
      await tx.delete(schema.productBarcodes).where(eq(schema.productBarcodes.productId, product.id));
      if (product.barcodes.length > 0) {
        await tx.insert(schema.productBarcodes).values(
          product.barcodes.map((b) => ({
            productId: product.id,
            barcode: b.value,
            barcodeType: b.type,
            isPrimary: b.isPrimary,
          }))
        );
      }

      // Handle Prices Delta
      await tx.delete(schema.productPrices).where(eq(schema.productPrices.productId, product.id));
      if (product.prices.length > 0) {
        await tx.insert(schema.productPrices).values(
          product.prices.map((p) => ({
            id: p.id,
            productId: product.id,
            priceTier: p.priceTier,
            storeId: p.storeId,
            price: p.price.amount.toString(),
            currency: p.price.currency,
            effectiveDate: p.effectiveDate,
            endDate: p.endDate,
          }))
        );
      }
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(schema.products).where(eq(schema.products.id, id));
  }
}
