"use client";
import type { RolePermission } from '@/lib/roles';
import styles from './RolesWorkspace.module.css';
export default function RolePermissionMatrix({ permissions, selected, disabled = false, onChange }: {
  permissions: RolePermission[]; selected: string[]; disabled?: boolean; onChange: (keys: string[]) => void;
}) {
  const groups = new Map<string, RolePermission[]>();
  for (const permission of permissions) groups.set(permission.module, [...(groups.get(permission.module) ?? []), permission]);
  if (!permissions.length) return <p className={styles.empty}>No permissions are available in the server catalog.</p>;
  return <div className={styles.matrix}>{Array.from(groups, ([module, entries]) => <fieldset key={module}>
    <legend>{module.replace(/([a-z])([A-Z])/g, '$1 $2')}</legend>
    {entries.map((permission) => {
      const enabled = selected.includes(permission.key);
      return <label className={styles.permission} key={permission.id}>
        <span><strong>{permission.label}</strong><small>{permission.description}</small></span>
        <span className={styles.toggle}><input type="checkbox" role="switch" checked={enabled} disabled={disabled} onChange={() => onChange(enabled ? selected.filter((key) => key !== permission.key) : [...selected, permission.key])} /><span aria-hidden="true">{enabled ? 'ON' : 'OFF'}</span></span>
      </label>;
    })}
  </fieldset>)}</div>;
}
