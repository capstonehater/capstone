import { apiJsonFetch } from './api';
export type AssignedUserRole = { id: string; key: string; name: string; description: string; isProtected: boolean; isCompatibility: boolean; assignedAt: string; assignedByUserId: string | null };
export type UserRolesResponse = { roles: AssignedUserRole[]; effectivePermissions: string[] };
export const fetchUserRoles = (id: string) => apiJsonFetch<UserRolesResponse>(`/users/${encodeURIComponent(id)}/roles`, { cache: 'no-store' });
export const assignUserRoles = (id: string, roleIds: string[]) => apiJsonFetch(`/users/${encodeURIComponent(id)}/roles`, { method: 'POST', body: JSON.stringify({ roleIds }) });
export const removeUserRole = (id: string, roleId: string) => apiJsonFetch(`/users/${encodeURIComponent(id)}/roles/${encodeURIComponent(roleId)}`, { method: 'DELETE' });
