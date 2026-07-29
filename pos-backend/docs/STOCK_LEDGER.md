# Stock Ledger

## Immutability
All movements inside the POS backend are tracked via `inventory_ledger`. This table is append-only.

## Movement Types
- PURCHASE
- SALE
- RETURN
- ADJUSTMENT
- TRANSFER_IN / TRANSFER_OUT

To calculate exact stock on hand at any given moment, the repository queries `SUM(quantity)` matching the product and warehouse IDs.
