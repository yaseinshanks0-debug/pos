# Inventory Engine Architecture

The Inventory Engine is a high-performance module designed to manage physical and logical stock across multiple warehouse locations.

## Design Philosophy
The engine uses **Clean Architecture** and **CQRS**. Write models (Commands) construct `CostLayer` and `InventoryLedgerEntry` aggregates. Read models (Queries) aggregate SQL views directly.

## Components
- **Warehouses**: Manage hierarchy, locations, and defaults.
- **Stock Ledger**: Immutable append-only log of every inventory transaction (Purchasing, Sales, Adjustments).
- **Reservations**: Locking items against a cart or pending order to prevent overselling.
- **Alerts & Reorder Rules**: Proactive low-stock indicators.

## Performance
Built upon Drizzle ORM heavily indexed B-Tree columns for sub-100ms response times.
