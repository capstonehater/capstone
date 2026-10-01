"use client";
import { useEffect, useState } from 'react';
import { fetchRoles, type ManagedRole } from '@/lib/roles';
import { assignUserRoles, fetchUserRoles, removeUserRole, type AssignedUserRole, type UserRolesResponse } from '@/lib/users';
import RoleDialog from '@/components/admin/roles/RoleDialog';
import styles from './UserRolesSection.module.css';
export default function UserRolesSection({ userId, userName, isSelf, onChanged }: { userId: string; userName: string; isSelf: boolean; onChanged: () => void }) {
  const [data, setData] = useState<UserRolesResponse | null>(null);
  const [available, setAvailable] = useState<ManagedRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [removing, setRemoving] = useState<AssignedUserRole | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    fetchUserRoles(userId).then((value) => { if (active) setData(value); }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load assigned roles.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, revision]);
  async function openAssign() {
    setBusy(true); setError(null);
    try {
      const [catalog, assigned] = await Promise.all([fetchRoles(), fetchUserRoles(userId)]);
      setAvailable(catalog.roles); setData(assigned); setSelection([]); setDialogError(null); setAssigning(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load available roles.'); }
    finally { setBusy(false); }
  }
  function close() {
    if (busy || (assigning && selection.length && !window.confirm('Discard your selected roles?'))) return;
    setAssigning(false); setRemoving(null); setDialogError(null);
  }
  async function save() {
    setBusy(true); setDialogError(null);
    try {
      if (assigning) await assignUserRoles(userId, selection);
      else if (removing) await removeUserRole(userId, removing.id);
      setAssigning(false); setRemoving(null); setSelection([]);
      if (isSelf) { window.location.assign('/login'); return; }
      onChanged(); setNotice('Roles updated. The user must sign in again.'); setRevision((value) => value + 1);
    } catch (reason) { setDialogError(reason instanceof Error ? reason.message : 'Unable to update assigned roles.'); }
    finally { setBusy(false); }
  }
  return <section className={styles.panel} aria-label="Assigned roles">
    <header><div><h3>Roles</h3><p>Assigned roles control visible features and actions. Server access continues to follow the existing authorization rules.</p></div><button className={styles.primary} onClick={() => void openAssign()} disabled={loading || busy}>+ Assign Role</button></header>
    {loading ? <p role="status">Loading assigned roles...</p> : error ? <div role="alert"><p>{error}</p><button onClick={() => setRevision((value) => value + 1)}>Retry</button></div> : <>
      <div className={styles.roles}>{data?.roles.length ? data.roles.map((role) => <div className={styles.role} key={role.id}><span><strong>{role.name}</strong>{role.isCompatibility && <small>Linked to legacy role</small>}</span><button type="button" disabled={busy || role.isCompatibility} title={role.isCompatibility ? 'Use Edit User to change the legacy role' : `Remove ${role.name}`} aria-label={`Remove ${role.name}`} onClick={() => { setRemoving(role); setDialogError(null); }}>Remove</button></div>) : <p>No assigned roles.</p>}</div>
      <p className={styles.hint}>Legacy-linked membership changes through Edit User. Assigned permissions do not override inactive account status.</p>
    </>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {(assigning || removing) && <RoleDialog title={assigning ? 'Assign Roles' : 'Remove Role'} busy={busy} onClose={close}>
      <p><strong>User:</strong> {userName}</p>
      <p className={styles.hint}>{isSelf ? 'Saving will end your current session. Sign in again afterward.' : 'Saving will revoke this user\'s active sessions.'}</p>
      {dialogError && <p role="alert" className={styles.error}>{dialogError}</p>}
      {assigning ? <div className={styles.options}>{available.length ? available.map((role) => {
        const assigned = data?.roles.some((item) => item.id === role.id) ?? false;
        return <label key={role.id}><input type="checkbox" disabled={busy || assigned} checked={assigned || selection.includes(role.id)} onChange={(event) => setSelection((ids) => event.target.checked ? [...ids, role.id] : ids.filter((id) => id !== role.id))} /><span><strong>{role.name}</strong><small>{assigned ? 'Already assigned' : role.description || 'No description'}</small></span></label>;
      }) : <p>No roles are available. Create roles in Roles & Permissions first.</p>}</div> : <p>Remove <strong>{removing?.name}</strong> from <strong>{userName}</strong>? The role itself will not be deleted.</p>}
      <footer className={styles.actions}><button disabled={busy} onClick={close}>Cancel</button><button className={assigning ? styles.primary : styles.danger} disabled={busy || (assigning && !selection.length)} onClick={() => void save()}>{busy ? 'Saving...' : assigning ? 'Save Roles' : 'Remove Role'}</button></footer>
    </RoleDialog>}
  </section>;
}
