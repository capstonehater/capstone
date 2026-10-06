# Phase 3B — Settings Centralization

## Changed files

- `ims-frontend/src/features/settings/SettingsFeature.tsx` and `SettingsWorkspace.tsx` (new central entry and relocated implementation).
- `ims-frontend/src/components/admin/settings/SettingsWorkspace.tsx` (compatibility re-export).
- Existing `src/app/{admin,staff,manager}/settings/page.tsx` adapters.
- `ims-frontend/tests/settings.test.cjs` and this report.

## Previous settings structure

All three pages used the same workspace under the admin component directory but duplicated the surrounding Settings heading markup. Admin and Staff used the same content presentation with different shells. Manager used its existing Admin shell header and distinct copy, border, and width.

## Centralized structure

One role-neutral `features/settings/SettingsFeature` owns the Settings content presentation and renders one central workspace. Three thin route adapters retain shell ownership and select the existing presentation. The workspace implementation now lives under `features/settings`; the old import remains a compatibility re-export. Existing cards/dialogs remain in place to avoid broad renaming.

## Behavior preserved

The relocated workspace is identical to the original apart from four component import paths, verified by a source comparison against HEAD. Account loading, profile/password updates, notices, reauthentication, session clearing, and logout-related behavior were not modified.

All three URLs remain unchanged; no `/settings` route was introduced. Registry semantics remain authenticated self-service, including zero feature grants, with no users permission or Administrator requirement. Existing shell ownership, header visibility, styling classes, and Manager presentation remain intact. No nested shell was introduced.

## Tests/results

- Targeted Settings adapter tests: **3 passed**, verifying one workspace/one shell and preserved presentation for each URL (shell and workspace mocked).
- Existing route/navigation permission tests: **27 passed**, including authenticated route matrices with empty grants and logged-out denial.
- Frontend `tsc --noEmit --incremental false`: **passed**.
- Scoped non-mutating ESLint: **passed**.
- `git diff --check`: **passed**.

Commands: `node --test --test-isolation=none tests/settings.test.cjs`; the same runner for `tests/permissions.test.cjs`; TypeScript as above; ESLint targeting the new feature, compatibility module, three route pages, and new test. Shell ownership did not change, so the shell suite was not rerun. No full suite or build ran.

## Diff review

Reviewed the scoped adapters, central entry, and workspace relocation. No API, backend, RBAC, schema, route registry, CSS, or unrelated feature changes were made. Previous phases' uncommitted changes remain intact.

## Risks

No browser visual or live account mutation test was performed. Preservation of update/session logic is supported by the exact source comparison; adapter tests cover composition rather than API behavior. The central workspace intentionally still imports existing cards/dialogs from their old directory.

## Readiness for Phase 3C

Ready for separately scoped Phase 3C work. Settings now has one role-neutral internal entry while retaining all legacy URLs and shell presentations.
