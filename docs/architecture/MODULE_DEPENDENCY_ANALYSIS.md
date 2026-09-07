# Module Dependency Analysis

Date: August 20, 2026

## Overview

The backend is organized as a NestJS modular monolith. Dependencies are domain-oriented, with Prisma acting as the common persistence layer and auth/config utilities acting as shared infrastructure.

## Root Application Composition

The root application imports:

- `PrismaModule`
- `UsersModule`
- `AuthModule`
- `CatalogModule`
- `RecipesModule`
- `InventoryModule`
- `StockRunsModule`
- `OrdersModule`
- `AvailabilityModule`
- `EventsModule`
- `ReportsModule`
- `AlertsModule`

## Dependency Map by Module

### PrismaModule

Purpose:

- shared database access

Dependents:

- effectively all business modules

Assessment:

- foundational shared infrastructure

### AuthModule

Depends on:

- Prisma
- environment configuration

Used by:

- controllers guarded with session and role protection across the application

Assessment:

- cross-cutting foundational module

### UsersModule

Depends on:

- Prisma
- auth access control

Assessment:

- narrow domain module with low complexity

### CatalogModule

Depends on:

- Prisma
- auth/roles
- recipe relationships
- availability and order/inventory data for delete-eligibility and usage features

Assessment:

- central admin domain module

### RecipesModule

Depends on:

- Prisma
- catalog structure
- raw materials and modifiers

Assessment:

- domain-support module tightly coupled to catalog and inventory semantics

### InventoryModule

Depends on:

- Prisma
- common date utilities
- FEFO allocation logic
- stock summary logic

Assessment:

- one of the most central and complex modules

### StockRunsModule

Depends on:

- Prisma
- inventory domain
- suppliers and raw materials

Assessment:

- inbound stock workflow module layered on inventory

### OrdersModule

Depends on:

- Prisma
- catalog pricing data
- recipe and inventory usage logic
- inventory ledger
- auth

Assessment:

- highly integrated transactional module

### AvailabilityModule

Depends on:

- Prisma
- inventory summaries
- variant recipes
- product/variant state

Assessment:

- derived-state module built on inventory and catalog data

### EventsModule

Depends on:

- Prisma
- background job execution

Assessment:

- infrastructure-support module for asynchronous processing

### ReportsModule

Depends on:

- Prisma
- transactional sales data
- inventory ledger
- summaries
- snapshots
- availability and stockout history
- date utilities

Assessment:

- aggregate-query module with broad read dependencies

### AlertsModule

Depends on:

- Prisma
- inventory summaries
- stock batches
- suppliers
- background reevaluation logic
- outbox/event support

Assessment:

- operational monitoring module with recurring background behavior

## Architectural Dependency Patterns

### Strong patterns

- central shared persistence through Prisma
- domain boundaries are mostly clear
- orders, inventory, and reporting are linked through explicit operational records

### High-coupling areas

- inventory is a high-coupling domain because it influences orders, availability, alerts, and reports
- catalog and recipes are closely coupled for ingredient usage and sellability
- reports depend on many modules conceptually, though primarily through shared persisted data

## Frontend Dependency Patterns

### Shared frontend dependencies

- API client helpers
- auth store
- shared layouts
- report date and export helpers

### High-dependency frontend areas

- products workspace
- inventory workspace
- reports workspaces
- staff POS

These areas aggregate many UI components and multiple backend endpoints.

## Dependency Risks

### Current risks

- inventory domain complexity makes it a hotspot for regressions
- reports rely on consistent date handling and persisted history behavior
- auth and role changes ripple across frontend routing, backend guards, and tests

### Architectural debt

- no dedicated boundary yet for AI or recommendation orchestration
- no dedicated location-service boundary yet for geolocation
- deployment/runtime topology is not strongly encoded in the repository

## Conclusion

The system’s dependency structure is generally healthy for a modular monolith. The central architectural gravity is:

- inventory
- orders
- catalog/recipes
- reporting

Future work should preserve this modular shape by adding AI and geolocation as separate bounded capabilities rather than embedding them directly into already central modules.
