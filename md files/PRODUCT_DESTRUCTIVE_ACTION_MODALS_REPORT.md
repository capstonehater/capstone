# Product Destructive Action Modals Redesign

## Scope

Redesigned only Disable Product, Archive Product, and Delete Product confirmation modals.

## Files changed

- `ims-frontend/src/components/admin/products/DisableProductDialog.tsx` (created)
- `ims-frontend/src/components/admin/products/ArchiveProductDialog.tsx`
- `ims-frontend/src/components/admin/products/DeleteProductDialog.tsx`
- `ims-frontend/src/components/admin/products/ProductsWorkspace.tsx` (opens the disable confirmation before the existing toggle handler)

## Preserved behavior

Existing toggle, archive, delete eligibility, delete, loading, error, and permission-controlled handlers remain in use. No backend, database, Prisma, or API contract changes were made.

## Presentation

All three dialogs now use the same white-card, dark-overlay, close-icon, warning banner, product-summary, and footer-action visual language. Delete remains disabled when eligibility is blocked; archive reason submission remains intact.

## Sanity check

`git diff --check` is the applicable presentation check. Full application tests were not run.
