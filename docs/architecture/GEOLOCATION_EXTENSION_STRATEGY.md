# Geolocation Extension Strategy

Date: August 20, 2026

## Current State

Geolocation is only partially represented in the current system.

What exists today:

- supplier latitude and longitude fields in the schema
- supplier-related UI and DTO support for coordinate capture
- recommendation-oriented UI language that references distance

What does not exist today:

- dedicated geolocation backend service
- map integration
- real distance computation workflow
- route-aware supplier recommendation logic

## Recommended Future Architecture

Recommended flow:

Supplier data -> Location service -> Distance calculation -> Recommendation engine -> Map visualization

## Extension Points

### 1. Supplier Data Layer

Existing foundation:

- `Supplier.latitude`
- `Supplier.longitude`
- supplier master records

Needed improvements later:

- validation and completeness rules for coordinates
- optional address normalization
- preferred sourcing metadata if recommendations become procurement-aware

### 2. Location Service

Recommended insertion point:

- dedicated backend geolocation service, separate from inventory CRUD

Responsibilities:

- normalize supplier location data
- resolve store location context
- prepare coordinates for distance evaluation

### 3. Distance Calculation Layer

Recommended insertion point:

- backend utility or domain service consumed by recommendation logic

Responsibilities:

- straight-line distance
- optionally route-aware distance/travel time in a later phase
- deterministic ranking support

### 4. Recommendation Integration

Recommended insertion point:

- future recommendation engine, not supplier CRUD

Responsibilities:

- blend proximity with cost, stock availability, and lead time
- support supplier ranking for restock suggestions

### 5. Frontend Visualization

Recommended insertion point:

- admin recommendations page
- optional supplier-management detail surfaces

Responsibilities:

- show ranked suppliers
- show distance or travel bands
- optionally show map-based context in later phases

## Architectural Guidance

### Keep geolocation separate from CRUD

Supplier CRUD should remain focused on supplier management. Location intelligence should live in a separate service boundary.

### Keep backend authoritative

Distance calculations and supplier ranking should be produced in backend logic, not recomputed independently in the frontend.

### Start simple

The first meaningful delivery can use deterministic distance scoring without requiring a full map experience.

## Suggested Implementation Path

### Phase 1: Data readiness

- validate supplier coordinates
- define canonical store location source

### Phase 2: Deterministic distance support

- calculate supplier-to-store distance
- expose distance in recommendation responses

### Phase 3: Recommendation blending

- combine distance with inventory need and supplier suitability

### Phase 4: Visualization

- add map or visual location context if the product actually needs it

## Key Risks

- incomplete coordinate coverage
- unclear store-origin location rules
- overbuilding map UX before recommendation logic exists
- coupling distance logic too tightly to existing inventory CRUD flows

## Conclusion

The codebase has a valid starting point for geolocation because supplier coordinates already exist. However, geolocation is not yet an implemented capability. The most maintainable path is to add a separate location service and use it as an input into future recommendation logic.
