# System Component Map

Date: August 20, 2026

## Overview

This map summarizes the major system components across frontend, backend, and database domains. Status values are:

- `Implemented`
- `Partially Implemented`
- `Transitional`
- `Roadmap`

## Frontend Components

| Component | Purpose | Responsibilities | Dependencies | Status |
|---|---|---|---|---|
| Authentication | User access and session bootstrapping | login, logout, current user, password reset flows, guarded navigation | backend auth endpoints, auth store, API client | Implemented |
| Dashboard | Role-oriented landing surfaces | admin overview, staff overview, navigation entry points | auth state, admin layout, staff layout | Implemented |
| Inventory | Material and supplier operations | raw materials, supplier management, stock runs, adjustments, waste, batch views | inventory APIs, stock-run APIs, reports, alerts context | Implemented |
| Products | Product, variant, and recipe administration | product list/detail, availability summary, variant editing, recipe editor, delete eligibility, ingredient usage | admin product APIs, recipe APIs, usage APIs | Implemented |
| Reports | Inventory and POS analytics workspace | report filters, KPI display, charts, exports, POS/inventory report sections | reports APIs, export helpers, date-range helpers | Implemented |
| Alerts | Inventory-related operational notifications | list, filter, acknowledge, dismiss | alert APIs | Implemented |
| POS | Staff checkout and transaction handling | menu browsing, product configuration, payment flow, receipts, reversals UI | catalog APIs, checkout API, orders API | Implemented |
| Recommendations | Future recommendation and geolocation surface | placeholder page for AI-driven recommendations and location-aware flows | none beyond layout | Roadmap |

## Backend Components

| Component | Purpose | Responsibilities | Dependencies | Status |
|---|---|---|---|---|
| Auth | Session-based authentication and recovery | login, logout, me, forgot/reset password, session issuance and revocation | Prisma, env config, session service, password service | Implemented |
| Users | User listing and user-related admin access | user retrieval and mapping | Prisma, auth guards | Implemented |
| Catalog | Product and variant domain | public catalog, admin product management, archive/restore, delete eligibility, ingredient usage | Prisma, recipes, availability, orders, inventory data | Implemented |
| Recipes | Recipe resolution and validation | recipe linkage, modifier adjustment handling, recipe-based dependencies | Prisma, catalog, inventory units/materials | Implemented |
| Inventory | Material stock domain | raw materials, suppliers, ledger writes, summaries, FEFO allocation, waste and adjustments | Prisma, stock runs, availability, alerts | Implemented |
| Stock Runs | Receiving and inbound stock operations | stock-run drafts, posting, stock-run items, inbound valuation | inventory services, suppliers, raw materials | Implemented |
| Orders | POS and order lifecycle | checkout, pricing, payments, refunds, voids, order retrieval | catalog, inventory ledger, auth, Prisma | Implemented |
| Availability | Sellability and stock risk state | availability summaries, stockout events, current-summary repair, state history | inventory summaries, recipes, product variants | Implemented |
| Events | Internal outbox/event processing | outbox persistence, polling, consumer registry | Prisma, background-job gating | Implemented |
| Reports | POS and inventory reporting | KPI queries, linked consumption, sales analytics, reporting filters | snapshots, events, orders, inventory ledger | Implemented |
| Alerts | Operational alert management | low stock, expiry, reevaluation, user-visible alert lifecycle | inventory summaries, stock batches, suppliers, outbox | Implemented |
| AI Services | Recommendation or prediction engine | forecasting, recommendation scoring, supplier ranking | not present | Roadmap |
| Geolocation Services | Location and distance intelligence | supplier distance, location scoring, route-aware recommendations | not present | Roadmap |

## Database Domains

| Domain | Purpose | Responsibilities | Dependencies | Status |
|---|---|---|---|---|
| Identity | Users and sessions | user records, auth sessions, reset and verification tokens | auth module | Implemented |
| Catalog | Products and sellable structure | categories, products, variants, modifiers | catalog and recipes modules | Implemented |
| Inventory | Material stock and movement | units, raw materials, suppliers, stock batches, stock runs, transactions, summaries | inventory and stock-runs modules | Implemented |
| Sales | Order lifecycle and monetary flow | orders, order items, payments, reversals | orders module | Implemented |
| Reporting | Analytical history and operational alerts | snapshots, summaries, availability events, stockout events, alerts, outbox | reports, alerts, availability, events | Implemented |

## Component Relationship Summary

### Frontend to backend

- auth pages consume `/auth/*`
- admin inventory consumes inventory, stock-run, supplier, and report endpoints
- admin products consumes admin product, recipe, and usage endpoints
- staff POS consumes product/menu and checkout/order endpoints
- report workspaces consume `/reports/*`

### Backend to database

- auth depends on identity tables
- catalog depends on catalog tables and recipe relationships
- inventory depends on inventory tables and transaction ledger
- orders depend on sales tables and inventory ledger
- availability depends on summaries and history tables
- reports depend on sales, inventory, summaries, snapshots, and events

## Current System Shape

The current architecture is operationally centered on:

- backend domain services
- PostgreSQL persistence through Prisma
- frontend admin and staff workflows

The components least implemented today are the roadmap-facing recommendation and geolocation surfaces.
