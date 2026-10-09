# Questionnaire Design Context

## 1. Evaluation Objective

Prepare a defensible blueprint for future evaluation instruments for the Café Salvacion Inventory Management System (IMS). It links implemented features to ISO characteristics, observable or technically assessable evidence, qualified respondents and candidate constructs. It contains no questionnaire items, does not claim ISO conformance, and does not rate product quality.

Repository evidence supports a browser-based café inventory/POS application for authenticated staff and administrative users. It does not establish café customers as direct users. The formal problem statement, deployment, respondent population, active permissions and operating procedures remain to be confirmed.

## 2. ISO/IEC 25010:2011 Framework Scope

This blueprint explicitly follows **ISO/IEC 25010:2011** and its eight product-quality characteristics/subcharacteristics. It does not mix in ISO/IEC 25010:2023. ISO lists the 2011 edition as withdrawn and publishes a 2023 product-quality model; researchers should cite the edition required by their protocol. [ISO/IEC 25010:2011](https://www.iso.org/obp/ui/?_escaped_fragment_=iso%3Astd%3Aiso-iec%3A25010%3Aed-1%3Av1%3Aen), [ISO/IEC 25010:2023](https://www.iso.org/standard/78176.html)

The characteristics are Functional Suitability, Performance Efficiency, Compatibility, Usability, Reliability, Security, Maintainability and Portability. No respondent needs to evaluate all eight. Evidence comes from `SYSTEM_EVALUATION_CONTEXT.md`, `ISO25010_EVALUATION_MAPPING.md` and current code, including `ims-backend/src/orders/orders.controller.ts`, `ims-backend/src/roles/roles.controller.ts`, `ims-backend/src/forecasting/forecasting.controller.ts` and `ims-frontend/src/lib/pos-offline.ts`. Code demonstrates scope, not quality in operation.

## 3. Respondent Definition Validation

The research team must confirm what “clients” means: (1) café customers; (2) system operators; (3) organization representatives; (4) project clients/stakeholders; or (5) another group. The repository does not show a customer-facing ordering interface; it shows authenticated operators. Do not recruit café customers as IMS users unless direct system interaction is confirmed.

## 4. Proposed Respondent Groups

These are plausible groups, not confirmed participants. The enum roles are `ADMINISTRATOR`, `MANAGER` and `STAFF`; effective access also depends on database-backed access roles and permissions. Confirm live grants and actual job tasks.

| Respondent Group | Relationship to System | Modules Used | Typical Tasks | Applicable ISO Characteristics | Excluded Characteristics |
|---|---|---|---|---|---|
| Café staff/cashier/POS operator | Authenticated operational user | POS, transaction history, dashboard/settings if granted | Select/configure item, checkout, inspect order, manage own account | Functional Suitability (task-based), Usability, visible Security, limited Reliability and perceived Time Behaviour | Maintainability; resource utilization/capacity; technical Security, Compatibility and Portability |
| Inventory/operations personnel | Authenticated user assigned inventory work | Inventory, stock runs, waste, suppliers, alerts; other modules if granted | Inspect stock, receive stock, record waste, maintain suppliers, review alerts | Functional Suitability, Usability, visible Security, scenario Reliability, perceived Time Behaviour | Maintainability; internal Security; capacity/resources; technical Compatibility/Portability |
| Manager/authorized supervisor | Operational decision-maker with granted access | Inventory, products/recipes, suppliers, reports, alerts, forecasting, assigned admin workflows | Review operational state, perform/supervise workflows | Functional Suitability, Usability, visible Security/Accountability, scenario Reliability, perceived Time Behaviour | Code Maintainability; CPU/memory/capacity; technical Security; Portability absent deployment task |
| System administrator | User/role/access administrator | Users, roles, permissions, sessions/settings and other granted modules | Manage accounts/roles/sessions; check visible access outcomes | Admin Functional Suitability/Usability; visible Security/Accountability; technical Security only if qualified | Technical characteristics unless also qualified |
| IT expert/technical evaluator | Has source, deployment, database, test or operations expertise | Source, APIs, configuration, database, logs, deployment/test environment | Inspect and run defined technical tests | Characteristics for which a method/target exists; especially Performance, Compatibility, Reliability, Security, Maintainability, Portability | None categorically; unsupported targets still excluded |
| Café customer/external client | Direct IMS use unverified | No module evidenced | No supported IMS task established | None until direct use is confirmed | All product-quality judgments based only on non-use |

## 5. Respondent-System Interaction Matrix

| Group | Evidence they can provide | Preconditions | Boundary |
|---|---|---|---|
| Staff/cashier | Menus, validation, order totals/completion/history, visible access, experienced delay | Account with relevant permissions and actual POS exposure | Cannot infer database correctness, complete security or capacity |
| Inventory operator | Visible balance/transactions before and after stock run/waste; supplier/alert task outcomes | Inventory/stockRuns/suppliers/alerts grants | Correctness needs known quantities/business rules |
| Manager/supervisor | Operational task support, report/forecast and visible attribution/access | Relevant grants and real responsibility | No rating unseen or unfamiliar features |
| Administrator | User/role/session workflow and visible access outcomes | Administrator or appropriate grant | Visible denial does not prove authorization coverage or audit tamper resistance |
| IT expert | Code/config/API/database/test/operational evidence | Technical access, defined environment and protocol | Separate expert judgment from objective measurement |
| Café customer | None established | A customer-facing system feature and actual use must be identified | Exclude pending evidence |

## 6. ISO Characteristic Applicability Analysis

Observability classes: **DIRECT** = familiar use; **SCENARIO** = defined task, role, expected result or failure condition; **TECHNICAL** = technical inspection/test. These labels describe evidence access, not quality.

### 6.1 Functional Suitability

| Subcharacteristic | Feature/evidence | Qualified respondent and method | Applicability/limitation |
|---|---|---|---|
| Functional completeness | POS/order history; inventory, stock runs, products/recipes, suppliers, reports, alerts, forecasting and administration (`ims-backend/src/app.module.ts`, domain controllers) | Operators/managers compare assigned tasks with available outcomes; IT/domain reviewer compares to approved requirements | SCENARIO. No formal requirements baseline; module presence does not establish completeness. |
| Functional correctness | Checkout/pricing/refund, inventory ledger/posting/waste, reports and forecasts | Users/domain experts compare known expected values/state; IT executes controlled cases | SCENARIO. Needs an approved expected-result oracle. User satisfaction is not correctness. Orders controller currently exposes checkout/list/detail/refund; no user-facing void endpoint was verified. |
| Functional appropriateness | Café sales/inventory/admin workflows | Actual operators/managers assess fit to their duties | SCENARIO. Exclude features outside respondent’s work. |

### 6.2 Performance Efficiency

| Subcharacteristic | Feature/evidence | Qualified respondent and method | Applicability/limitation |
|---|---|---|---|
| Time behaviour | POS, dashboard, inventory queries, reports, forecasts | Users report experienced waiting; IT times defined operations | SCENARIO. Keep perceived delay separate from measured response time; control network, data and workload. |
| Resource utilization | Next.js, NestJS, PostgreSQL and background jobs | IT instrumentation of client/server/database | TECHNICAL: CPU, memory, connections/queries are not ordinary-user observations. |
| Capacity | Orders, inventory and reports over persisted data | IT load/concurrency/stress test against declared workload | TECHNICAL. No capacity target is documented. |

### 6.3 Compatibility

| Subcharacteristic | Feature/evidence | Qualified respondent and method | Applicability/limitation |
|---|---|---|---|
| Co-existence | Web client/API/database components | IT test in an identified shared-resource deployment | TECHNICAL/conditional. No shared-host scenario specified; omit if none exists. |
| Interoperability | Frontend calls own Nest API; SMTP/supplier lookup may be configured but provider/contract is unverified | IT contract/data-exchange test against confirmed external system | TECHNICAL/conditional. Own frontend-to-backend communication is not sufficient evidence of third-party interoperability. No confirmed payment gateway. |

### 6.4 Usability

| Subcharacteristic | Feature/evidence | Qualified respondent and method | Applicability/limitation |
|---|---|---|---|
| Appropriateness recognizability | Dashboard, POS, inventory, products, reports, alerts, settings/admin screens | Staff/managers identify purpose and task entry point | DIRECT in accessible screens; familiarity may bias results. |
| Learnability | Multi-step POS, stock-run, product/recipe/account workflows | New/infrequent users after standardized introduction | SCENARIO; experienced users alone cannot represent first-use learnability. |
| Operability | Forms, filters, cart, drafts, alert actions/navigation | Users perform familiar assigned task | DIRECT/SCENARIO, role-dependent. |
| User error protection | DTO/global validation, business state rules and frontend forms | User encounters safe invalid input; IT reviews server controls | SCENARIO. Code validation does not establish understandable feedback. |
| User interface aesthetics | Frontend presentation | Actual screen users after exposure | DIRECT; distinguish from navigation and task success. |
| Accessibility | Responsive UI exists; target assistive technology/conformance not established | Relevant users and/or accessibility specialist | Conditional. Establish users/devices/criteria; otherwise leave unassessed. |

### 6.5 Reliability

| Subcharacteristic | Feature/evidence | Qualified respondent and method | Applicability/limitation |
|---|---|---|---|
| Maturity | Frontend/backend tests and stateful domain services | IT reviews executed test/history/defect evidence | TECHNICAL. Test files do not establish passing status or field maturity. |
| Availability | Runtime depends on frontend, API, database and optional services | Users report access over defined period; IT uses uptime/incident records | SCENARIO/TECHNICAL. Demo exposure is insufficient for uptime claim. |
| Fault tolerance | Outbox/retry concepts, idempotency field, POS cache/queue helpers | IT injects controlled faults; trained user observes defined task | SCENARIO/TECHNICAL. End-to-end offline checkout/reconciliation is unverified; confirm official support first. |
| Recoverability | Transaction/reversal history, outbox state and account reset flow | IT tests system restore; user may test resumption of ordinary interrupted task | TECHNICAL/SCENARIO. Password reset is not disaster recovery; backup restore and targets are unknown. |

### 6.6 Security

| Subcharacteristic | Feature/evidence | Qualified respondent and method | Applicability/limitation |
|---|---|---|---|
| Confidentiality | Session/permission guards; account/order/profile data | Users test visible role access with test accounts; IT reviews controls | SCENARIO/TECHNICAL. Interface cannot prove encryption or complete isolation. |
| Integrity | Validation, checkout/stock services, ledger and role checks | Operator/domain reviewer verifies expected state; IT tests tampering/replay/state controls | SCENARIO/TECHNICAL. UI alone cannot prove persisted integrity. |
| Non-repudiation | Reversal actor and authorization audit models | IT reviews identity binding, immutability/protection and audit evidence | TECHNICAL. Actor/time fields alone are not tamper-evident proof. |
| Accountability | User activity, reversal actor, alert acknowledgement and authorization audit data | Admin checks visible attribution; IT reviews coverage and integrity | SCENARIO/TECHNICAL. Complete recording/retention is unknown. |
| Authenticity | Login/password verification/session/account-state/RBAC | Users test login/visible denial; IT examines implementation/configuration | SCENARIO/TECHNICAL. User outcomes do not prove resistance to impersonation/session theft. |

### 6.7 Maintainability

| Subcharacteristic | Feature/evidence | Qualified respondent and method | Applicability/limitation |
|---|---|---|---|
| Modularity | Nest domain modules and frontend feature/component structure | IT inspects dependencies/change boundaries | TECHNICAL; folder structure alone proves no quality. |
| Reusability | Shared types, clients, services/components | IT inspects a defined reuse/change case | TECHNICAL. |
| Analysability | Domain services, DTOs, tests | Maintainer diagnoses a seeded issue | TECHNICAL; use bounded task evidence. |
| Modifiability | Source modules/configuration/tests | Maintainer implements a representative change and records regression impact | TECHNICAL. |
| Testability | Jest tests and service/controller separation | IT runs tests and evaluates isolation/coverage for sample behavior | TECHNICAL; test presence is not a score. |

### 6.8 Portability

| Subcharacteristic | Feature/evidence | Qualified respondent and method | Applicability/limitation |
|---|---|---|---|
| Adaptability | Environment-based API/database/session/email configuration | IT deploys to specified target | TECHNICAL; target browser/OS/hosting matrix unknown. |
| Installability | Local scripts/run guide, environment validation, separate packages | Technical operator performs clean setup on named target | SCENARIO/TECHNICAL; local instructions do not prove production installability. |
| Replaceability | Separate frontend/backend, but no replacement scenario evidenced | IT only after target component/system is named | Currently not reasonably measurable; exclude until defined. |

## 7. Measurement Construct Blueprint

Construct names are candidates, not statements. Define expected outcomes and role before instrument drafting.

| ISO Characteristic | Subcharacteristic | System Feature | User/Technical Evidence | Respondent Group | Possible Measurement Construct |
|---|---|---|---|---|---|
| Functional Suitability | Completeness | POS checkout/history | Specified sale task and output | POS staff | Coverage of assigned POS task needs |
| Functional Suitability | Correctness | POS price/checkout | Total/status vs approved case | POS staff + domain/IT | Checkout output correctness |
| Functional Suitability | Appropriateness | POS workflow | Fit to routine sales task | POS staff | POS task fit |
| Functional Suitability | Correctness | Inventory/stock run/waste | Known initial/final quantity and ledger | Inventory operator + domain/IT | Inventory state correctness |
| Functional Suitability | Completeness/appropriateness | Products/recipes/suppliers | Assigned setup task outcome | Manager/admin | Support for assigned operational tasks |
| Functional Suitability | Correctness | Reports/forecasts | Output vs controlled data/approved meaning | Manager/domain/IT | Selected report/forecast correctness |
| Performance Efficiency | Time behaviour | POS/reports/search | Perceived wait and timed operation separately | User (perception), IT (time) | Perceived responsiveness / objective latency |
| Performance Efficiency | Resource utilization | App/API/database | Instrumented resource metrics | IT | Resource demand under workload |
| Performance Efficiency | Capacity | App/API/database | Concurrent load, throughput, error/latency curve | IT | Capacity under declared workload |
| Compatibility | Interoperability | Named external interface, if verified | Contract/data exchange | IT | Interoperation with named system |
| Compatibility | Co-existence | Named shared deployment, if applicable | Resource/conflict test | IT | Coexistence in target environment |
| Usability | Recognizability | Dashboard/role screens | Find purpose/entry point | Staff/manager | Feature and navigation clarity |
| Usability | Learnability | POS/stock run/setup | First-use task, assistance/errors | New/infrequent user | Ease of learning workflow |
| Usability | Operability | Forms/cart/filters/alerts | Task completion and interaction | Staff/manager | Ease of operating assigned task |
| Usability | User error protection | Checkout/stock/waste forms | Invalid case, feedback and recovery | Staff/manager + IT | Ordinary error prevention/handling |
| Usability | Aesthetics | Used screens | Perception after exposure | Staff/manager | Visual clarity/appeal |
| Usability | Accessibility | UI with named assistive tech | Task plus specialist evidence | Target users + specialist | Accessibility of specified task |
| Reliability | Availability | Login/POS/operational modules | Period experience and service records | User + IT | Experienced availability / measured uptime |
| Reliability | Fault tolerance | POS queue/API/outbox | Controlled disconnect/retry/reconcile | IT; user in supervised task | Continuity under defined fault |
| Reliability | Recoverability | Interrupted task/backup restore | Restore time/state/data loss | IT | Recovery performance against targets |
| Security | Authenticity | Login/session | Login/role scenario and technical review | User + IT | Visible authentication / control effectiveness |
| Security | Confidentiality | Role-scoped modules/data | Access matrix and data/control review | Admin/user + IT | Visible boundary / technical confidentiality |
| Security | Integrity | POS/inventory records | Expected state plus tamper/replay tests | Domain/user + IT | Transaction integrity |
| Security | Accountability | User/alert/reversal activity | Actor/time on defined actions; coverage review | Admin + IT | Attribution coverage |
| Security | Non-repudiation | Audit/reversal records | Identity and audit protection review | IT | Evidence strength for action attribution |
| Maintainability | Modularity | Frontend/backend modules | Boundary/dependency/change impact | IT | Change isolation of sampled modules |
| Maintainability | Reusability | Shared logic/components | Defined reuse task | IT | Reuse in representative change |
| Maintainability | Analysability | Service/test structure | Diagnosis of seeded issue | IT maintainer | Diagnosis effort |
| Maintainability | Modifiability | Source/tests | Bounded feature change and regression impact | IT maintainer | Modification effort/risk |
| Maintainability | Testability | Tests/service boundaries | Isolated test execution/interpretation | IT | Ease/adequacy of testing sample |
| Portability | Adaptability | Configuration/deployment | Adapt to named target | IT | Adaptation effort |
| Portability | Installability | Run/deployment artifacts | Clean install steps/errors/time | IT operator | Installability on target |
| Portability | Replaceability | No current scenario | None identified | None yet | Exclude pending target |

## 8. Feature-to-ISO Traceability Matrix

| System Feature | Workflow | ISO Characteristic | ISO Subcharacteristic | Observable Evidence | Qualified Respondent | Measurement Construct |
|---|---|---|---|---|---|---|
| POS menu/cart/checkout | Configure and complete seeded sale | Functional Suitability | Completeness, correctness, appropriateness | Task outcome and total vs known case | Cashier/staff; domain reviewer | POS task coverage, correctness, task fit |
| POS interface | Locate item, configure and checkout | Usability | Recognizability, learnability, operability, aesthetics | Path, success, help and errors | Staff; new users for learnability | POS navigation and operation |
| POS/API | Normal/peak checkout | Performance Efficiency | Time behaviour; resource/capacity | Perceived delay; instrumented metrics | User for perception; IT for metrics | Perceived responsiveness; objective performance |
| POS offline helper (unverified) | Disconnect, queue, reconnect | Reliability | Fault tolerance, recoverability | End-to-end replay and reconciliation | IT; supervised staff if officially supported | Offline continuity/reconciliation |
| Orders/refund/inventory ledger | Sale/refund and inspect state | Functional Suitability/Reliability | Correctness; scenario recovery | Known order and stock state | Staff/manager + domain/IT | Transaction/stock correctness |
| Inventory/stock runs/waste | Post receipt, log waste, inspect balance | Functional Suitability/Usability | Correctness, completeness, appropriateness, operability/error protection | Expected balance, ledger, validation and completion | Authorized operator/manager | Inventory support and state correctness |
| Product/recipe/supplier | Configure record or request lookup | Functional Suitability/Usability; Compatibility conditional | Completeness, appropriateness, correctness; interoperability only if named service | Task output; external contract if confirmed | Manager/admin; IT for integration | Setup support; external exchange correctness |
| Alerts | View/acknowledge/dismiss | Functional Suitability/Usability/Security | Correctness, operability, accountability | State, visible actor/time, access | Authorized operator/admin; IT for audit | Alert support and attribution |
| Reports/dashboard/forecast | Apply filter/run and inspect | Functional Suitability/Usability/Performance | Correctness, appropriateness, operability, time behaviour | Output vs known data; task experience/time | Manager/domain; IT timing | Report/forecast correctness and responsiveness |
| User/session/role administration | Change test account and verify access | Functional Suitability/Usability/Security | Completeness, correctness, operability; confidentiality, authenticity, accountability, integrity | Lifecycle outcome, allowed/denied access, attribution | Administrator; IT security evaluator | Admin task support and control effectiveness |
| Source/config/tests/deployment | Diagnose, change, install, test | Maintainability/Portability/Reliability/Compatibility | Applicable technical subcharacteristics | Code review, controlled change/install/fault/integration test | IT expert | Change/diagnosis effort and technical robustness |

## 9. Proposed Questionnaire Architecture

Counts are planning ranges, not commitments. Do not force equal counts across characteristics.

### Instrument 1 — End-user/operational user

Cover only accessible, familiar workflows: Usability; task-related Functional Suitability; validation/error handling; perceived response behavior; visible access outcomes; limited ordinary interruption experience. Suggested early blueprint: **2–4 candidate items per applicable construct**, around **10–18 total** for one role/task-specific instrument. Split POS and inventory branches if tasks differ. Exposure: role-appropriate login and task, known expected outcome for correctness, safe invalid-input scenario for error handling. No questions about internals, capacity, technical security, maintainability or portability.

### Instrument 2 — Administrator/manager

Cover Functional Suitability and Usability for actually performed inventory, stock-run, product/recipe, supplier, report, alert, forecast, account or permission workflows; visible Security/Accountability; perceived response/continuity only with a defined basis. Suggested early blueprint: **2–4 items per applicable construct**, approximately **12–24 total**, role-filtered. Separate or branch managers and administrators if their duties differ. Use test accounts and controlled expected outputs.

### Instrument 3 — IT expert/technical

Use an expert review plus test package. Expert ratings may be suitable for sampled maintainability constructs after source inspection or maintenance tasks; plan roughly **1–3 ratings per defined construct** (about **8–15 items** only if all selected constructs are coherent). Objective protocol is primary for response/load/resource, security, uptime/fault/recovery, interoperability, installability and portability. Require named target/workload, instrumentation and criteria. Avoid Likert-only claims for technical properties.

## 10. Pre-Evaluation Tasks and Scenarios

Give role-specific test accounts, neutral instructions and only tasks respondents are allowed and expected to perform. Capture completion, errors, assistance, time if relevant, and expected result. Do not create uncontrolled live transactions.

| Scenario | Respondents | Constructs enabled | Preconditions/limits |
|---|---|---|---|
| Login, open permitted dashboard, logout | All system users | Usability, visible authenticity/access, limited availability | Test account; not security proof |
| Select item/variant/modifier, complete seeded sale | POS staff | Functional suitability, usability, error protection, perceived/time-tested response | Test data/payment; known expected total |
| Inspect transaction history | POS staff with order-view grant | Functionality, usability, visible access | Seeded order and permission |
| Post stock-run and compare material balance | Inventory user/manager | Correctness/completeness, usability, validation | Test supplier/material and known opening quantity |
| Record waste and inspect ledger | `inventory.waste` user | Correctness, error protection, operability | Defined quantity/reason and expected remaining state |
| Create/edit product/recipe and inspect availability | Product-authorized manager/admin | Functionality, usability, validation | Test product/material and expected outcome |
| Acknowledge/dismiss seeded alert and inspect state | Alert-authorized user | Functionality, usability, accountability | Seeded alert and visible actor if interface exposes it |
| Apply report filters and compare output | `reports.view` user | Correctness, operability, response behavior | Controlled dataset and approved expected value |
| View forecast/run; change days only if authorized | Forecast user; setting is Administrator-only in controller | Functionality, usability | Existing run; domain oracle needed for correctness |
| Change own account/password | Authenticated user | Usability, validation, account recovery | Test account; reauthentication expected |
| Create/suspend/revoke test account or assign role | Administrator/authorized admin | Functionality, usability, visible access/accountability | Dedicated test accounts; never alter live accounts |
| Submit safe invalid value/unauthorized action | Role-appropriate test account | Error protection, visible Security, integrity | Harmless inputs and isolated test data |
| Disconnect or inject API/database fault | IT; staff only supervised if offline support confirmed | Reliability | Isolated environment; validate end-to-end offline support first |
| Run load/security/interoperability/install/restore/change task | IT expert | Technical characteristics | Written protocol, target and acceptance criteria required |

## 11. Subjective Questionnaire Measures

Potential perception constructs, each anchored to a recent task and feature: ease of operating an assigned POS/inventory/admin workflow; feature-purpose/navigation clarity; ease of learning after a specified introduction; perceived fit to assigned work; clarity/usefulness of ordinary validation; perceived visual clarity; perceived response behavior during specified tasks; visible access-denial clarity and attribution; experienced continuity over a stated period. Keep perceived response distinct from measured response and task correctness. Use “not used/not able to assess” or branching where appropriate.

## 12. Objective Technical Measures

| Area | Evidence/method | Why opinion is insufficient |
|---|---|---|
| Time behaviour | Repeated client/API timings, dataset/network and percentile definition | Recall/context vary |
| Resources/capacity | CPU/memory/database/browser metrics; concurrency, throughput, latency/error curves | Hidden and workload-dependent |
| Compatibility | Named browser/device matrix, external API contract or shared-environment test | One user’s experience cannot establish target coverage |
| Reliability | Uptime/incident records, fault injection, retries/idempotency, restore with RTO/RPO | Short survey cannot establish availability or recovery guarantees |
| Security | Threat/control review, test-account authorization matrix, session/cookie/config review, safe negative tests, audit integrity | UI cannot prove hashing/encryption/tamper resistance/coverage |
| Maintainability | Source review and bounded diagnosis/change/test tasks with effort/regression evidence | Internal changeability invisible to ordinary users |
| Portability | Clean install/adaptation on named target | No target means no meaningful portability claim |
| Functional correctness | Controlled data and owner-approved expected totals/balances/report values | “Looks right” lacks an oracle |

## 13. Measurement Risks and Controls

| Risk | Control |
|---|---|
| Double-barrelled claims | One construct per future item; separate task success, correctness and ease |
| Vague terms (“fast”, “secure”, “easy”, “accurate”) | Name feature, task, context, reference period and observable criterion |
| Leading/overly positive wording | Neutral wording, independent review, cognitive interviews |
| Technical concepts for ordinary users | Restrict source/security/resource concepts to technical assessment |
| Duplicate/overlapping constructs | Maintain item-to-construct map; distinguish appropriateness, correctness, usability and perceived speed |
| Inaccessible or unfamiliar workflow | Screen by role/access/experience; branch; standardize scenario/orientation |
| Social desirability | Confidential collection, independent administration, no employment consequences |
| Acquiescence | Avoid uniformly positive prompts; use clear balanced response options |
| Familiarity bias | Record experience; assess learnability separately with new/infrequent users |
| Role-related differences | Verify grants; report strata; compare only equivalent constructs/tasks |
| Perceived vs measured performance | Label separately; publish objective protocol/metrics independently |
| Visible access mistaken for security | User construct limited to visible access; IT verifies API/config/control coverage |
| Offline/integration assumption | Verify end-to-end supported workflow and named provider before inclusion |
| Undefined expected result | Obtain owner-approved cases and business rules before correctness tasks |
| No deployment baseline | Define target devices/browsers/hosting/workload before compatibility/portability/performance/availability claims |

## 14. Content Validation Plan

Invite a research-methodology/instrument expert, ISO/software-quality knowledgeable reviewer, software/IT reviewer, café/domain representative and intended respondent representatives. Review each construct/item for relevance, clarity, representativeness, ISO alignment, verified system-feature alignment, respondent qualification and observability. Track feedback and revisions; follow institutional content-validity procedure if required. Content validity is not established until review occurs and is documented.

## 15. Pilot Testing Plan

Pilot a later draft with people resembling each intended group. Use cognitive interviews/think-aloud checks plus completion timing. Examine interpretation, terminology, duration, confusing/redundant items, missing constructs, branching, response-option use, variability and floor/ceiling patterns. Test delivery/accessibility in intended environment. Revise and record decisions; do not fabricate pilot outcomes. Follow protocol on whether pilot responses may enter main analysis.

## 16. Reliability Analysis Plan

After data collection, assess internal consistency only for coherent scales intended to measure a common reflective construct, such as workflow operability, learnability among scenario-qualified users, perceived error protection, perceived responsiveness or task-support perception. Examine dimensionality and item behavior first. Cronbach’s alpha may be appropriate where assumptions and scale structure support it; alpha is not validity and is not appropriate automatically for formative checklists or heterogeneous features. Do not calculate alpha across all ISO characteristics as one construct. Objective measures require repeatability/measurement procedures, not alpha. No coefficients are calculated or claimed.

## 17. Researcher Decisions Required

Resolve before drafting/recruiting:

- Final respondent groups and meaning of “clients”; whether customers use an actual feature;
- Population size, sample-size rationale, sampling approach, inclusion/exclusion criteria and recruitment;
- Actual duties, deployed permissions and workflow exposure per role;
- Whether institution/adviser requires all eight characteristics and required 2011 edition;
- Likert scale/anchors, language, institutional format, item/time limits and not-applicable handling;
- IT expert qualification/access criteria;
- Target browser/device/deployment environment, workload and acceptance thresholds;
- Owner-approved expected results for sales, inventory, reports, alerts and forecasts;
- Whether offline POS is officially supported and reconciles end-to-end;
- Whether email, supplier lookup, payment, geolocation or other integrations are truly in scope;
- Monitoring/uptime, backup/recovery procedures and recovery targets;
- Security test authorization, isolated test environment, privacy and operational-data safeguards;
- Accessibility target users/assistive technology/criteria;
- Validation reviewers, pilot and statistical-analysis requirements, ethics/institutional approval.

## 18. Final Questionnaire Blueprint

Counts are provisional. “Exclude” means no defensible measure until target/evidence exists. Task-based evidence may be collected alongside a short post-task perception section; objective measures are not questionnaire items.

| Respondent Group | ISO Characteristic | Subcharacteristic | Café Salvacion IMS Feature | Evaluation Scenario | Observable Evidence | Measurement Construct | Measurement Method | Suggested Item Count |
|---|---|---|---|---|---|---|---|---|
| POS staff | Functional Suitability | Completeness/correctness/appropriateness | POS checkout/history | Complete seeded sale and inspect order | Outcome/total vs approved case | POS coverage, output correctness, task fit | Task-based questionnaire + outcome check | 2–4 per construct, selected subset |
| POS staff | Usability | Recognizability/learnability/operability/error protection/aesthetics | POS | Find/configure/checkout; new user orientation; safe invalid case | Path, success, help, error/feedback | Navigation, learning, operation | Task-based questionnaire | 1–3 per applicable construct |
| POS staff | Performance Efficiency | Time behaviour | POS/API | Repeat normal scenario | Perceived wait vs measured duration | Perceived responsiveness | Likert + separate timing | 1–2 perception items; no timing item |
| Inventory staff | Functional Suitability | Completeness/correctness/appropriateness | Inventory/stock run/waste | Post test receipt, log waste, inspect balance | Expected quantity and ledger | Task support and state correctness | Task-based + outcome check | 2–4 per construct, subset |
| Inventory staff | Usability | Recognizability/operability/error protection | Inventory/forms/alerts | Locate material, valid action, invalid input | Task path, validation/recovery | Navigation/error handling | Task-based questionnaire | 1–3 per applicable construct |
| Manager | Functional Suitability | Correctness/appropriateness | Reports/alerts/forecasts/products | Review controlled output | Output vs approved expectation | Operational decision support/correctness | Task-based + domain check | 2–4 per construct, used workflows only |
| Admin/manager | Security | Visible confidentiality/authenticity/accountability | Role pages/admin activity | Test account access and attribution | Allowed/denied, visible actor/time | Visible role boundary/attribution | Task-based questionnaire | 1–2 per observed construct |
| Administrator | Functional Suitability/Usability | Admin task coverage/operability | User/session/role tools | Change test account and verify access | Lifecycle result and access | Admin workflow support | Task-based questionnaire | 2–4 per relevant construct |
| IT expert | Performance Efficiency | Time/resources/capacity | Web/API/database | Timed/load/concurrency scenarios | Latency, throughput, resource metrics | Response/capacity | Objective test | 0–2 ratings if useful; metrics primary |
| IT expert | Compatibility | Coexistence/interoperability | Named target only | Shared environment/external contract test | Conflicts/data exchange | Compatibility with target | Objective test | 0 if no target |
| IT expert | Reliability | Maturity/availability/fault tolerance/recoverability | Runtime/outbox/restore | Review tests, uptime, inject faults, restore | Test/incident records, reconciliation, RTO/RPO | Reliability/recovery | Expert review + objective test | 1–3 ratings only where coherent; tests primary |
| IT expert | Security | All five subcharacteristics | Auth/session/RBAC/data/audit | Review controls and authorized negative tests | Coverage/config/access/audit evidence | Control effectiveness | Expert review + security test | No user items; optional 1–3 ratings per review construct |
| IT maintainer | Maintainability | All five subcharacteristics | Source/tests | Diagnose, modify, test bounded case | Effort, impact, dependencies/test evidence | Changeability/testability | Expert review + maintenance task | 1–3 per construct; task evidence primary |
| IT operator | Portability | Adaptability/installability | Config/deployment | Clean install/adapt on target | Steps, changes, failures, success | Target install/adaptation | Objective test + review | 0–2 ratings; test primary |
| None yet | Portability | Replaceability | No target evidenced | None | None | None | Exclude/not measurable | 0 |
| None yet | Compatibility | Coexistence/interoperability | No shared target/confirmed external contract | None | None | None | Exclude/not measurable | 0 |

## 19. Final Recommendations Before Questionnaire Writing

1. Confirm “clients,” participants and real operator roles.
2. Obtain deployed role grants and separate tasks by actual duty.
3. Get domain-approved expected values/test data before measuring correctness.
4. Define target environments before including Compatibility/Portability.
5. Verify offline POS and external integrations before evaluating them.
6. Separate technical tests/expert review from user perception instruments.
7. Validate and pilot the instrument before main collection.
8. Treat candidate constructs and counts as provisional until protocol/sample/scale requirements are known.

### Final handoff summary

1. **System:** Browser-based Café Salvacion inventory/POS system with authenticated operational/admin workflows: products/recipes, inventory/stock runs, sales/refunds, reports, alerts, forecasts and account/role administration.
2. **Defensible respondents:** POS staff, inventory/operational users, managers/supervisors, system administrators and qualified IT evaluators, only for relevant tasks/access. Café customers are unsupported as direct users so far.
3. **End users:** Usability, task-related Functional Suitability, visible validation/access, perceived response and limited scenario reliability.
4. **Managers/admins:** Functional Suitability/Usability for actual assigned workflows; visible Security/Accountability; experienced response/continuity with suitable exposure.
5. **IT experts:** Maintainability, technical Security, Performance Efficiency, Reliability, Compatibility, Portability and scenario-based correctness.
6. **Objective testing:** Resource/capacity/latency, security control effectiveness, uptime/fault/recovery, interoperability/coexistence, maintainability task evidence, installability/portability and correctness against known results.
7. **Exclude/defer:** Replaceability; Compatibility without a named target; accessibility without target users/criteria; customer ratings without customer feature; offline POS pending end-to-end confirmation; disaster recovery without procedure/targets.
8. **Researcher input:** Respondent definitions/population/sample/sampling, deployed grants/tasks, scale/format, item limits, target environment, expected business results, offline/integration scope, expert criteria, validation/pilot/statistics/ethics.
9. **Sufficient to begin actual questionnaire?** Not as a complete instrument until decisions above are resolved. Role-specific drafting can begin once groups, access, scenarios and expected outcomes are confirmed.
10. **Separate instruments:** (1) Operational user with POS/inventory branches as needed; (2) manager/administrator sections or instruments based on actual duties; (3) IT expert review paired with objective technical protocols.

No questionnaire items have been written. No validation, pilot or reliability analysis has been conducted or claimed.
