import { apiJsonFetch } from './api';
export type ManagedRole = { id: string; key: string; name: string; description: string; isSystem: boolean; isProtected: boolean; revision: number; memberCount: number; permissionKeys: string[] };
export type RolePermission = { id: string; key: string; module: string; label: string; description: string };
export type RoleDraft = { name: string; description: string; permissionKeys: string[] };
export const fetchRoles = () => apiJsonFetch<{ roles: ManagedRole[] }>('/roles', { cache: 'no-store' });
export const fetchRolePermissions = () => apiJsonFetch<{ permissions: RolePermission[] }>('/roles/permissions', { cache: 'no-store' });
export const createRole = (draft: RoleDraft) => apiJsonFetch<{ role: ManagedRole }>('/roles', { method: 'POST', body: JSON.stringify(draft) });
export const updateRole = (role: ManagedRole, draft: RoleDraft) => apiJsonFetch<{ role: ManagedRole }>(`/roles/${encodeURIComponent(role.id)}`, { method: 'PATCH', body: JSON.stringify({ ...draft, revision: role.revision }) });
export const deleteRole = (role: ManagedRole) => apiJsonFetch(`/roles/${encodeURIComponent(role.id)}`, { method: 'DELETE', body: JSON.stringify({ revision: role.revision }) });
