# Phase 3A — Shared Application Shell Primitives

## Changed files

- `ims-frontend/src/components/layout/ShellControls.tsx` (new).
- `ims-frontend/src/components/admin/AdminDashboardLayout.tsx`.
- `ims-frontend/src/components/admin/AdminSidebar.tsx`.
- `ims-frontend/src/components/staff-pos/StaffDashboardLayout.tsx`.
- `ims-frontend/tests/shell.test.cjs` (new).
- This report.

## Duplicated shell logic removed

Extracted the shared mobile navigation trigger, close button, overlay, and sidebar collapse control. Both shell implementations now consume the same button markup, labels, icons, and event delegation. The existing shared account component and centralized navigation consumption remain in use. Separate shell frames and headers were retained because their behavior differs; no extra wrapper or authorization layer was introduced.

## Behavior intentionally preserved

Existing element structure, classes, icon sizes, labels, handlers, and optional accessibility attributes are preserved. Admin retains its overlay tab index, mobile focus trap/restoration, Escape and resize handling, body scroll lock, persisted collapse/section/scroll state, entrance animation, header visibility, and fill-content option. Staff retains local collapse state and its existing overlay behavior. Account placement and navigation presentation remain distinct.

No route files, URLs, registry policies, authorization components, CSS, or backend files were edited in this phase. `/admin`, `/staff`, and `/manager` paths remain unchanged.

## POS-specific behavior retained

FocusModeContext and both focus-toggle handlers remain unchanged, including closing the drawer when toggling. Focus remains limited to `/staff/pos` and `/staff/dashboard`; focus styling/inert sidebar, viewport sizing, scroll behavior, retracting header, mobile menu hiding, and transaction-page header suppression remain intact. Staff settings navigation still resolves through its centralized route ID.

## Tests/results

- `node --test --test-isolation=none tests/shell.test.cjs`: **25 passed**. Tests render the actual layouts/sidebar across open, collapsed, and focus states, verify one shell/main, focus/header conditions, and control event delegation. Auth/account/navigation dependencies are mocked for these rendering tests.
- `node --test --test-isolation=none tests/permissions.test.cjs`: **27 passed**, covering real centralized navigation, policy, URL coverage, and presentation metadata.
- `tsc --noEmit --incremental false`: **passed**.
- Scoped non-mutating ESLint on the four production files and new test: **passed**.
- `git diff --check`: **passed**.

An initial test harness attempted to read the baseline through a child Git process, which the sandbox rejected with EPERM. The final tests use explicit shell behavior assertions and require no Git subprocess. No full suite or build ran.

## Diff review

Reviewed the scoped production diff and new primitive/test files. Each replacement produces the same button element without added DOM nesting; CSS selectors and layout ownership remain unchanged. Earlier Phase 2 changes and reports were preserved. No unrelated changes were made.

## Risks

Rendering tests verify structural contracts and event delegation, not browser layout or keyboard interaction. No visual/browser smoke test was performed. Existing Admin and Staff drawer accessibility differences were deliberately preserved rather than expanded in this extraction.

## Readiness for Phase 3B

Ready for separately scoped Phase 3B work. This phase establishes shared controls while retaining the workflow-specific shell structures; it introduces no canonical URLs or route migration.
