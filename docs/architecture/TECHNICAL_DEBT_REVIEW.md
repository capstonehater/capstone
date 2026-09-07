# Technical Debt Review

Date: August 20, 2026

## Classification Scale

- Critical
- High
- Medium
- Low

## 1. Architecture Debt

### In-progress role-consolidation state

Severity: High

Observed issue:

- the repository was not in a clean baseline state during review
- schema, controllers, frontend auth-related files, tests, and migration artifacts show active consolidation work

Risk:

- architecture documentation and implementation can drift while the role transition is unfinished

Recommendation:

- complete and stabilize role consolidation before treating the current codebase as a release baseline

### Roadmap UX exceeds implemented backend capability

Severity: High

Observed issue:

- the recommendations surface exists in the frontend, but the backend AI subsystem does not
- geolocation is implied in UX, but not implemented architecturally

Risk:

- product expectations can outpace real behavior

Recommendation:

- either implement bounded backend support or clearly label these areas as future work

## 2. Code Debt

### Centrality of inventory domain complexity

Severity: Medium

Observed issue:

- inventory is a hotspot dependency for stock runs, availability, alerts, orders, and reports

Risk:

- changes in inventory behavior can create broad regression risk

Recommendation:

- preserve clear service boundaries and continue validating cross-domain behavior with tests

### Auth-guard frontend hydration complexity

Severity: Medium

Observed issue:

- frontend route protection is functional, but auth bootstrap and hydration patterns appear more complex than ideal

Risk:

- client-side redirect timing and hydration edge cases

Recommendation:

- revisit only after the current role transition is complete

## 3. Repository Debt

### SQL dump and backup artifacts in the repo workspace

Severity: High

Observed issue:

- the repository contains multiple SQL dump or backup-style files in the backend workspace

Risk:

- clutter, confusion, accidental misuse, and lower confidence in source-of-truth boundaries

Recommendation:

- move archival operational artifacts out of the main source tree or document their purpose clearly

### Heavy operational report history at repository root

Severity: Medium

Observed issue:

- many audit, repair, and execution reports are stored at the repository root

Risk:

- noise and reduced navigability

Recommendation:

- introduce a structured docs/archive layout if these reports are meant to be preserved long term

## 4. Documentation Debt

### Missing formal architecture blueprint until now

Severity: Medium

Observed issue:

- the system has strong implementation depth but limited architecture-blueprint style documentation

Risk:

- onboarding and future planning are harder than necessary

Recommendation:

- maintain the `docs/architecture` set as a living blueprint

### Limited visible deployment architecture documentation

Severity: Medium

Observed issue:

- deployment/runtime topology is not strongly expressed in the repository

Risk:

- operational setup becomes person-dependent

Recommendation:

- add environment, deployment, and runtime topology documentation in a later documentation pass

## 5. Feature-Architecture Debt

### No AI bounded context yet

Severity: Medium

Observed issue:

- future AI concepts exist without a dedicated architectural boundary

Risk:

- future implementation may leak into reports, inventory, or frontend pages in an ad hoc way

Recommendation:

- create a separate recommendation/forecasting capability when implementation begins

### No geolocation bounded context yet

Severity: Medium

Observed issue:

- supplier coordinates exist without a location-service architecture

Risk:

- future location logic may become scattered across inventory and UI code

Recommendation:

- introduce a dedicated geolocation or location-intelligence service when the feature becomes real

## Summary by Severity

### Critical

- none conclusively identified from this review

### High

- unfinished role-consolidation baseline
- roadmap UX exceeding implemented backend capability
- repository dump/backup clutter

### Medium

- inventory-domain centrality risk
- auth-guard frontend complexity
- operational-report clutter at repo root
- missing formal architecture and deployment documentation
- missing AI/geolocation bounded contexts

### Low

- none singled out independently in this pass

## Conclusion

The technical debt profile is not dominated by weak core business logic. Instead, it is dominated by:

- transition-state debt
- documentation debt
- repository hygiene debt
- roadmap-to-implementation mismatch

That is a healthier debt profile than having broken fundamentals, but it still needs cleanup before larger future feature work.
