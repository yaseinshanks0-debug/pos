import { pgTable, text, timestamp, boolean, uuid, varchar, decimal } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  parentId: uuid('parent_id'), // Self-referencing for hierarchy
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: 'ParentChildCategory',
  }),
  children: many(categories, { relationName: 'ParentChildCategory' }),
  products: many(products),
}));

export const brands = pgTable('brands', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const brandsRelations = relations(brands, ({ many }) => ({
  products: many(products),
}));

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  sku: varchar('sku', { length: 100 }).unique().notNull(), // Stock Keeping Unit
  categoryId: uuid('category_id').references(() => categories.id),
  brandId: uuid('brand_id').references(() => brands.id),
  unitOfMeasure: varchar('unit_of_measure', { length: 50 }).notNull().default('EA'), // EA, KG, L, etc.
  isActive: boolean('is_active').default(true).notNull(),
  isTracked: boolean('is_tracked').default(true).notNull(), // Inventory tracking
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  brand: one(brands, {
    fields: [products.brandId],
    references: [brands.id],
  }),
  barcodes: many(productBarcodes),
  prices: many(productPrices),
}));

export const productBarcodes = pgTable('product_barcodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  barcode: varchar('barcode', { length: 100 }).unique().notNull(),
  barcodeType: varchar('barcode_type', { length: 50 }), // UPC, EAN, CODE128
  isPrimary: boolean('is_primary').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const productBarcodesRelations = relations(productBarcodes, ({ one }) => ({
  product: one(products, {
    fields: [productBarcodes.productId],
    references: [products.id],
  }),
}));

export const productPrices = pgTable('product_prices', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  storeId: uuid('store_id'), // null means default/global price
  priceTier: varchar('price_tier', { length: 50 }).notNull().default('RETAIL'), // RETAIL, WHOLESALE, EMPLOYEE
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  effectiveDate: timestamp('effective_date').defaultNow().notNull(),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const productPricesRelations = relations(productPrices, ({ one }) => ({
  product: one(products, {
    fields: [productPrices.productId],
    references: [products.id],
  }),
}));
