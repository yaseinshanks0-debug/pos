# QuickBooks POS Multi-Store & Enterprise Accounting Engine Master Specification

---

## 1. Accounting Engine Gap Analysis & Architectural Validation

This section reviews the completed Accounting Engine against the required features and identifies the operational and structural gaps required for full enterprise readiness.

### 1.1 Summary of Implemented Features
* **Double-Entry Engine core (`accounting.service.ts`):** Includes `/accounting/journal-entry` tracking both debits and credits and verifying transactional balances.
* **Basic General Ledger:** Stores multi-entry journal lines linking to reference documents (sales, purchase orders, transfers).
* **Consolidated Statements:** Dynamic derivation of Balance Sheet, Profit & Loss, Trial Balance, and Cash Flow metrics.
* **Standard Chart of Accounts (COA):** Pre-seeded system accounts from asset cash clearings (`1010`) to COGS (`5010`) and adjustments (`5020`).

### 1.2 Enterprise Gap Analysis

| Requirement | Current Status | Structural Gap / Missing Architecture |
| :--- | :--- | :--- |
| **Multi-Store Segregation** | **Incomplete** | Shared table queries default to multi-store filters but completely lack automated store-level tenancy walls, separate division mappings, and inter-store ledger separation rules. |
| **Store-Level P&L** | **Partially Met** | Code queries filter entries with `storeId`. However, there is no automation to allocate cross-store operating corporate expenses or handle inter-store inventory transfer values. |
| **Store-Level Balance Sheet** | **Partially Met** | Generates balance sheet from store-filtered general ledger entries. Lacks inter-store current assets and liabilities accounts, causing unbalanced individual store balance sheets. |
| **Consolidated HQ Statements** | **Missing** | No structure to automate intercompany eliminations. HQ balances simply aggregate store ledgers without clearing intercompany transfers and balances. |
| **FIFO & Weighted Avg Costing**| **Missing** | The local tables capture general unit cost fields but lack tracking of discrete inventory purchase price batches (cost layers) and dynamic depletion tracking. |
| **PO Accrual Accounting** | **Missing** | Receiving products directly updates inventory assets and AP values. Modern accrual processes (Goods Received Not Invoiced - GRNI, debiting Cost Clearing and crediting Accrued AP) are absent. |
| **Vendor Credits** | **Partially Met** | Simple manual debit tracking to vendors. Lacks automated workflows to apply credits directly to open PO vouchers or reconcile against bills over-receiving. |
| **Customer Store Credits** | **Partially Met** | Simple transaction mappings inside `store_credit_transactions` exist, but there are no automated mappings to GL liability accounts (`2100`) triggered on retail checkouts. |
| **Gift Card Liabilities** | **Partially Met** | `gift_cards` tables exist. However, the system misses automated liability tracking (`2200`) representing redemption, breakage recognition, and multi-store payout settlements. |
| **Sales Tax Payable** | **Incomplete** | Basic `tax_rules` table, but lacks multi-tier jurisdictional tax matching, county-versus-state tax liabilities tracking, and automated GL posting into Tax Clearing accounts (`2300`). |
| **Inter-Store Transfers** | **Missing** | Inventory movement simply deducts stock at Source Store and adds to Target Store. Does not post matching accounting intercompany entries (Assets in Transit). |
| **Intercompany Accounting** | **Missing** | No "Due To / Due From" double-entry ledger mechanisms for cross-store adjustments or corporate-office payouts. |
| **Audit Trails** | **Partially Met** | Raw logging exists. Needs strict, tamper-evident write-once database audit logs, storing immutable cryptographic ledger histories and pre-versus-post values. |
| **Period Closing Procedures** | **Missing** | Ledgers remain infinitely open. Lacks automated period-locks (monthly, quarterly, annual) and subsequent prevention of retroactive write operations. |
| **Fiscal Year Management** | **Missing** | Hardcoded to default calendar boundaries. System cannot handle custom 4-4-5 cycles or alternate fiscal dates. |
| **Reversing & Recurring Entries**| **Missing** | Lacks background schedulers to process recurring journal entries (e.g., monthly amortization) or automated reversing triggers for period end accruals. |
| **Bank Reconciliation** | **Missing** | Missing clearing interfaces, deposit matching engines, bank-statement parsing services, and cash clearing ledger tools. |
| **Cost of Goods Sold (COGS)** | **Missing** | Dynamic Cost of Goods Sold calculations currently fetch flat costs rather than resolving accurate values through real-time FIFO depletion pipelines during sales. |
| **Inventory Shrinkage** | **Missing** | Physical inventory stock adjustments lack direct automatic link to GL shrinkage expenses (`5020`) categorized by loss reason. |

### 1.3 Required Accounting Services & Workflows
1. **FiscalClosureService:** Runs periodic audit checks, verifies balance sheets, calculates period-end net margins, inserts close adjustments, and updates `period_locks`.
2. **AccrualPostingService:** Intercepts PO Receiving workflow to debit dynamic raw inventory assets and credit Goods Received Not Invoiced (GRNI) accrued liability accounts until invoice verification.
3. **IntercompanySettlementService:** Evaluates inter-store transfers, generates cross-store GL entries, and settles "Due To / Due From" balances.
4. **CogsEngineService:** Resolves actual unit costs using inventory cost-layer queues when checkout completions are committed.

---

## 2. Inventory & QuickBooks POS Synchronization Gap Analysis

Evaluating the application against the robust requirements of complex wholesale/retail multi-store operations (such as QuickBooks POS Multi-Store) reveals several critical areas that must be solved.

### 2.1 Summary of Existing Inventory Structure
* Standard products and size/attribute variations are represented cleanly in `products` and `productVariants`.
* General inventory adjustments and simple stock levels exist inside `inventory` and `inventoryMovements`.
* Multi-store routing exists via separate `stores` and `warehouses` tables.

### 2.2 Advanced Multi-Store Inventory Gaps

```
                         +-----------------------------------+
                         |         Enterprise HQ Core        |
                         |  (Central Inventory Master DB)     |
                         +-----------------+-----------------+
                                           |
                  +------------------------+------------------------+
                  |                                                 |
+-----------------v-----------------+             +-----------------v-----------------+
|         HQ Sync Engine            |             |         HQ Sync Engine            |
+-----------------+-+---------------+             +-----------------+-+---------------+
                  | |                                               | |
                  | |  Replication & Batch Transfers (Store Exc)    | |
                  | |                                               | |
+-----------------v-v---------------+             +-----------------v-v---------------+
|        Branch Store 01            |             |        Branch Store 02            |
| - Local Cost Layers (FIFO)        |             | - Local Cost Layers (FIFO)        |
| - Offsite Workstation DB          |             | - Offsite Workstation DB          |
| - Local Offline State Engine      |             | - Local Offline State Engine      |
+-----------------------------------+             +-----------------------------------+
```

#### 2.2.1 Costing & Valuation Gaps
* **Inventory Cost Layers (FIFO / LIFO):** The database lacks a dedicated cost ledger to track unit costs *by batch purchase*. Currently, if a variant is bought at \$10 on Monday and \$12 on Friday, the system cannot match sales depletions sequentially (FIFO).
* **Weighted Average Costing:** Moving Average Costing requires synchronous recalculation of the average cost on *every inventory increment* (Receiving or Transfers), which cannot be computed dynamically today without a stateful cost engine.

#### 2.2.2 Multistore Logistics Gaps
* **Partial Transfer & PO Receiving:** Current services assume all-or-nothing delivery. The logic lacks robust tracking of remaining backorders, partial quantity approvals, and discrepancy logs.
* **Store-Specific Pricing:** Pricing is stored globally under `product_variants`. Large branch store setups require local price overrides based on geographic operating costs and local store promotions.

#### 2.2.3 Item Matrix & Variant Tracking
* **Item Matrix:** Present in database via parent-child tables. However, the system lacks the matrix grid UI generation, automated parent-sku mapping, and bulk attribute builder tools.
* **Serialized & Lot Tracking:** Missing complete tracking of serial numbers for high-value components or lot batch expirations, causing critical operational gaps in tracking returns.

#### 2.2.4 Offline Queue, Exchange Logs, & Sync Hub
* **Offline Transactions:** The current sync hub captures general schema conflicts but lacks structural queues to log and retry POS checkout events when workstation networks drop.
* **HQ to Store Replication (Store Exchange batches):** Highly resilient distributed multi-instance architecture requires generation of sequential delta files (In-Mail and Out-Mail) containing data modifications (pricing changes, product additions, customer updates). These must run on background schedulers to prevent heavy synchronous API lockouts.

---

## 3. Freezing the Production Database Schema (Physical Data Model)

To guarantee transaction safety, inventory absolute positioning, and financial integrity, this database architecture must be frozen before proceeding.

### 3.1 ERD Entity Relationship Diagram

```
[product_variants] 1 ---- * [inventory_cost_layers] 1 ---- * [inventory_cost_layer_consumptions]
                           *
                           | 1
                    [inventory_movements]

[stores] 1 ---- * [store_prices]
[product_variants] 1 --+ (Composite Key)

[stores] (Source) 1 ---+
                       | ---- * [inventory_transfers] 1 ---- * [inventory_transfer_items]
[stores] (Target) 1 ---+

[stores] 1 ---- * [inventory_counts] 1 ---- * [inventory_count_items]

[companies] 1 ---- * [fiscal_years] 1 ---- * [accounting_periods] 1 ---- * [period_locks]

[stores] (Retailer) 1 ---+
                         | ---- * [intercompany_accounts]
[stores] (Provider) 1 ---+

[stores] 1 ---- * [store_exchange_batches] 1 ---- * [store_exchange_batch_items]
```

### 3.2 Data Definition Dictionary

#### 3.2.1 Table: `inventory_cost_layers`
*Tracks precise inventory cost batches for FIFO and Weighted Average cost tracking.*
* **Columns:**
  * `id` (serial, Primary Key)
  * `company_id` (integer, Foreign Key to `companies.id`, NOT NULL)
  * `store_id` (integer, Foreign Key to `stores.id`, NOT NULL)
  * `variant_id` (integer, Foreign Key to `product_variants.id`, NOT NULL)
  * `received_date` (timestamp, NOT NULL, DEFAULT `now()`)
  * `reference_type` (text, NOT NULL) — e.g. `'receiving'`, `'return'`, `'adjustment'`
  * `reference_id` (integer, NOT NULL) — e.g., references `purchase_orders`
  * `quantity_received` (numeric(12,2), NOT NULL)
  * `quantity_remaining` (numeric(12,2), NOT NULL)
  * `unit_cost` (numeric(12,2), NOT NULL)
  * `created_at` (timestamp, NOT NULL, DEFAULT `now()`)
* **Unique Constraints:** None
* **Indexes:**
  * `idx_cost_layers_lookup`: `(variant_id, store_id, quantity_remaining)` (CRITICAL to quickly identify active layers during FIFO depletions)
  * `idx_cost_layers_date`: `(received_date ASC)`

#### 3.2.2 Table: `inventory_cost_layer_consumptions`
*Tracks which sales transaction consumed which specific cost layers.*
* **Columns:**
  * `id` (serial, Primary Key)
  * `cost_layer_id` (integer, Foreign Key to `inventory_cost_layers.id`, NOT NULL)
  * `sale_item_id` (integer, Foreign Key to `sale_items.id`, NULLABLE)
  * `movement_id` (integer, Foreign Key to `inventory_movements.id`, NOT NULL)
  * `quantity_consumed` (numeric(12,2), NOT NULL)
  * `cogs_posted` (numeric(12,2), NOT NULL) — quantity * layer unit cost
  * `created_at` (timestamp, NOT NULL, DEFAULT `now()`)
* **Indexes:**
  * `idx_layer_consumption_lookup`: `(cost_layer_id)`

#### 3.2.3 Table: `store_prices`
*Manages store-specific pricing overrides.*
* **Columns:**
  * `store_id` (integer, Foreign Key to `stores.id`, NOT NULL)
  * `variant_id` (integer, Foreign Key to `product_variants.id`, NOT NULL)
  * `override_price` (numeric(12,2), NOT NULL)
  * `msrp_override` (numeric(12,2), NULLABLE)
  * `is_promo` (boolean, NOT NULL, DEFAULT `false`)
  * `promo_start` (timestamp, NULLABLE)
  * `promo_end` (timestamp, NULLABLE)
  * `updated_at` (timestamp, NOT NULL, DEFAULT `now()`)
* **Constraints/Key:**
  * PRIMARY KEY `(store_id, variant_id)` (Composite Key)

#### 3.2.4 Table: `inventory_transfers`
*Manages multi-store inventory shipments and transit ledger states.*
* **Columns:**
  * `id` (serial, Primary Key)
  * `transfer_number` (text, UNIQUE, NOT NULL)
  * `source_store_id` (integer, Foreign Key to `stores.id`, NOT NULL)
  * `target_store_id` (integer, Foreign Key to `stores.id`, NOT NULL)
  * `status` (text, NOT NULL) — `'draft'`, `'requested'`, `'shipped'`, `'received'`, `'partially_received'`, `'cancelled'`
  * `carrier` (text)
  * `tracking_number` (text)
  * `ship_date` (timestamp)
  * `receive_date` (timestamp)
  * `notes` (text)
  * `created_by` (integer, Foreign Key to `users.id`, NOT NULL)
  * `created_at` (timestamp, NOT NULL, DEFAULT `now()`)
* **Indexes:**
  * `idx_transfers_source`: `(source_store_id)`
  * `idx_transfers_target`: `(target_store_id)`

#### 3.2.5 Table: `inventory_transfer_items`
*Line entries for physical transfers.*
* **Columns:**
  * `id` (serial, Primary Key)
  * `transfer_id` (integer, Foreign Key to `inventory_transfers.id`, NOT NULL)
  * `variant_id` (integer, Foreign Key to `product_variants.id`, NOT NULL)
  * `qty_requested` (numeric(12,2), NOT NULL)
  * `qty_shipped` (numeric(12,2), NOT NULL)
  * `qty_received` (numeric(12,2), NOT NULL DEFAULT `0.00`)
  * `unit_cost_at_transfer` (numeric(12,2), NOT NULL) — historical valuation lock
* **Indexes:**
  * `idx_transfer_items_lookup`: `(transfer_id, variant_id)`

#### 3.2.6 Table: `inventory_counts`
*Physical stock item inspections (Cycle Counts and Annual Physical Audits).*
* **Columns:**
  * `id` (serial, Primary Key)
  * `store_id` (integer, Foreign Key to `stores.id`, NOT NULL)
  * `type` (text, NOT NULL) — `'full_physical'`, `'cycle_count'`
  * `status` (text, NOT NULL) — `'open'`, `'counting'`, `'reconciliation_pending'`, `'approved_posted'`, `'cancelled'`
  * `start_date` (timestamp, NOT NULL)
  * `post_date` (timestamp)
  * `created_by` (integer, Foreign Key to `users.id`, NOT NULL)
  * `approved_by` (integer, Foreign Key to `users.id`)
  * `created_at` (timestamp, DEFAULT `now()`)
* **Indexes:**
  * `idx_inv_counts_store`: `(store_id)`

#### 3.2.7 Table: `inventory_count_items`
*Discovered versus database values for individual variants.*
* **Columns:**
  * `id` (serial, Primary Key)
  * `inventory_count_id` (integer, Foreign Key to `inventory_counts.id`, NOT NULL)
  * `variant_id` (integer, Foreign Key to `product_variants.id`, NOT NULL)
  * `system_qty` (numeric(12,2), NOT NULL) — system quantity snapshotted at start
  * `counted_qty` (numeric(12,2), NOT NULL DEFAULT `0.00`)
  * `discrepancy_qty` (numeric(12,2), NOT NULL) — `counted_qty - system_qty`
  * `unit_cost` (numeric(12,2), NOT NULL) — dynamic FIFO/Average cost at checkout
  * `reconciled` (boolean, NOT NULL, DEFAULT `false`)

#### 3.2.8 Table: `fiscal_years`
*Defines accounting cycles.*
* **Columns:**
  * `id` (serial, Primary Key)
  * `company_id` (integer, Foreign Key to `companies.id`, NOT NULL)
  * `year_label` (text, NOT NULL) — e.g. `'FY2026'`
  * `start_date` (timestamp, NOT NULL)
  * `end_date` (timestamp, NOT NULL)
  * `status` (text, NOT NULL) — `'active'`, `'closed'`
* **Unique Constraints:** `(company_id, year_label)`

#### 3.2.9 Table: `accounting_periods`
*Discrete business segments (months or custom divisions like 4-4-5 weeks).*
* **Columns:**
  * `id` (serial, Primary Key)
  * `fiscal_year_id` (integer, Foreign Key to `fiscal_years.id`, NOT NULL)
  * `period_number` (integer, NOT NULL) — e.g. `1` to `12`
  * `start_date` (timestamp, NOT NULL)
  * `end_date` (timestamp, NOT NULL)
  * `is_closed` (boolean, NOT NULL, DEFAULT `false`)
  * `closed_at` (timestamp)
  * `closed_by` (integer, Foreign Key to `users.id`)

#### 3.2.10 Table: `intercompany_accounts`
*Due To / Due From registers tracking inter-store credit/debit clearances.*
* **Columns:**
  * `id` (serial, Primary Key)
  * `owning_store_id` (integer, Foreign Key to `stores.id`, NOT NULL) — due to this store
  * `debtor_store_id` (integer, Foreign Key to `stores.id`, NOT NULL) — owed by this store
  * `balance` (numeric(12,2), NOT NULL, DEFAULT `0.00`)
  * `updated_at` (timestamp, NOT NULL, DEFAULT `now()`)
* **Constraints:** `(owning_store_id, debtor_store_id)` (Unique multi-store directional row)

#### 3.2.11 Table: `store_exchange_batches`
*Outbox/Inbox packages executing asynchronous Store Exchange database synchronizations.*
* **Columns:**
  * `id` (serial, Primary Key)
  * `source_store_id` (integer, Foreign Key to `stores.id`, NOT NULL)
  * `target_store_id` (integer, Foreign Key to `stores.id`, NOT NULL) — HQ is represented as Target / Source ID `0`
  * `sequence_number` (integer, NOT NULL)
  * `direction` (text, NOT NULL) — `'outbound_from_store'`, `'inbound_to_store'`
  * `payload` (jsonb, NOT NULL) — delta logs payload
  * `delivered` (boolean, NOT NULL, DEFAULT `false`)
  * `processed` (boolean, NOT NULL, DEFAULT `false`)
  * `processed_at` (timestamp)
  * `created_at` (timestamp, DEFAULT `now()`)
* **Indexes:**
  * `idx_exchange_sequence`: `(source_store_id, target_store_id, sequence_number)`

### 3.3 Database Migrations & Tuning

#### 3.3.1 Migration Sequence Order
1. **Infrastructure foundation:** Create `fiscal_years`, `accounting_periods`.
2. **Pricing & Matrix structures:** Create `store_prices`.
3. **Core FIFO Layering:** Create `inventory_cost_layers`, then `inventory_cost_layer_consumptions`.
4. **Logistical pipelines:** Create `inventory_transfers` and `inventory_transfer_items`.
5. **Counting and auditing:** Create `inventory_counts`, `inventory_count_items`.
6. **Clearing balances:** Create `intercompany_accounts`, `store_exchange_batches`.

#### 3.3.2 Physical Partitioning Strategy
For high-volume retail POS systems, database sizing can expand exponentially.
We recommend a **declarative list partitioning partitioning strategy** on all transactional log tables around `store_id`:
* **General Ledger Entries & Inventory Movements:** Partitioned by `store_id` ranges or list of integers (e.g. `store_id_1`, `store_id_2`). This facilitates clean index caching on individual stores (local POS operations are physically isolated by disk block), making query execution speeds independent of company expansion.
* **Store Exchange Batches:** Partitioned by range using `created_at` matching annual or monthly partitions. Facilitates quick bulk deletion of old processed batches.

#### 3.3.3 Multi-Store Scale Strategy
To scales to thousands of stores with minimal replication overhead, use **Write-Ahead Log (WAL) streaming** for real-time warehouse systems while establishing **Store Exchange Batch Replication** via decoupled `jsonb` payloads for thin-client storefronts.
Every store maintains a cached client-side database. It updates `store_exchange_batches` locally and writes a compressed, sequential delta payload to our API, preventing blocking synchronous transactions from impacting physical lanes.

---

## 4. POS UI/UX Transaction Status Specification

This specification governs the physical construction and transitions of the visual checkout status layout, emphasizing speed, high contrast, and tactile verification checks.

### 4.1 "POS Checkout Success" UI/UX Specification

*The visual design utilizes high physical hierarchy, strong card patterns, and generous padding to deliver clear transaction outcomes.*

#### 4.1.1 Structural Wireframe (Desktop High-Contrast Layout)

```
+--------------------------------------------------------------------------------+
|  [H1] Transaction Complete !                          [STRICT HIGH CONTRAST] |
|  [P] Sale Authorized & Posted to General Ledger        [Store: Branch #04]     |
+--------------------------------------------------------------------------------+
|                                                                                |
|  +-------------------------------------+  +----------------------------------+ |
|  | TRANSACTION RECORD                  |  | CUSTOMER ENGAGEMENT LOGS         | |
|  | ID: #TX-9482103  [Status: SYNCED]   |  | Name: John Doe (VIP Diamond)     | |
|  | Time: 2026-06-16 11:34 UTC          |  | Tier Points Gained: +124 pts     | |
|  +-------------------------------------+  | Store Credit Balance: $42.50     | |
|  | ITEMS PURCHASED                     |  +----------------------------------+ |
|  | - Merino Wool Sock x2    $32.00     |  | INTERNAL SYSTEM ACTIONS          | |
|  | - Windbreaker Jacket x1 $145.00     |  | [Check] FIFO Layers Allocated    | |
|  +-------------------------------------+  | [Check] GL Journal Entry Posted  | |
|  | PAYMENT DETAILS                     |  | [Check] Sync Packet Written      | |
|  | Total Collected: $177.00 (Voucher)  |  +----------------------------------+ |
|  +-------------------------------------+                                       |
|                                                                                |
|  +---------------------------------------------------------------------------+ |
|  |  [BUTTON: F3] Quick Reprint Receipt   [BUTTON: ENTER] Start New Sale (F12)| |
|  +---------------------------------------------------------------------------+ |
+--------------------------------------------------------------------------------+
```

#### 4.1.2 Interface Elements & Visual State Mapping
* **Primary Header Banner:** Full-width bold header showcasing the transaction status. If the POS system is currently operating offline, the banner adapts to a dark state:
  * **Online Paid:** Rich Emerald green background with white display typography.
  * **Offline Safe-Post:** Solid slate gray banner displaying *"Offline Saved to Local Queue"* in high-contrast monospaced font.
* **Double Grid Card Structure:**
  * **Card A (Left Panel):** Core ledger summary details. High-contrast receipt list using monospaced `"JetBrains Mono"` for line lists, prices, and alignment.
  * **Card B (Right Panel):** Store action pipelines and customer engagement balance cards. Dynamic logs detailing exactly what database operations occurred behind the scene (e.g., green indicators verifying COGS calculated, inventory decremented, and cash drawer shifted).
* **Keyboard Navigation Directives:** Highly visible button triggers highlighting keyboard shortcuts (e.g., `[F3]`, `[ENTER]`) to allow physical cashiers to operate the checkout lane rapidly without using a mouse.

---

## 5. Formal Transaction Lifecycle State Machine Model

This state machine serves as the single source of truth for the retail system—mapping user-facing UI statuses to their automated backend accounting movements, cost layers, and synchronizations.

```
       +----------+
       |  Draft   +---------------+
       +----+-----+               |
            |                     |
            | (Collect Payment)   | (Void)
            v                     v
    +-------+-------+       +-----+-----+
    | Pending Pay   |       |  Voided   |
    +-------+-------+       +-----------+
            | (Unpaid balance)    ^
            | (Full payment)      | (Full refund limit)
            v                     |
     +------+------+-------+      |
     | Partially   | Paid  |------+
     |   Paid      +---+---+
     +-------------+   |
                       | (Async push)
                       v
                 +-----+-----+
                 |  Synced   |
                 +-----+-----+
                       | (Audit reconciliation)
                       v
                +------+------+
                | Reconciled  |
                +-------------+
```

### 5.1 State Transitions Table

| Current State | Target State | Triggering Event | Validation Logic | Executed Side-Effects |
| :--- | :--- | :--- | :--- | :--- |
| **None** | **Draft** | Operator starts a new active basket in POS. | Valid active cashier session and store location. | Creates local order ID, locks current prices, and allocates transaction buffer. |
| **Draft** | **Pending Payment** | Operator clicks checkout button in POS UI. | Basket contains at least one variant with quantity > 0. | Syncs item quantities, resolves any custom cart-level discounts, and calculates sales tax. |
| **Pending Payment**| **Paid** | Successful authorization of total price. | Received cash/card balance exact match or higher than due. | Generates checkout completion timestamp, creates receipt record, issues loyalty points. |
| **Pending Payment**| **Partially Paid** | Split partial payment completed in transaction. | Authorized amount > 0 but < total price. | Logs partial ledger balance, registers customer liability tracking. |
| **Pending Payment**| **Voided** | Void trigger pressed before payment completion. | Allowed permissions checks for supervisor auth codes. | Releases temporary pricing locks and discards transaction buffer. |
| **Paid** | **Voided** | Immediate supervisor override release. | Void executed within identical shift closure boundaries. | Discards payment authorization, creates complete reversal entries inside General Ledger, restores cost layer stock balances. |
| **Paid** | **Refunded** | Customer returns product context. | Returns item count matches purchase invoice limit. | Emits refund cash receipt, creates Contra-Revenue general ledger posting. |
| **Paid** | **Synced** | Sync worker process completes pushing records. | Sequential transaction ID successfully inserted into HQ db. | Clears local outbound staging table values, converts UI logs to *Fully Synced*. |
| **Synced** | **Reconciled** | Annual/Monthly physical audit closure runs. | Checked and passed ledger accuracy checks against cash desk balances. | Writes transaction flag index, blocking any subsequent updates permanently. |

### 5.2 Functional Side-Effects & Logic Flow

#### 5.2.1 Real-Time Cost Layer & COGS Calculations
When a sale transitions from **Pending Payment** to **Paid**:
1. The **CogsEngine** performs a lock on `inventory_cost_layers` matching the store location database.
2. It fetches layers matching the product variant using `received_date ASC` (FIFO).
3. If the sale quantity is 5, and the oldest active layer has 3 pieces remaining, the engine consumes those 3 pieces (updating `quantity_remaining = 0`), then consumes 2 pieces from the next oldest layer (updating `quantity_remaining = quantity_remaining - 2`).
4. It logs 2 records inside `inventory_cost_layer_consumptions` mapping calculations directly to the respective sale items.
5. In addition to deducting physical numbers, it automatically generates a double-entry accounting posting:
   * **Debit:** `5010` (Cost of Goods Sold expense)
   * **Credit:** `1300` (Inventory Asset)

#### 5.2.2 Unified General Ledger Integrations

* **POS Checkout Completes (Paid):**
  * **Debit:** `1010` (Cash inside cash drawers) or `1200` (Accounts Receivable)
  * **Credit:** `4010` (Sales Revenue)
  * **Credit:** `2300` (Sales Tax collected on behalf of state tax rules)
* **Redeeming Gift Cards:**
  * **Debit:** `2200` (Gift Card Liability)
  * **Credit:** `4010` (Sales Revenue)
* **Issuing Store Credits:**
  * **Debit:** `4020` (Sales Returns - contra revenue)
  * **Credit:** `2100` (Store Credit Liability)

### 5.3 Workstation Offline Replication & Conflict Priority Rules

When standard retail network environments fail, the workstation transitions to **Decoupled POS Mode**:
1. It records transactions inside a local indexed store queue, flagging state as **Paid [Offline Queue]**.
2. When connectivity is restored, the **OnlineSyncWorker** flushes transactions to the HQ database sequentially based on receipt number timestamps.
3. If an inventory conflict occurs (e.g., both branch 1 and branch 2 sold the last piece of a physical variant simultaneously offline):
   * **Conflict Handling Priority:** *FIFO cost layers hold branch transaction priority*. The database updates the inventory ledger balance as a **negative inventory count**.
   * **Automated Sync Intervention:** It generates an offline conflict record inside `offline_sync_conflicts`, sending a push notification alert flag to store managers to trigger a rapid stock recount.

---

## 6. Recommended Stage-by-Stage Implementation Roadmap

To develop this massive system safely, we establish a dependency-ordered, business-critical implementation pipeline.

```
+--------------------------------------------------------+
|                      STAGE 1:                          |
|  Accrual Ledger, Core Cost Layers, and Store override  |
+---------------------------+----------------------------+
                            |
                            v
+--------------------------------------------------------+
|                      STAGE 2:                          |
|  LOGISTICS: Transfers, counts, and shrinkage tracking  |
+---------------------------+----------------------------+
                            |
                            v
+--------------------------------------------------------+
|                      STAGE 3:                          |
|  DISTRIBUTED SYNC: Queue pipeline & Store Exchange DB   |
+---------------------------+----------------------------+
                            |
                            v
+--------------------------------------------------------+
|                      STAGE 4:                          |
|  ENTERPRISE CLOSING: Fiscal Years & Period Locking     |
+--------------------------------------------------------+
```

### Stage 1: Accrual Ledger & Cost Layer Baseline (Business Criticality - HIGH)
* **Goal:** Establish the financial data baseline. Dynamic calculations must represent true unit cost values before complex sync engines launch.
* **Dependencies:** None.
* **Components to Build:**
  * DB Tables: `inventory_cost_layers`, `inventory_cost_layer_consumptions`, `store_prices`.
  * Services: `CogsEngineService`, `PricingService`.
  * API Interfaces: Add route override `/accounting/cogs-calculation`.

### Stage 2: Multistore Logistics and Verification Auditing (Business Criticality - MEDIUM)
* **Goal:** Enable store-to-store logistics movements, handling partial shipments, physical damage losses, and cycle counts.
* **Dependencies:** Stage 1 must be active to track layer movements correctly across stores.
* **Components to Build:**
  * DB Tables: `inventory_transfers`, `inventory_transfer_items`, `inventory_counts`, `inventory_count_items`.
  * Services: `LogisticsTransferService`, `InventoryAuditService`.
  * API Interfaces: `/transfers/process-shipment`, `/inventory-counts/post-count`.

### Stage 3: Decoupled Replication & Store Exchange Sync Hub (Business Criticality - HIGH)
* **Goal:** Establish zero-latency robust retail operations. This isolates store lanes from cloud failures or HQ network outages.
* **Dependencies:** Stage 1 and Stage 2 schemas must be complete so replication payloads can bundle full transaction sets.
* **Components to Build:**
  * DB Tables: `store_exchange_batches`, `intercompany_accounts`.
  * Services: `OfflineSyncWorkerService`, `StoreExchangeEngine`.
  * API Interfaces: `/sync/exchange-envelope/upload`, `/sync/exchange-envelope/download`.

### Stage 4: Period Closures & Fiscal Schedulers (Business Criticality - MEDIUM)
* **Goal:** Enforce calendar period closures to guarantee past ledgers remain immutable and meet audit-readiness standards.
* **Dependencies:** Stage 1 and Stage 3 must be complete to ensure all historical entries have been synchronized before lockouts are pushed.
* **Components to Build:**
  * DB Tables: `fiscal_years`, `accounting_periods`.
  * Services: `FiscalClosureService`, `AuditLedgerService`.
  * API Interfaces: `/accounting/period-lock/close`, `/accounting/fiscal-year/initialize`.
