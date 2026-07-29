# Promotion Engine

## Structure
Promotions are defined in `promotion_rules` and optionally linked to arrays in `promotion_products`, `promotion_categories`, or `promotion_brands`.

## Processing Flow
1. Fetch all `ACTIVE` promotions tied to the product explicitly or via category/brand traversal.
2. Filter out promos where the current cart/transaction `calculationDate` falls outside `startDate` or `endDate`.
3. Filter by Time of Day or Days of Week (e.g., Happy Hour).
4. Sort matching promos descending by `priority`.
5. Apply promos sequentially. Break execution immediately if a non-stackable promo applies.
