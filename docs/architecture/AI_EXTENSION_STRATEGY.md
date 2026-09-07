# AI Extension Strategy

Date: August 20, 2026

## Current State

The current system does not implement a real AI or recommendation subsystem. The visible recommendation page is placeholder-only, and no dedicated backend AI module or persisted AI outputs were verified in the codebase.

This strategy therefore describes the most natural extension path based on the current architecture.

## Existing Foundations That Can Be Reused

The current system already provides useful data foundations for future AI or rules-assisted recommendations:

- `InventoryTransaction` and `InventoryTransactionLine` for real consumption history
- `Order` and `OrderItem` for sales history
- `StockBatch` and `RawMaterialInventorySummary` for current stock state
- `InventoryDailySnapshot` for historical inventory state
- `StockoutEvent` for stock risk and service disruption history
- `VariantAvailabilityEvent` for sellability history
- `Supplier` for procurement source metadata

## Recommended Future Architecture

Recommended high-level flow:

Database -> Data processing layer -> AI or recommendation service -> Recommendation engine -> Backend API -> Frontend

## Extension Points

### 1. Data Processing Layer

Best insertion point:

- a dedicated backend data-preparation layer, not the frontend

Responsibilities:

- build daily demand observations
- normalize historical usage
- combine inventory state with sales and availability history
- expose prediction-ready datasets

### 2. AI / Recommendation Service

Best insertion point:

- a new bounded backend capability rather than logic embedded directly inside reports or inventory modules

Responsibilities:

- forecasting inputs
- recommendation scoring
- supplier ranking logic
- confidence or rationale generation

### 3. Recommendation API Layer

Best insertion point:

- a dedicated backend controller/service pair for recommendation outputs

Responsibilities:

- return recommendation summaries
- return item-level forecast context
- return suggested restock actions
- expose explanations suitable for admin UI

### 4. Frontend Consumption Layer

Best insertion point:

- the existing admin recommendations route

Responsibilities:

- present recommendation results
- present forecast confidence
- present suggested restock actions
- present supplier ranking or sourcing hints

## Future AI Use Cases

### Demand Forecasting

Potential purpose:

- estimate future raw-material consumption over 7, 30, and 90 day horizons

Existing data support:

- checkout-linked inventory usage
- completed orders
- daily inventory snapshots

Current missing pieces:

- canonical daily demand observation layer
- stored forecast runs and outputs
- evaluation and accuracy tracking

### Restocking Recommendations

Potential purpose:

- suggest what should be replenished and when

Existing data support:

- current inventory summaries
- stock batches and expiration data
- supplier records
- historical usage and stockout signals

Current missing pieces:

- procurement policy configuration
- lead-time aware calculation
- recommendation persistence

### Supplier Ranking

Potential purpose:

- rank supplier candidates by cost, reliability, distance, and historical suitability

Existing data support:

- supplier master data
- stock-run and batch relationships
- inventory outcomes

Current missing pieces:

- explicit supplier performance metrics
- distance service
- ranking policy layer

## Architectural Guidance

### What not to do

- do not place AI logic directly in frontend pages
- do not overload the reports module with forecasting orchestration
- do not mix raw operational writes with recommendation outputs in the same tables

### What to do

- keep backend as source of truth
- create separate data-preparation, recommendation, and API layers
- persist outputs if the product needs explainability, auditability, or evaluation
- reuse existing reporting-history foundations as the basis for model-ready features

## Recommended Delivery Path

### Phase A: AI preparation

- standardize daily demand observations
- define forecast-ready datasets
- establish evaluation requirements

### Phase B: rule-assisted recommendations

- ship deterministic reorder suggestions before heavier predictive logic

### Phase C: predictive AI

- add forecast outputs and confidence scoring
- compare predicted vs actual outcomes

## Conclusion

The system already has strong data foundations for future AI work, especially around inventory usage, order history, and reporting snapshots. The right extension path is to add AI as a new bounded backend capability built on persisted operational history, not as a thin frontend feature.
