# Database Domain Model

Date: August 20, 2026

## Overview

The database is organized around operational domains rather than generic shared tables. This improves traceability and supports backend-authoritative behavior.

## 1. Identity Domain

### Core models

- `User`
- `AuthSession`
- `PasswordResetToken`
- `EmailVerificationToken`

### Purpose

The identity domain supports:

- authenticated access
- role-based authorization
- session persistence
- password reset and verification flows

### Notes

- current role model observed in schema: `ADMINISTRATOR`, `STAFF`
- this reflects the post-consolidation state currently visible in the working tree

## 2. Catalog Domain

### Core models

- `Category`
- `Product`
- `ProductVariant`
- `ModifierGroup`
- `Modifier`
- `ProductModifierGroup`

### Purpose

The catalog domain defines the sellable structure used by both admin management and staff POS.

### Responsibilities

- product grouping and categorization
- product enable/archive state
- variant-level SKU and pricing
- modifier groups and modifier pricing logic

## 3. Recipe Domain

### Core models

- `VariantRecipeItem`
- `ModifierRecipeAdjustment`

### Purpose

The recipe domain links sellable variants and modifiers to raw-material consumption.

### Responsibilities

- base recipe definitions per variant
- modifier-driven ingredient deltas
- support for historical inventory attribution during checkout

## 4. Inventory Domain

### Core models

- `Unit`
- `RawMaterial`
- `Supplier`
- `StockRun`
- `StockRunItem`
- `StockBatch`
- `InventoryTransaction`
- `InventoryTransactionLine`
- `RawMaterialInventorySummary`

### Purpose

This is the core operational inventory domain.

### Responsibilities

- raw-material master records
- supplier records
- receiving and inbound stock tracking
- batch-level expiration and cost data
- ledger-style movement tracking
- current inventory summaries

### Architectural importance

This domain is the main source of truth for:

- stock on hand
- stock usage
- cost of goods consumed
- waste and adjustment history

## 5. Sales Domain

### Core models

- `Order`
- `OrderItem`
- `OrderItemModifier`
- `OrderPayment`
- `OrderReversal`

### Purpose

The sales domain stores completed POS transactions and their financial and inventory consequences.

### Responsibilities

- completed sales
- order line attribution to variants
- modifier attribution
- payment capture
- void/refund history

### Architectural importance

This domain connects directly to:

- POS workflows
- inventory consumption
- financial reporting
- order-level reversal handling

## 6. Availability Domain

### Core models

- `VariantAvailabilitySummary`
- `VariantAvailabilityEvent`
- `StockoutEvent`

### Purpose

This domain represents both current sellability state and historical availability disruption.

### Responsibilities

- current sellable/in-stock state
- blocking-reason tracking
- event history for availability transitions
- stockout history for materials and variants

## 7. Reporting Domain

### Core models

- `InventoryDailySnapshot`
- `RawMaterialInventorySummary`
- `VariantAvailabilitySummary`
- `VariantAvailabilityEvent`
- `StockoutEvent`

### Purpose

The reporting domain is built from persisted summaries, snapshots, and event records rather than frontend-derived calculations.

### Responsibilities

- daily inventory state capture
- historical availability analysis
- stockout analysis
- support for KPI and trend reporting

## 8. Alerting and Integration Domain

### Core models

- `Alert`
- `OutboxEvent`

### Purpose

This domain supports operational awareness and deferred internal event processing.

### Responsibilities

- low stock and expiry alert lifecycle
- alert acknowledgment and dismissal
- outbox-driven asynchronous processing

## Domain Relationships

### Identity -> Sales / Inventory / Alerts

Users are linked to:

- created orders
- created stock runs
- inventory transactions
- order reversals
- alert acknowledgments and dismissals

### Catalog -> Recipes -> Inventory

Products and variants connect to recipes, which connect to raw materials, which in turn connect to stock and transaction history.

### Sales -> Inventory

Orders and order items connect to inventory transaction lines, making historical consumption attributable to variants and order items.

### Inventory -> Availability -> Reporting

Inventory state feeds:

- availability summaries
- stockout events
- daily snapshots
- alerts
- analytical reporting

## Architectural Assessment

The schema is well suited for:

- backend-authoritative inventory and sales operations
- explainable reporting
- event-based availability analysis
- future forecasting preparation

The schema is not yet extended for:

- persisted AI recommendation outputs
- dedicated forecast runs/results
- geospatial distance computation or route intelligence
