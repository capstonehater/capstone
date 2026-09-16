# Frontend Redesign — Section 01: Global Application Shell / Navigation

**Date:** 15 September 2026  
**Status:** Implemented for review; testing deferred. Section 02 has not started.

## 1. Scope completed

Restyled the active administrator sidebar, administrator header, staff header, application background and outer content spacing. Added grouped navigation, route-aware header titles and active navigation indicators. Both existing staff routes now use the staff shell. Page workspaces remain unchanged.

Presentation styles live in a shared CSS module; Bootstrap, Tailwind, global typography and existing page styles remain in place. No application dependencies were added.

## 2. design.zip findings relevant to the global shell

The root archive contains PDF exports of screens and individual elements, not executable frontend code. Full-page references were extracted under unique filenames in the system temporary directory because the archive contains filenames differing only by capitalization, which collide on Windows.

Visual references inspected include `DASHBOARD.pdf`, `INVENTORY.pdf` and `STAFF REPORTS POS MAIN.pdf`. Additional full-page exports were extracted for reference. The inspected screens establish:

- Dark navy administrator sidebar, approximately 300 pixels wide in the 1920-pixel desktop dashboard reference.
- Cafe Salvacion branding above a divider, with “POS Management” below it.
- MAIN, REPORTS and MANAGEMENT groups; light outline icons and labels.
- Bright green active label/icon and a thin vertical green marker.
- Pale neutral page and header backgrounds, dark uppercase page titles, understated subtitles and a thin header divider.
- Profile avatar followed by role/email on the right, with a separate bordered notification button.
- A full-width staff header without an administrator sidebar.
- Fluid content area with generous outer gutters. Cards, gradients, charts and tables beneath the header are page content and are deferred.

Implementation uses navy `#232d46`, accent `#7cfc24`, background `#f5f5f5`, border `#c5c5c5`, 300px desktop sidebar and 108px header/brand minimum height. These are practical visual approximations, not a claim of pixel-perfect reproduction or extracted design tokens. Existing local/system typography and Lucide icons are reused.

No mobile/collapsed interaction specification was established from the inspected desktop PDFs. The existing mobile drawer pattern is retained and adapted: sidebar is hidden below 1024px, opened from the header, dismissed by close/backdrop/Escape, and closed when entering desktop width. It has focus cycling and restores focus/scroll state on close. Smaller desktop widths use a 250px sidebar; phone headers wrap and long emails truncate. These behaviors require later browser verification.

## 3. Current live components/routes inspected

The rendering path was traced before editing:

- `ims-frontend/src/app/layout.tsx` imports Bootstrap/global CSS and mounts AuthBootstrap.
- `src/app/admin/layout.tsx` and `src/app/staff/layout.tsx` retain their existing role-specific AuthGuard wrappers.
- Administrator pages render `AdminDashboardLayout`; reports use it from `src/app/admin/reports/layout.tsx`.
- `AdminDashboardLayout` renders `AdminSidebar`, `AdminHeader`, then the existing page children.
- `/staff/dashboard` already renders `StaffDashboardLayout` around `StaffPOSPage`.
- `/staff/pos` previously rendered only `StaffPOSPage`; it now wraps that same component in `StaffDashboardLayout` without editing POS internals.
- `StaffDashboardLayout` renders `StaffHeader` and its children.
- AuthBootstrap, AuthGuard, authStore, useLogout, ProfileAvatar, global styles, API client usage and active route imports were inspected to identify behavior that must remain intact.
- Local installed Next.js CSS and Link documentation was consulted as required by `ims-frontend/AGENTS.md`.

### Presentation mapping

| Reference element | Active implementation | Action |
| --- | --- | --- |
| Navy grouped navigation | AdminSidebar | Restyle and restructure navigation markup |
| Current-page title | AdminHeader | Derive presentation from existing pathname |
| User and notification area | AdminHeader / StaffHeader / ProfileAvatar | Restyle; retain live data and supported actions |
| Background and outer gutters | AdminDashboardLayout / StaffDashboardLayout | Shared scoped CSS |
| Dashboard cards, inventory panels, POS categories | Existing page workspaces | Leave for later sections |

## 4. Files modified

All paths below are relative to the repository root:

| File | Section 01 change |
| --- | --- |
| `ims-frontend/src/components/admin/AdminDashboardLayout.tsx` | Shared shell styles, content container, stable drawer close callback and expanded state |
| `ims-frontend/src/components/admin/AdminSidebar.tsx` | Branding, grouped links, route active state, footer, responsive drawer presentation and keyboard handling |
| `ims-frontend/src/components/admin/AdminHeader.tsx` | Flat header, route title/subtitle, live profile styling, live unread badge and responsive alert container |
| `ims-frontend/src/components/staff-pos/StaffDashboardLayout.tsx` | Shared background/header/content spacing |
| `ims-frontend/src/components/staff-pos/StaffHeader.tsx` | Matching header/profile styling; unsupported controls visibly unavailable; no fabricated unread dot |
| `ims-frontend/src/app/staff/pos/page.tsx` | Wrap existing POS component with the existing staff shell |

Several files already had user changes before this task. In particular, existing ProfileAvatar integrations and Forecasting navigation were retained. The repository was not reset or cleaned.

## 5. Files created

- `ims-frontend/src/components/layout/ApplicationShell.module.css`: scoped shell colors, geometry, navigation, header and responsive styles.
- `ims-frontend/src/components/layout/shell-navigation.ts`: shared administrator navigation groups, existing destinations, title/subtitle metadata and exact/nested route matching.
- `FRONTEND_REDESIGN_SECTION_01_GLOBAL_SHELL_REPORT.md`: this report.

## 6. Assets copied from design.zip

**None.** The shell branding is text and the icons reuse the installed Lucide library. PDF exports and rendered inspection images remain in temporary storage; none were copied into application assets. No remote fonts, image hosts or new runtime packages were introduced.

PyMuPDF was installed into a temporary inspection directory to read/render the supplied PDFs. This was tooling for inspecting the design only; no project manifests or lockfiles were changed.

## 7. Navigation mapping

| Design item | Existing route / entry point | Resulting behavior |
| --- | --- | --- |
| Dashboard | `/admin/dashboard` | MAIN group; active green state on matching route |
| Inventory | `/admin/inventory` | MAIN group; existing inventory workspace |
| Products (shown in inventory reference) | `/admin/products` | MAIN group; existing product workspace retained |
| Suppliers | Manage Suppliers inside `/admin/inventory` | No standalone route exists; no fake link/page added; existing inventory entry point unchanged |
| Reports | `/admin/reports` | REPORTS group; nested report pages retain Reports active state |
| Forecasting | `/admin/forecasting` | REPORTS group; existing route and feature retained |
| Alerts | `/admin/alerts` | REPORTS group; existing header View all link retained |
| User | `/admin/users` | MANAGEMENT group; existing account administration |
| Settings | `/admin/settings` | MANAGEMENT group; existing profile/security dropdown destinations retained |
| Recommendations (not shown in inspected navigation) | `/admin/recommendations` | Existing route now directly accessible in REPORTS group; placeholder content unchanged |
| Staff dashboard | `/staff/dashboard` | Staff header and POS workspace; no administrator sidebar |
| Staff POS | `/staff/pos` | Same staff shell around existing POS workspace |

No routes were renamed, deleted or created. Logout continues through useLogout. Administrator account dropdown links still target `/admin/settings` and `/admin/settings#security`.

## 8. Existing functionality preserved

- AuthBootstrap, `/auth/me` bootstrap, cookie sessions, credentials-inclusive API client and Zustand stores are untouched.
- Administrator/staff AuthGuard wrappers and backend authorization are untouched. MANAGER receives no new role access.
- Administrator alert polling interval, focus refresh, fetch functions, acknowledge/dismiss actions, loading state and live unread count remain intact.
- ProfileAvatar continues to display the existing live profile image/fallback; role and email come from the current auth user. Sample fallback email addresses were replaced with neutral “Account” text.
- Existing account dropdown actions, outside-click behavior and logout calls remain intact.
- Inventory, reports, POS, forecasting and all other page child components and their fetching/business logic remain unchanged.
- Receipt printing, offline commands, checkout, discounts, payment handling and backend audit findings were not changed.

### Scope review

Reviewed the frontend diff and compared source-file hashes against a baseline captured before implementation. Across frontend source, backend source/Prisma, Python and AI-Store Reco, the comparison identified only the six modified and two new frontend files listed above, with no removed files. The report is the additional documentation artifact.

No backend, Prisma, migration, database, API-route/contract, auth store, session implementation or page workspace edit was made by this task. Existing unrelated dirty files remain present and were not reverted. This scope inspection is not a runtime test.

## 9. Design / contract gaps

- Suppliers appears as a navigation item in the inventory PDF, but the application exposes supplier management through an inventory modal. A new supplier page or modal-opening routing contract is outside this section.
- The staff bell has no working notification integration. It is disabled, labelled unavailable and carries no sample notification dot. No administrator alert API was exposed to staff.
- Staff My Profile, Account Settings and Privacy & Security controls were already inert. They remain visible but disabled/labelled unavailable; no nonexistent route or expanded permission was introduced. Logout remains enabled.
- Recommendations already exists as a placeholder route but is missing from the inspected sidebar. Its new navigation link preserves access without claiming that page has implemented recommendations content.
- Design sample account addresses, financial figures and unread dots were not copied. Sidebar footer omits the design's sample version label because release-version presentation is not established.
- Current page contents retain their existing colors and card styling, so this incremental section intentionally does not match full-page screenshots yet.

## 10. Design items deferred to later sections

Dashboard KPI cards, overview gradient, charts and activity lists; product/inventory tables and modals; users; alerts; reports/export contents; forecasting visualizations; recommendation content; settings; staff POS categories/cart/payment/receipt; login and password pages.

No shared page-card, form, table or modal redesign was performed. Header dropdown content still uses existing controls with their established behavior.

## 11. Legacy components encountered but not deleted

`src/components/layout/DashboardShell.tsx` is not the active shell in the traced administrator/staff routes and was left untouched. Older `components/inventory`, generic modals and sample-data modules coexist with live workspaces; they were not removed or repurposed. Presence alone was not treated as proof of active usage or dead code.

## 12. Testing status

**TESTING STATUS: NOT EXECUTED — deferred by project owner until the frontend redesign sections are complete.**

No test suite, backend/database tests, build, type check, lint or browser verification was executed for this section. Design-image inspection and source/diff scope review were performed. Responsive geometry, keyboard navigation, dropdown positioning and authenticated browser journeys remain unverified at runtime; this section is not claimed to be fully tested.

## 13. Future improvements / unrelated observations

Deferred, not implemented:

- Working staff notification/account-settings contracts, if approved separately.
- Dedicated supplier navigation and substantive Recommendations content.
- Receipt printing, offline ownership, rapid checkout submission and report export issues from the audit.
- Backend/database transaction integrity, account delivery and worker/runtime issues.
- Browser/accessibility review of the completed redesign, including long emails, zoom, mobile drawer focus, overlays and role-specific sessions.
- Legacy component cleanup only after separate reachability analysis.

## 14. Exact recommendation for Section 02

**Section 02 — Administrator Dashboard content only.** Use `DASHBOARD.pdf` to restyle the live `/admin/dashboard` workspace: KPI cards, inventory overview, charts and operational lists. Preserve its existing data sources, calculations, filters, links and error/loading behavior. Reuse the Section 01 shell without duplicating the header/sidebar. Do not use sample PDF figures or begin Inventory, Products, Reports or POS redesign. Start only after Section 01 review.
