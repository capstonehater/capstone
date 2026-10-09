// Code-managed supported capabilities. No runtime endpoint accepts arbitrary keys.
export const PERMISSION_CATALOG = [
  {
    key: 'dashboard.view',
    module: 'dashboard',
    label: 'View dashboard',
    description:
      'View dashboard metrics; endpoint-level report dependencies must be mapped before enforcement.',
  },
  {
    key: 'products.view',
    module: 'products',
    label: 'View products',
    description: 'view access for products.',
  },
  {
    key: 'products.create',
    module: 'products',
    label: 'Create products',
    description: 'create access for products.',
  },
  {
    key: 'products.edit',
    module: 'products',
    label: 'Edit products',
    description:
      'Edit products, variants and availability; existing recipe access follows product policy.',
  },
  {
    key: 'products.archive',
    module: 'products',
    label: 'Archive products',
    description: 'archive access for products.',
  },
  {
    key: 'products.restore',
    module: 'products',
    label: 'Restore products',
    description: 'restore access for products.',
  },
  {
    key: 'products.delete',
    module: 'products',
    label: 'Delete products',
    description: 'delete access for products.',
  },
  {
    key: 'inventory.view',
    module: 'inventory',
    label: 'View inventory',
    description: 'view access for inventory.',
  },
  {
    key: 'inventory.create',
    module: 'inventory',
    label: 'Create inventory',
    description: 'create access for inventory.',
  },
  {
    key: 'inventory.edit',
    module: 'inventory',
    label: 'Edit inventory',
    description: 'edit access for inventory.',
  },
  {
    key: 'inventory.archive',
    module: 'inventory',
    label: 'Archive inventory',
    description: 'archive access for inventory.',
  },
  {
    key: 'inventory.waste',
    module: 'inventory',
    label: 'Waste inventory',
    description: 'waste access for inventory.',
  },
  {
    key: 'stockRuns.view',
    module: 'stockRuns',
    label: 'View stockRuns',
    description: 'view access for stockRuns.',
  },
  {
    key: 'stockRuns.create',
    module: 'stockRuns',
    label: 'Create stockRuns',
    description: 'create access for stockRuns.',
  },
  {
    key: 'stockRuns.edit',
    module: 'stockRuns',
    label: 'Edit stockRuns',
    description: 'edit access for stockRuns.',
  },
  {
    key: 'stockRuns.delete',
    module: 'stockRuns',
    label: 'Delete stockRuns',
    description: 'delete access for stockRuns.',
  },
  {
    key: 'stockRuns.post',
    module: 'stockRuns',
    label: 'Post stockRuns',
    description: 'post access for stockRuns.',
  },
  {
    key: 'suppliers.view',
    module: 'suppliers',
    label: 'View suppliers',
    description: 'view access for suppliers.',
  },
  {
    key: 'suppliers.create',
    module: 'suppliers',
    label: 'Create suppliers',
    description: 'create access for suppliers.',
  },
  {
    key: 'suppliers.edit',
    module: 'suppliers',
    label: 'Edit suppliers',
    description: 'edit access for suppliers.',
  },
  {
    key: 'suppliers.delete',
    module: 'suppliers',
    label: 'Delete suppliers',
    description: 'delete access for suppliers.',
  },
  {
    key: 'suppliers.searchAvailability',
    module: 'suppliers',
    label: 'Search availability suppliers',
    description: 'searchAvailability access for suppliers.',
  },
  {
    key: 'reports.view',
    module: 'reports',
    label: 'View reports',
    description: 'view access for reports.',
  },
  {
    key: 'reports.export.excel',
    module: 'reports',
    label: 'Export Excel',
    description: 'Download report data as an Excel file. Requires View reports.',
  },
  {
    key: 'reports.export.pdf',
    module: 'reports',
    label: 'Export PDF',
    description: 'Download or print report data as a PDF file. Requires View reports.',
  },
  {
    key: 'forecasting.view',
    module: 'forecasting',
    label: 'View forecasting',
    description: 'view access for forecasting.',
  },
  {
    key: 'users.view',
    module: 'users',
    label: 'View users',
    description: 'view access for users.',
  },
  {
    key: 'users.manage',
    module: 'users',
    label: 'Manage users',
    description:
      'Create, update, suspend, reactivate, reset and delete user accounts under existing safeguards.',
  },
  {
    key: 'users.sessions.revoke',
    module: 'users',
    label: 'Sessions revoke users',
    description: 'Revoke user sessions.',
  },
  {
    key: 'pos.view',
    module: 'pos',
    label: 'View pos',
    description: 'view access for pos.',
  },
  {
    key: 'pos.checkout',
    module: 'pos',
    label: 'Checkout pos',
    description: 'checkout access for pos.',
  },
  {
    key: 'pos.orders.view',
    module: 'pos',
    label: 'Orders view pos',
    description: 'orders view access for pos.',
  },
  {
    key: 'pos.refund',
    module: 'pos',
    label: 'Refund pos',
    description: 'refund access for pos.',
  },
  {
    key: 'alerts.view',
    module: 'alerts',
    label: 'View alerts',
    description: 'view access for alerts.',
  },
  {
    key: 'alerts.acknowledge',
    module: 'alerts',
    label: 'Acknowledge alerts',
    description: 'acknowledge access for alerts.',
  },
  {
    key: 'alerts.dismiss',
    module: 'alerts',
    label: 'Dismiss alerts',
    description: 'dismiss access for alerts.',
  },
] as const;

export type PermissionKey = (typeof PERMISSION_CATALOG)[number]['key'];
const knownKeys: ReadonlySet<string> = new Set(
  PERMISSION_CATALOG.map((permission) => permission.key),
);
export function isPermissionKey(key: string): key is PermissionKey {
  return knownKeys.has(key);
}
export function assertPermissionKey(key: string): asserts key is PermissionKey {
  if (!isPermissionKey(key)) throw new Error(`Unknown permission key: ${key}`);
}
