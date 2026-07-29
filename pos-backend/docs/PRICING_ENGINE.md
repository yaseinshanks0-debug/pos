# Pricing Engine

The Pricing Engine serves as the single deterministic source of truth for POS pricing.

## Deterministic Calculation Hierarchy
To prevent race conditions or infinite loops, pricing follows a strict execution cascade inside `PriceCalculatorService`:
1. **Base Price** (`RETAIL` or default)
2. **Price Level Override** (e.g., User is `VIP`)
3. **Store Override** (e.g., Regional branch markdown)
4. **Customer Override** (e.g., Negotiated B2B contract)
5. **Quantity Break Pricing** (e.g., Buy 10+, get $X)
6. **Active Promotions** (Filtered by priority, stackability bounds)
7. **Coupons / Manual Discounts**
8. **Tax Execution** (Calculated last unless inclusive)

## Domain Driven Bounds
- **Price is Immutable**: `Money` objects strictly enforce positive bounds and currency match.
- **Promotions**: Expiry dates, priority numbers, and `isStackable` bounds are isolated and tested separately inside the Domain entity.
