import { pgTable, text, timestamp, boolean, uuid, varchar, decimal, integer, index, uniqueIndex, foreignKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { products, categories, brands } from './product.schema';
import { warehouses } from './inventory.schema';

export const currencies = pgTable('currencies', {
  code: varchar('code', { length: 3 }).primaryKey(), // USD, EUR, etc.
  name: varchar('name', { length: 50 }).notNull(),
  symbol: varchar('symbol', { length: 10 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const exchangeRates = pgTable('exchange_rates', {
  id: uuid('id').primaryKey().defaultRandom(),
  baseCurrency: varchar('base_currency', { length: 3 }).references(() => currencies.code).notNull(),
  targetCurrency: varchar('target_currency', { length: 3 }).references(() => currencies.code).notNull(),
  rate: decimal('rate', { precision: 15, scale: 6 }).notNull(),
  effectiveDate: timestamp('effective_date').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('exchange_rates_currency_idx').on(table.baseCurrency, table.targetCurrency, table.effectiveDate),
]);

export const priceLevels = pgTable('price_levels', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).unique().notNull(), // RETAIL, WHOLESALE, VIP, etc.
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const storePrices = pgTable('store_prices', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  storeId: uuid('store_id').references(() => warehouses.id, { onDelete: 'cascade' }).notNull(), // using warehouse as store for now
  priceLevelId: uuid('price_level_id').references(() => priceLevels.id).notNull(),
  price: decimal('price', { precision: 15, scale: 4 }).notNull(),
  currency: varchar('currency', { length: 3 }).references(() => currencies.code).notNull(),
  effectiveDate: timestamp('effective_date').defaultNow().notNull(),
  endDate: timestamp('end_date'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('store_prices_lookup_idx').on(table.productId, table.storeId, table.priceLevelId, table.isActive),
  index('store_prices_dates_idx').on(table.effectiveDate, table.endDate),
]);

export const customerPrices = pgTable('customer_prices', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  customerId: uuid('customer_id').notNull(), // customer module not built yet, soft reference
  price: decimal('price', { precision: 15, scale: 4 }).notNull(),
  currency: varchar('currency', { length: 3 }).references(() => currencies.code).notNull(),
  effectiveDate: timestamp('effective_date').defaultNow().notNull(),
  endDate: timestamp('end_date'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('customer_prices_lookup_idx').on(table.productId, table.customerId, table.isActive),
]);

export const priceRules = pgTable('price_rules', { // for Quantity Break Pricing
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  priceLevelId: uuid('price_level_id').references(() => priceLevels.id),
  minQuantity: integer('min_quantity').notNull(),
  maxQuantity: integer('max_quantity'),
  price: decimal('price', { precision: 15, scale: 4 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('price_rules_product_idx').on(table.productId, table.isActive),
]);

export const promotionRules = pgTable('promotion_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 50 }).notNull(), // PERCENTAGE, FIXED_AMOUNT, BOGO, MIX_MATCH
  value: decimal('value', { precision: 15, scale: 4 }).notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  timeOfDayStart: varchar('time_of_day_start', { length: 8 }), // e.g. "14:00:00"
  timeOfDayEnd: varchar('time_of_day_end', { length: 8 }),
  daysOfWeek: varchar('days_of_week', { length: 50 }), // e.g. "1,2,3,4,5"
  priority: integer('priority').default(0).notNull(),
  isStackable: boolean('is_stackable').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('promotion_rules_dates_idx').on(table.startDate, table.endDate, table.isActive),
]);

export const promotionProducts = pgTable('promotion_products', {
  id: uuid('id').primaryKey().defaultRandom(),
  promotionId: uuid('promotion_id').references(() => promotionRules.id, { onDelete: 'cascade' }).notNull(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
}, (table) => [
  uniqueIndex('promo_product_idx').on(table.promotionId, table.productId),
]);

export const promotionCategories = pgTable('promotion_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  promotionId: uuid('promotion_id').references(() => promotionRules.id, { onDelete: 'cascade' }).notNull(),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'cascade' }).notNull(),
}, (table) => [
  uniqueIndex('promo_category_idx').on(table.promotionId, table.categoryId),
]);

export const promotionBrands = pgTable('promotion_brands', {
  id: uuid('id').primaryKey().defaultRandom(),
  promotionId: uuid('promotion_id').references(() => promotionRules.id, { onDelete: 'cascade' }).notNull(),
  brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'cascade' }).notNull(),
}, (table) => [
  uniqueIndex('promo_brand_idx').on(table.promotionId, table.brandId),
]);

export const coupons = pgTable('coupons', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 100 }).unique().notNull(),
  promotionId: uuid('promotion_id').references(() => promotionRules.id, { onDelete: 'cascade' }),
  usageLimit: integer('usage_limit'),
  usageCount: integer('usage_count').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const taxCodes = pgTable('tax_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).unique().notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  rate: decimal('rate', { precision: 5, scale: 4 }).notNull(), // e.g. 0.0850 for 8.5%
  isCompound: boolean('is_compound').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const taxRules = pgTable('tax_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  taxCodeId: uuid('tax_code_id').references(() => taxCodes.id).notNull(),
  productId: uuid('product_id').references(() => products.id),
  categoryId: uuid('category_id').references(() => categories.id),
  storeId: uuid('store_id').references(() => warehouses.id), // Used as region/store
  isActive: boolean('is_active').default(true).notNull(),
});

export const priceHistory = pgTable('price_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: varchar('entity_type', { length: 50 }).notNull(), // STORE_PRICE, CUSTOMER_PRICE, PROMOTION, BASE_PRICE
  entityId: uuid('entity_id').notNull(),
  oldPrice: decimal('old_price', { precision: 15, scale: 4 }),
  newPrice: decimal('new_price', { precision: 15, scale: 4 }).notNull(),
  reason: text('reason'),
  userId: uuid('user_id'), // Soft reference to employee/user
  approvedBy: uuid('approved_by'),
  changedAt: timestamp('changed_at').defaultNow().notNull(),
});

export const pricingAuditLogs = pgTable('pricing_audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  details: text('details').notNull(), // JSON string payload
  userId: uuid('user_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const giftCards = pgTable('gift_cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 100 }).unique().notNull(),
  initialBalance: decimal('initial_balance', { precision: 15, scale: 4 }).notNull(),
  currentBalance: decimal('current_balance', { precision: 15, scale: 4 }).notNull(),
  currency: varchar('currency', { length: 3 }).references(() => currencies.code).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
