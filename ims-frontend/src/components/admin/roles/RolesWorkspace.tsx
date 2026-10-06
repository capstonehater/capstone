"use client";
import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import AdminSectionHeader from '@/components/admin/AdminSectionHeader';
import ActionAlert from '@/components/feedback/ActionAlert';
import { createRole, deleteRole, fetchRolePermissions, fetchRoles, updateRole, type ManagedRole, type RoleDraft, type RolePermission } from '@/lib/roles';
import RolePermissionMatrix from './RolePermissionMatrix';
import RoleDialog from './RoleDialog';
import styles from './RolesWorkspace.module.css';
const blank = (): RoleDraft => ({ name: '', description: '', permissionKeys: [] });
const draftOf = (role: ManagedRole): RoleDraft => ({ name: role.name, description: role.description, permissionKeys: [...role.permissionKeys] });
const same = (a: RoleDraft, b: RoleDraft) => a.name === b.name && a.description === b.description && [...a.permissionKeys].sort().join('|') === [...b.permissionKeys].sort().join('|');
export default function RolesWorkspace() {
  const [roles, setRoles] = useState<ManagedRole[]>([]);
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RoleDraft>(blank);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [modal, setModal] = useState<'create' | 'delete' | null>(null);
  const [newDraft, setNewDraft] = useState<RoleDraft>(blank);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [createValidationAttempted, setCreateValidationAttempted] = useState(false);
  const [editValidationAttempted, setEditValidationAttempted] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const selected = roles.find((role) => role.id === selectedId);
  const dirty = Boolean(editing && selected && !same(draft, draftOf(selected)));
  const createDirty = modal === 'create' && !same(newDraft, blank());
  async function load() {
    setLoading(true); setError(null);
    try {
      const [roleData, permissionData] = await Promise.all([fetchRoles(), fetchRolePermissions()]);
      setRoles(roleData.roles); setPermissions(permissionData.permissions);
      setSelectedId((id) => roleData.roles.some((role) => role.id === id) ? id : roleData.roles[0]?.id ?? null);
      setEditing(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load roles.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!dirty && !createDirty) return;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const navigation = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('a[href]')) return;
      if (!window.confirm('Discard your unsaved role changes?')) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('beforeunload', handler);
    document.addEventListener('click', navigation, true);
    return () => { window.removeEventListener('beforeunload', handler); document.removeEventListener('click', navigation, true); };
  }, [dirty, createDirty]);
  const discard = () => !dirty || window.confirm('Discard your unsaved role changes?');
  function choose(role: ManagedRole) { if (busy || !discard()) return; setSelectedId(role.id); setEditing(false); setError(null); }
  function closeDialog() {
    if (busy) return;
    if (createDirty) { setConfirmDiscard(true); return; }
    setModal(null); setDialogError(null);
  }
  function discardNewRole() {
    setConfirmDiscard(false);
    setModal(null);
    setNewDraft(blank());
    setCreateValidationAttempted(false);
    setDialogError(null);
  }
  async function save() {
    if (!selected || busy) return;
    setEditValidationAttempted(true);
    if (!draft.name.trim() || !draft.description.trim() || !draft.permissionKeys.length) return;
    setBusy(true); setError(null);
    try {
      const { role } = await updateRole(selected, { ...draft, name: draft.name.trim() });
      setRoles((items) => items.map((item) => item.id === role.id ? role : item)); setEditing(false); setNotice('Role updated successfully.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update role.'); }
    finally { setBusy(false); }
  }
  async function create() {
    if (busy) return;
    setCreateValidationAttempted(true);
    if (!newDraft.name.trim() || !newDraft.description.trim() || !newDraft.permissionKeys.length) return;
    setBusy(true); setDialogError(null);
    try {
      const { role } = await createRole({ ...newDraft, name: newDraft.name.trim() });
      setRoles((items) => [...items, role]); setSelectedId(role.id); setEditing(false); setModal(null); setSearch(''); setNotice('Role created successfully.');
    } catch (reason) { setDialogError(reason instanceof Error ? reason.message : 'Unable to create role.'); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!selected) return;
    setBusy(true); setDialogError(null);
    try {
      await deleteRole(selected); const remaining = roles.filter((role) => role.id !== selected.id);
      setRoles(remaining); setSelectedId(remaining[0]?.id ?? null); setEditing(false); setModal(null); setNotice('Role deleted successfully.');
    } catch (reason) { setDialogError(reason instanceof Error ? reason.message : 'Unable to delete role.'); }
    finally { setBusy(false); }
  }
  const visible = roles.filter((role) => `${role.name} ${role.description}`.toLowerCase().includes(search.toLowerCase()));
  const adminEmpty = selected?.key === 'ADMINISTRATOR' && !draft.permissionKeys.length;
  return <div className={styles.workspace}>
    <AdminSectionHeader title="Roles & Permissions" description="Manage user roles and control feature access." />
    <p className={styles.notice}>Role grants control frontend navigation and actions after the session refreshes. Server endpoints continue to enforce their existing authorization rules.</p>
    {notice && <ActionAlert tone="success" title="Saved" message={notice} onDismiss={() => setNotice(null)} />}
    {error && <div><ActionAlert tone="error" title="Unable to complete request" message={error} onDismiss={() => setError(null)} /><button className={styles.secondary} disabled={busy} onClick={() => { if (discard()) void load(); }}>Reload roles</button></div>}
    {loading ? <p className={styles.empty} role="status">Loading roles and permission catalog...</p> : <div className={styles.layout}>
      <aside className={styles.panel} aria-label="Roles">
        <div className={styles.listHeader}><h2>Roles <small>{roles.length}</small></h2><button disabled={busy || !!error} className={styles.primary} onClick={() => { if (!discard()) return; setEditing(false); setNewDraft(blank()); setCreateValidationAttempted(false); setDialogError(null); setModal('create'); }}>+ Create Role</button></div>
        <label className={styles.search}>Search roles<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search roles..." /></label>
        <div className={styles.roleList}>{visible.length ? visible.map((role) => <button type="button" className={styles.roleItem} aria-pressed={selectedId === role.id} disabled={busy} key={role.id} onClick={() => choose(role)}><strong>{role.name}</strong><span>{role.description || 'No description'}</span><small>{role.memberCount} {role.memberCount === 1 ? 'member' : 'members'}{role.isProtected ? ' · Protected' : ''}</small></button>) : <p className={styles.empty}>{roles.length ? 'No roles match your search.' : 'No roles yet. Create one to get started.'}</p>}</div>
      </aside>
      <section className={styles.panel} aria-label="Selected role details">
        {!selected ? <p className={styles.empty}>Select a role to review its permissions.</p> : <form noValidate onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <div className={styles.detailHeader}><div><h2>{selected.name}</h2><p>{selected.description || 'No description'}</p>{selected.isProtected && <span className={styles.badge}>Protected System Role</span>}</div><div className={styles.actions}>
            {!editing && <button type="button" className={styles.secondary} disabled={busy} onClick={() => { setDraft(draftOf(selected)); setEditValidationAttempted(false); setEditing(true); }}>Edit Role</button>}
            <button type="button" className={styles.danger} disabled={busy || selected.isProtected || selected.isSystem || selected.memberCount > 0} title={selected.isProtected ? 'Protected roles cannot be deleted' : selected.memberCount ? 'Roles with members cannot be deleted' : 'Delete role'} onClick={() => { if (!discard()) return; setEditing(false); setDialogError(null); setModal('delete'); }}>Delete Role</button>
          </div></div>
          {editing && <RoleFields validationAttempted={editValidationAttempted} draft={draft} onChange={setDraft} disabled={busy} />}
          <div className={styles.matrixHeading}><h3>Permissions</h3><span>{(editing ? draft.permissionKeys : selected.permissionKeys).length} enabled</span></div>
          {editing && editValidationAttempted && !draft.permissionKeys.length && <p role="alert" className={styles.error}>Select at least one permission.</p>}
          <RolePermissionMatrix permissions={permissions} selected={editing ? draft.permissionKeys : selected.permissionKeys} disabled={!editing || busy} onChange={(keys) => setDraft((value) => ({ ...value, permissionKeys: keys }))} />
          {adminEmpty && editing && <p role="alert" className={styles.error}>Administrator must retain at least one permission.</p>}
          {editing && <footer className={styles.saveBar}><span aria-live="polite">{dirty ? 'You have unsaved changes.' : 'No changes yet.'}</span><div className={styles.actions}><button type="button" disabled={busy} className={styles.secondary} onClick={() => { if (discard()) setEditing(false); }}>Cancel</button><button className={styles.primary} disabled={busy || !dirty || !draft.name.trim() || adminEmpty}>{busy ? 'Saving...' : 'Update Role'}</button></div></footer>}
        </form>}
      </section>
    </div>}
    {modal && <RoleDialog title={modal === 'create' ? 'Create Role' : 'Delete Role'} description={modal === 'create' ? 'Set a role name and choose the permissions this role can access.' : undefined} busy={busy} onClose={closeDialog} footer={modal === 'create' ? <button form="create-role-form" className={styles.primary} disabled={busy}>{busy ? 'Creating...' : 'Create Role'}</button> : <button type="button" className={styles.danger} onClick={() => void remove()} disabled={busy}>{busy ? 'Deleting...' : 'Delete Role'}</button>}>
      {dialogError && <p className={styles.error} role="alert">{dialogError}</p>}
      {modal === 'create' ? <form noValidate id="create-role-form" onSubmit={(event) => { event.preventDefault(); void create(); }}><RoleFields validationAttempted={createValidationAttempted} draft={newDraft} onChange={setNewDraft} disabled={busy} /><h3>Permissions <span className={styles.requiredMark} aria-hidden="true">*</span></h3>{createValidationAttempted && !newDraft.permissionKeys.length && <p role="alert" className={styles.error}>Select at least one permission.</p>}<RolePermissionMatrix permissions={permissions} selected={newDraft.permissionKeys} disabled={busy} onChange={(keys) => setNewDraft((value) => ({ ...value, permissionKeys: keys }))} /></form> : <p>Delete <strong>{selected?.name}</strong>? This permanently removes the role and its permission configuration.</p>}
    </RoleDialog>}
    {confirmDiscard && <RoleDialog title="Discard unfinished role?" busy={false} className={styles.discardDialog}
      onClose={() => setConfirmDiscard(false)}
      footer={<>
        <button type="button" autoFocus className={styles.secondary} onClick={() => setConfirmDiscard(false)}>Keep Editing</button>
        <button type="button" className={styles.discardButton} onClick={discardNewRole}>Discard Role</button>
      </>}>
      <div className={styles.discardContent}>
        <span className={styles.discardIcon}><AlertTriangle size={24} aria-hidden="true" /></span>
        <div><p>Your role has unsaved changes.</p><p>Discarding will remove the name, description, and permission selections you entered.</p></div>
      </div>
    </RoleDialog>}
  </div>;
}
function RoleFields({ draft, onChange, disabled, validationAttempted = false }: { draft: RoleDraft; onChange: (value: RoleDraft) => void; disabled: boolean; validationAttempted?: boolean }) {
  const nameError = validationAttempted && !draft.name.trim();
  const descriptionError = validationAttempted && !draft.description.trim();
  return <div className={styles.fields}>
    <label><span>Role Name <span className={styles.requiredMark} aria-hidden="true">*</span></span>
      <input required maxLength={80} placeholder="Ex. Inventory Clerk" value={draft.name} disabled={disabled}
        aria-invalid={nameError} aria-describedby={nameError ? 'role-name-error' : undefined}
        onChange={(event) => onChange({ ...draft, name: event.target.value })} />
      {nameError && <span id="role-name-error" role="alert" className={styles.fieldError}>Role name is required.</span>}
    </label>
    <label><span>Description <span className={styles.requiredMark} aria-hidden="true">*</span></span>
      <textarea required maxLength={500} rows={3} placeholder="Ex. Manages stock runs and records inventory waste." value={draft.description} disabled={disabled}
        aria-invalid={descriptionError} aria-describedby={descriptionError ? 'role-description-error' : undefined}
        onChange={(event) => onChange({ ...draft, description: event.target.value })} />
      {descriptionError && <span id="role-description-error" role="alert" className={styles.fieldError}>Description is required.</span>}
    </label>
  </div>;
}

