# FIFO Costing Engine

## Logic
Cost layers are managed using the `CostLayer` aggregate root.
1. When stock is received via `ReceiveStockCommand`, an `OPEN` layer is created with a `unitCost`.
2. When stock is sold via `ConsumeStockCommand`, the repository fetches all `OPEN` layers, sorted sequentially by `receivedAt` (`ASC`).
3. The engine depletes the oldest layer. If a layer reaches `0` remaining, its state transitions to `DEPLETED`.

## Consistency
The domain objects enforces bounds to ensure no negative numbers are consumed. The repository encapsulates the transaction.
