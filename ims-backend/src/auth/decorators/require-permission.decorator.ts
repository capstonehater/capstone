import { SetMetadata } from '@nestjs/common';
import {
  assertPermissionKey,
  type PermissionKey,
} from '../rbac/permission-catalog';

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';

/** All listed permissions are required. Empty or unknown requirements are errors. */
export function RequirePermission(...permissions: PermissionKey[]) {
  if (!permissions.length)
    throw new Error('RequirePermission needs at least one permission');
  permissions.forEach(assertPermissionKey);
  return SetMetadata(REQUIRED_PERMISSIONS_KEY, [...new Set(permissions)]);
}
