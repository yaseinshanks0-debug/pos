# Price History & Auditing

## Concept
Prices across enterprise platforms must never be changed silently.

## Mechanism
The `price_history` table records an append-only log detailing:
- `entityType` (Base Price, Store Override, Promotion)
- `oldPrice` vs `newPrice`
- `reason` and `userId` mapping for auditing transparency.
