# Architecture Review

Date: August 20, 2026
Repository: `C:\Users\Deej\Desktop\capstoneIMS\inventory-management-system`
Observed branch: `main`

## Scope

This document reflects the current architecture visible in the repository after the role-model consolidation work that removed `SYSTEM_ADMINISTRATOR` from the active role model. It is an analysis artifact only. No source behavior was changed as part of this review.

Important current-state note:

- the repository was not fully clean during the review
- there are active in-progress changes related to role consolidation and test runner scripts
- this blueprint therefore describes the current implementation state, not a fully frozen release baseline

## System Overview

The project is a full-stack Cafe Inventory Management System with POS, inventory tracking, product and recipe management, alerting, and reporting. The architecture is backend-authoritative and domain-oriented.

The clearest implemented business capabilities are:

- user authentication and session management
- product and variant administration
- recipe and ingredient linkage
- raw-material and supplier management
- stock runs and stock-batch tracking
- inventory ledger and summaries
- POS checkout and order lifecycle handling
- availability calculation and history tracking
- alert generation and reevaluation
- reporting built on snapshots, summaries, and event history

The system also includes roadmap-facing UI for AI recommendations and geolocation, but those features are not yet implemented as real backend subsystems.

## Technology Stack

### Frontend

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Zustand

### Backend

- NestJS
- Prisma
- PostgreSQL
- Passport-based session auth
- class-validator and class-transformer

### Testing and Tooling

- Jest unit tests
- Jest e2e tests
- Prisma CLI
- ESLint

## Frontend Architecture

The frontend is organized around route-driven admin and staff workflows.

### Primary route areas

- `/login`
- `/forgot-password`
- `/reset-password`
- `/admin/*`
- `/staff/*`

### Key frontend application domains

- authentication bootstrapping and route protection
- admin dashboard
- inventory administration
- product administration
- reports
- alerts
- staff POS

### Architectural characteristics

- shared API access through centralized helpers
- auth state managed with Zustand
- route protection handled through a shared auth guard
- domain-oriented component organization under `components/admin`, `components/inventory`, and `components/staff-pos`

## Backend Architecture

The backend is modular and clearly organized by business domain. Verified modules in the Nest application are:

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

### Architectural pattern

The implementation follows a layered backend shape:

Frontend -> HTTP controllers -> services / business logic -> Prisma -> PostgreSQL

Cross-cutting concerns include:

- auth guards
- role-based authorization
- environment validation
- common Manila-date utilities
- outbox/event processing

## Database Architecture

The schema is one of the strongest architectural layers in the project. It is normalized by business domain and stores real operational state rather than relying on frontend approximation.

### Major schema domains

- Identity: users, sessions, password reset, email verification
- Catalog: categories, products, variants, modifiers
- Inventory: raw materials, units, suppliers, stock runs, stock batches, inventory transactions
- Recipes: variant recipe items, modifier recipe adjustments
- Sales: orders, items, payments, reversals
- Availability and reporting: summaries, events, snapshots, alerts, outbox events

### Architectural strengths

- strong support for auditability through transaction and event records
- real history support for reporting
- explicit separation of current summaries from event history
- operationally meaningful ledger design for inventory use and order attribution

## External Services

The current codebase does not show heavy use of third-party external services beyond:

- PostgreSQL as the primary database
- standard web browser client/server interaction
- environment-driven configuration

There is no verified dedicated external AI provider integration or map/geolocation provider integration in the current implementation.

## End-to-End Flow

### Business flow shape

Frontend -> Backend API -> Domain service logic -> Prisma data access -> PostgreSQL

Examples:

- Auth: login page -> `/auth/login` -> auth service -> session persistence
- POS: staff POS UI -> checkout endpoint -> order pricing and inventory ledger -> orders/payments/inventory tables
- Inventory: admin inventory UI -> inventory and stock-run endpoints -> stock and summary services -> stock batches and summaries
- Reports: admin reports UI -> reports endpoints -> reporting service -> snapshots, summaries, events, and transactional data

## Current Architectural Maturity

### Strong areas

- backend modularity
- schema depth
- operational data modeling
- POS and inventory linkage
- reporting foundations

### Transitional areas

- role-model consolidation is still present in the working tree
- recommendation UX overstates currently implemented backend capability
- geolocation exists only as data fields and placeholder UX
- deployment architecture is not strongly documented in-repo

## Architectural Conclusion

This system is past the prototype stage in its core domains. Inventory, catalog, auth, POS, alerts, and reporting foundations are substantial and backend-authoritative. The architecture is best described as:

- strong in core business operations
- partially mature in analytics and history
- not yet complete in AI and geolocation ambitions
- currently undergoing authorization-structure stabilization
