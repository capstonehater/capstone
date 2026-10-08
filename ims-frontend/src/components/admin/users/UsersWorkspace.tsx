"use client";
import PageSkeleton from "@/components/loading/PageSkeleton";
import SearchInput from "@/components/ui/SearchInput";
import StyledSelect from "@/components/admin/StyledSelect";
import { PermissionAction } from "@/components/auth/PermissionGuard";

import UserEffectivePermissions from "./UserEffectivePermissions";
import UserRolesSection from "./UserRolesSection";
import AdminSelect from "@/components/admin/AdminSelect";

import readable from "@/components/admin/ReadableWorkspace.module.css";

import SelectableTableRow from "@/components/admin/SelectableTableRow";
import styles from "./UsersWorkspace.module.css";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  Ban,
  CheckCircle2,
  KeyRound,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
  UsersRound,
  XCircle,
} from "lucide-react";
import {
  InventoryField,
  inventoryInputClasses,
} from "@/components/admin/inventory/InventoryField";
import InventoryModal from "@/components/admin/inventory/InventoryModal";
import ActionAlert from "@/components/feedback/ActionAlert";
import { useAuthStore } from "@/store/authStore";
import {
  createManagedUser,
  deleteManagedUser,
  getManagedUser,
  listManagedUserActivity,
  listManagedUserSessions,
  listManagedUsers,
  reactivateManagedUser,
  requestManagedUserPasswordReset,
  revokeAllManagedUserSessions,
  revokeManagedUserSession,
  suspendManagedUser,
  updateManagedUser,
  type AccountStatus,
  type AssignableUserRole,
  type CreateUserInput,
  type ListUsersResponse,
  type UserActivityItem,
  type UserDetail,
  type UserManagementRole,
  type UserSession,
} from "@/lib/user-management";

type DetailTab = "overview" | "permissions" | "activity" | "sessions";
type DialogState =
  | { type: "create" }
  | { type: "edit"; user: UserDetail }
  | { type: "suspend"; user: UserDetail }
  | { type: "reactivate"; user: UserDetail }
  | { type: "password-reset"; user: UserDetail }
  | { type: "delete"; user: UserDetail }
  | { type: "revoke-session"; user: UserDetail; session: UserSession }
  | { type: "revoke-all-sessions"; user: UserDetail };

const PAGE_SIZE = 10;
const ACTIVITY_PAGE_SIZE = 8;

const roleLabels: Record<UserManagementRole, string> = {
  ADMINISTRATOR: "Administrator",
  MANAGER: "Manager",
  STAFF: "Staff",
};

const statusLabels: Record<AccountStatus, string> = {
  PENDING: "Pending",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
};

function parsePage(value: string | null) {
  const page = Number(value);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function parseRole(value: string | null): UserManagementRole | "" {
  if (value === "ADMINISTRATOR" || value === "MANAGER" || value === "STAFF") {
    return value;
  }

  return "";
}

function parseStatus(value: string | null): AccountStatus | "" {
  if (value === "PENDING" || value === "ACTIVE" || value === "INACTIVE") {
    return value;
  }

  return "";
}

function parseTab(value: string | null): DetailTab {
  if (value === "permissions" || value === "activity" || value === "sessions") {
    return value;
  }

  return "overview";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function initialsFor(name: string) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");

  return initials || "U";
}

function roleTone(role: UserManagementRole) {
  if (role === "ADMINISTRATOR") {
    return "border-purple-200 bg-purple-50 text-purple-700";
  }
  if (role === "MANAGER") {
    return "border-slate-300 bg-slate-100 text-slate-700";
  }
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function statusTone(status: AccountStatus) {
  if (status === "ACTIVE") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "PENDING") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function sessionStatus(session: UserSession) {
  const now = Date.now();
  if (session.revokedAt) {
    return "Revoked";
  }
  if (new Date(session.expiresAt).getTime() <= now) {
    return "Expired";
  }
  if (new Date(session.idleExpiresAt).getTime() <= now) {
    return "Idle expired";
  }
  return "Active";
}

function safeDetailValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  return null;
}

function safeDisplayText(value: string | null | undefined, maxLength = 180) {
  if (!value) {
    return null;
  }

  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function formatActivity(item: UserActivityItem) {
  const details = item.details;

  switch (item.type) {
    case "SESSION":
      return {
        title: "Session activity",
        description: safeDetailValue(details.revokeReason) ?? "Session was seen",
      };
    case "ORDER":
      return {
        title: "Order activity",
        description: safeDetailValue(details.status) ?? "Order record attributed",
      };
    case "STOCK_RUN":
      return {
        title: "Stock run activity",
        description: safeDetailValue(details.name) ?? "Stock run record attributed",
      };
    case "INVENTORY_TRANSACTION":
      return {
        title: "Inventory transaction",
        description:
          safeDetailValue(details.transactionType) ??
          safeDetailValue(details.sourceType) ??
          "Inventory record attributed",
      };
    case "ORDER_REVERSAL":
      return {
        title: "Order reversal",
        description: safeDetailValue(details.reversalType) ?? "Reversal record attributed",
      };
    case "PRODUCT_ARCHIVE":
      return {
        title: "Product archive",
        description:
          safeDetailValue(details.productName) ??
          safeDetailValue(details.archiveReason) ??
          "Product archive record attributed",
      };
    case "ALERT_ACKNOWLEDGEMENT":
      return {
        title: "Alert acknowledgement",
        description: safeDetailValue(details.alertType) ?? "Alert was acknowledged",
      };
    case "ALERT_DISMISSAL":
      return {
        title: "Alert dismissal",
        description: safeDetailValue(details.alertType) ?? "Alert was dismissed",
      };
    default:
      return {
        title: "User activity",
        description: "Activity record attributed",
      };
  }
}

function useUserQueryState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateQuery(
    patch: Record<string, string | null | undefined>,
    mode: "push" | "replace" = "push",
  ) {
    const next = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(patch)) {
      if (!value) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }

    const target = next.toString() ? `${pathname}?${next.toString()}` : pathname;
    if (mode === "replace") {
      router.replace(target, { scroll: false });
      return;
    }

    router.push(target, { scroll: false });
  }

  return { searchParams, updateQuery };
}

export default function UsersWorkspace() {
  const currentUser = useAuthStore((state) => state.user);
  const { searchParams, updateQuery } = useUserQueryState();
  const search = searchParams.get("search") ?? "";
  const role = parseRole(searchParams.get("role"));
  const status = parseStatus(searchParams.get("status"));
  const page = parsePage(searchParams.get("page"));
  const selectedUserId = searchParams.get("userId");
  const tab = parseTab(searchParams.get("tab"));

  const [searchInput, setSearchInput] = useState(search);
  const [list, setList] = useState<ListUsersResponse | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [activity, setActivity] = useState<UserActivityItem[]>([]);
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotalPages, setActivityTotalPages] = useState(0);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [userAccessRevision, setUserAccessRevision] = useState(0);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const users = list?.items ?? [];
  const isSelf = Boolean(currentUser?.id && detail?.id === currentUser.id);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (searchInput === search) {
        return;
      }

      updateQuery(
        {
          search: searchInput.trim() || null,
          page: null,
        },
        "replace",
      );
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [search, searchInput, updateQuery]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadList() {
      setListLoading(true);
      setListError(null);

      try {
        const response = await listManagedUsers({
          search: search || undefined,
          role: role || undefined,
          status: status || undefined,
          page,
          pageSize: PAGE_SIZE,
          signal: controller.signal,
        });
        setList(response);
      } catch (error) {
        if (!controller.signal.aborted) {
          setListError(error instanceof Error ? error.message : "Failed to load users");
        }
      } finally {
        if (!controller.signal.aborted) {
          setListLoading(false);
        }
      }
    }

    void loadList();

    return () => controller.abort();
  }, [page, role, search, status]);

  useEffect(() => {
    if (!selectedUserId) {
      setDetail(null);
      setDetailError(null);
      return;
    }

    const controller = new AbortController();
    const userId = selectedUserId;

    async function loadDetail() {
      setDetailLoading(true);
      setDetailError(null);

      try {
        setDetail(await getManagedUser(userId, controller.signal));
      } catch (error) {
        if (!controller.signal.aborted) {
          setDetailError(
            error instanceof Error ? error.message : "Failed to load user detail",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setDetailLoading(false);
        }
      }
    }

    void loadDetail();

    return () => controller.abort();
  }, [selectedUserId]);

  useEffect(() => {
    setActivityPage(1);
  }, [selectedUserId]);

  async function refreshList() {
    const response = await listManagedUsers({
      search: search || undefined,
      role: role || undefined,
      status: status || undefined,
      page,
      pageSize: PAGE_SIZE,
    });
    setList(response);
    return response;
  }

  async function refreshDetail(userId = selectedUserId) {
    if (!userId) {
      return null;
    }

    const nextDetail = await getManagedUser(userId);
    setDetail(nextDetail);
    return nextDetail;
  }

  const loadSessions = useCallback(async (userId: string, signal?: AbortSignal) => {
    setSessionsLoading(true);
    setSessionsError(null);

    try {
      const response = await listManagedUserSessions(userId, signal);
      setSessions(response.sessions);
    } catch (error) {
      if (!signal?.aborted) {
        setSessionsError(
          error instanceof Error ? error.message : "Failed to load user sessions",
        );
      }
    } finally {
      if (!signal?.aborted) {
        setSessionsLoading(false);
      }
    }
  }, []);

  const loadActivity = useCallback(async (
    userId: string,
    nextPage: number,
    pageSize = ACTIVITY_PAGE_SIZE,
    signal?: AbortSignal,
  ) => {
    setActivityLoading(true);
    setActivityError(null);

    try {
      const response = await listManagedUserActivity(userId, {
        page: nextPage,
        pageSize,
        signal,
      });
      setActivity(response.items);
      setActivityTotalPages(response.pagination.totalPages);
    } catch (error) {
      if (!signal?.aborted) {
        setActivityError(
          error instanceof Error ? error.message : "Failed to load user activity",
        );
      }
    } finally {
      if (!signal?.aborted) {
        setActivityLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!selectedUserId || (tab !== "sessions" && tab !== "overview")) {
      return;
    }

    const controller = new AbortController();

    void loadSessions(selectedUserId, controller.signal);

    return () => controller.abort();
  }, [loadSessions, selectedUserId, tab]);

  useEffect(() => {
    if (!selectedUserId || (tab !== "activity" && tab !== "overview")) {
      return;
    }

    const controller = new AbortController();

    void loadActivity(
      selectedUserId,
      tab === "overview" ? 1 : activityPage,
      tab === "overview" ? 5 : ACTIVITY_PAGE_SIZE,
      controller.signal,
    );

    return () => controller.abort();
  }, [activityPage, loadActivity, selectedUserId, tab]);

  function resetDialogFeedback() {
    setDialogError(null);
  }


  async function handleCreate(input: CreateUserInput) {
    setSubmitting(true);
    resetDialogFeedback();

    try {
      await createManagedUser(input);
      await refreshList();
      setDialog(null);
      setNotice("User created. Account setup was initiated and the user remains Pending until completion.");

    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(input: CreateUserInput) {
    if (!detail) {
      return;
    }

    const patch = {
      firstName: input.firstName,
      middleInitial: input.middleInitial,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      ...(!isSelf && detail.role !== "MANAGER" && input.role !== detail.role
        ? { role: input.role }
        : {}),
    };

    setSubmitting(true);
    resetDialogFeedback();

    try {
      await updateManagedUser(detail.id, patch);
      await Promise.all([refreshList(), refreshDetail(detail.id)]);
      setDialog(null);
      setNotice("User updated.");
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "Failed to update user");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAction(action: Exclude<DialogState["type"], "create" | "edit">) {
    if (!dialog || !("user" in dialog)) {
      return;
    }

    setSubmitting(true);
    resetDialogFeedback();

    try {
      if (action === "suspend") {
        await suspendManagedUser(dialog.user.id);
        await Promise.all([refreshList(), refreshDetail(dialog.user.id), loadSessions(dialog.user.id)]);
        setNotice("User suspended and active sessions were revoked.");
      } else if (action === "reactivate") {
        await reactivateManagedUser(dialog.user.id);
        await Promise.all([refreshList(), refreshDetail(dialog.user.id)]);
        setNotice("User reactivated.");
      } else if (action === "password-reset") {
        await requestManagedUserPasswordReset(dialog.user.id);
        setNotice(
          dialog.user.status === "PENDING"
            ? "Account setup was sent again."
            : "Password reset was initiated.",
        );
      } else if (action === "delete") {
        await deleteManagedUser(dialog.user.id);
        await refreshList();
        updateQuery({ userId: null, tab: null }, "push");
        setNotice("User deleted.");
      } else if (action === "revoke-session" && "session" in dialog) {
        await revokeManagedUserSession(dialog.user.id, dialog.session.id);
        await loadSessions(dialog.user.id);
        setNotice("Session revoked.");
      } else if (action === "revoke-all-sessions") {
        const result = await revokeAllManagedUserSessions(dialog.user.id);
        await loadSessions(dialog.user.id);
        setNotice(`${result.revokedCount} active session${result.revokedCount === 1 ? "" : "s"} revoked.`);
      }

      setDialog(null);
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!list && !listError) return <PageSkeleton page="users" header={false} />;

  return (
    <div className={`${styles.workspace} ${readable.readable}`}>
      {workspaceError ? (
        <ActionAlert tone="error" title="Action failed" message={workspaceError} onDismiss={() => setWorkspaceError(null)} />
      ) : null}
      {listError ? <ActionAlert tone="error" title="Unable to load users" message={listError} /> : null}
      {notice ? (
        <ActionAlert tone="success" title="Success!" message={notice} onDismiss={() => setNotice(null)} />
      ) : null}

      <section className={styles.topPanel}>
        <header><h1>USERS</h1><p>Manage staff accounts, roles, permissions, and account status.</p></header>
      </section>
      <div className={styles.panels}>
        <section className={`${styles.directory} ${selectedUserId ? styles.hideListOnMobile : ""}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#232d46]">
                Account Directory
              </p>
              <h2 className="text-lg font-semibold text-slate-950">User List</h2>
            </div>
            <PermissionAction permission="users.manage"><button type="button" onClick={() => { resetDialogFeedback(); setDialog({ type: "create" }); }} style={{ borderRadius: 12 }} className="rounded-lg bg-[#232d46] px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">+ Add User</button></PermissionAction>
          </div>

          <div className={styles.filters}>
            <label className="relative block">
              <span className="sr-only">Search users</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <SearchInput
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="w-full rounded-full border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#f45a1f] focus:ring-2 focus:ring-[#f45a1f]/15"
                placeholder="Search users by name or email..."
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <FilterSelect
                label="Role"
                value={role}
                onChange={(value) =>
                  updateQuery({ role: value || null, page: null }, "push")
                }
                options={[
                  ["", "All Roles"],
                  ["ADMINISTRATOR", "Administrator"],
                  ["MANAGER", "Manager"],
                  ["STAFF", "Staff"],
                ]}
              />
              <FilterSelect
                label="Status"
                value={status}
                onChange={(value) =>
                  updateQuery({ status: value || null, page: null }, "push")
                }
                options={[
                  ["", "All Statuses"],
                  ["PENDING", "Pending"],
                  ["ACTIVE", "Active"],
                  ["INACTIVE", "Inactive"],
                ]}
              />
            </div>
          </div>

          <div className={styles.userListScroll}>
            {listLoading ? (
              <LoadingBlock label="Loading users..." />
            ) : users.length === 0 ? (
              <EmptyBlock
                title="No users found"
                description={
                  search || role || status
                    ? "Try adjusting the search or filters."
                    : "Create the first managed account when ready."
                }
              />
            ) : (
              <table className="w-full table-fixed border-collapse text-xs">
                <caption className="sr-only">Select a user to view account details.</caption>
                <thead className="sticky top-0 bg-slate-100 text-left text-[11px] font-bold text-slate-500">
                  <tr><th scope="col" className="w-[52%] px-3 py-2">User</th><th scope="col" className="w-[26%] px-2 py-2 text-center">Role</th><th scope="col" className="w-[22%] px-2 py-2 text-center">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {users.map((user) => (
                    <SelectableTableRow key={user.id} selected={selectedUserId === user.id} onSelect={() => updateQuery({ userId: user.id, tab: selectedUserId === user.id ? tab : "overview" }, "push")}>
                      <td className="px-3 py-2">
                        <p title={user.name} className="mb-1! truncate text-xs font-semibold text-slate-900">{user.name}</p>
                        <p title={user.email} className="mb-0! truncate text-[13px] text-slate-500">{user.email}</p>
                      </td>
                      <td className="px-2 py-2 text-center text-xs text-slate-700">{roleLabels[user.role]}</td>
                      <td className="px-2 py-2 text-center text-xs text-slate-700">{statusLabels[user.status]}</td>
                    </SelectableTableRow>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <Pagination
            page={list?.pagination.page ?? 1}
            totalPages={list?.pagination.totalPages ?? 0}
            totalItems={list?.pagination.totalItems ?? 0}
            onPageChange={(nextPage) =>
              updateQuery({ page: nextPage > 1 ? String(nextPage) : null }, "push")
            }
          />
        </section>

      <PermissionAction permission={"users.manage"}><UserFormDialog
        mode={dialog?.type === "edit" ? "edit" : "create"}
        open={dialog?.type === "create" || dialog?.type === "edit"}
        user={dialog?.type === "edit" ? dialog.user : null}
        currentUserId={currentUser?.id ?? null}
        submitting={submitting}
        errorMessage={dialogError}
        onClose={() => {
          resetDialogFeedback();
          setDialog(null);
        }}
        onSubmit={(input) => (dialog?.type === "edit" ? handleEdit(input) : handleCreate(input))}
      /></PermissionAction>

        <section className={`${styles.detailPanel} ${selectedUserId ? "block" : "hidden xl:block"}`}>
          {!selectedUserId ? (
            <EmptyBlock icon={<UsersRound className="h-7 w-7" />} title="Select a user" description="Choose an account to review profile, permissions, activity, and sessions." />
          ) : detailLoading || (detail?.id !== selectedUserId && !detailError) ? (
            <LoadingBlock label="Loading user detail..." />
          ) : detailError ? (
            <EmptyBlock title="Unable to load user" description={detailError} />
          ) : detail ? (
            <div className="space-y-5">
              <button type="button" onClick={() => updateQuery({ userId: null, tab: null }, "push")} className="text-sm font-semibold text-[#232d46] xl:hidden">Back to users</button>
              <UserProfileHeader
                user={detail}
                isSelf={isSelf}
                onEdit={() => setDialog({ type: "edit", user: detail })}
                onSuspend={() => setDialog({ type: "suspend", user: detail })}
                onReactivate={() => setDialog({ type: "reactivate", user: detail })}
                onPasswordReset={() => setDialog({ type: "password-reset", user: detail })}
                onDelete={() => setDialog({ type: "delete", user: detail })}
              />

              {currentUser?.role === "ADMINISTRATOR" && <PermissionAction permission={"users.manage"}><UserRolesSection key={`${detail.id}:${detail.role}`} userId={detail.id} userName={detail.name} isSelf={isSelf} onChanged={() => { setUserAccessRevision(value => value + 1); void loadSessions(detail.id); }} /></PermissionAction>}

              <TabBar
                activeTab={tab}
                onChange={(nextTab) => updateQuery({ tab: nextTab }, "push")}
              />

              {tab === "overview" ? (
                <OverviewTab
                  user={detail}
                  sessions={sessions}
                  sessionsLoading={sessionsLoading}
                  activity={activity}
                  activityLoading={activityLoading}
                />
              ) : null}

              {tab === "permissions" ? <UserEffectivePermissions key={`${detail.id}:${userAccessRevision}`} userId={detail.id} /> : null}

              {tab === "activity" ? (
                <ActivityTab
                  items={activity}
                  loading={activityLoading}
                  error={activityError}
                  page={activityPage}
                  totalPages={activityTotalPages}
                  onPageChange={setActivityPage}
                  onRefresh={() => void loadActivity(detail.id, activityPage)}
                />
              ) : null}

              {tab === "sessions" ? (
                <SessionsTab
                  sessions={sessions}
                  loading={sessionsLoading}
                  error={sessionsError}
                  onRefresh={() => void loadSessions(detail.id)}
                  onRevoke={(session) =>
                    setDialog({ type: "revoke-session", user: detail, session })
                  }
                  onRevokeAll={() => setDialog({ type: "revoke-all-sessions", user: detail })}
                />
              ) : null}
            </div>
          ) : null}
        </section>
      </div>



      <PermissionAction permission={dialog?.type === "revoke-session" || dialog?.type === "revoke-all-sessions" ? "users.sessions.revoke" : "users.manage"}><ConfirmDialog
        dialog={dialog}
        submitting={submitting}
        errorMessage={dialogError}
        onClose={() => {
          resetDialogFeedback();
          setDialog(null);
        }}
        onConfirm={handleAction}
      /></PermissionAction>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-bold text-white">
      {initialsFor(name)}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <AdminSelect
        label={label}
        value={value}
        onChange={onChange}
        options={options.map(([optionValue, optionLabel]) => ({
          value: optionValue,
          label: optionLabel,
        }))}
      />
    </div>
  );
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function EmptyBlock({
  icon,
  title,
  description,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
      {icon ? <div className="mb-3 text-slate-400">{icon}</div> : null}
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  totalItems,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Previous
      </button>
      <div className="text-center text-xs text-slate-500">
        <p>{totalItems} total users</p>
        <p>
          Page {totalPages === 0 ? 0 : page} of {totalPages}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={totalPages === 0 || page >= totalPages}
        className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Next
      </button>
    </div>
  );
}

function UserProfileHeader({
  user,
  isSelf,
  onEdit,
  onSuspend,
  onReactivate,
  onPasswordReset,
  onDelete,
}: {
  user: UserDetail;
  isSelf: boolean;
  onEdit: () => void;
  onSuspend: () => void;
  onReactivate: () => void;
  onPasswordReset: () => void;
  onDelete: () => void;
}) {
  const canSuspend = user.status === "ACTIVE" && !isSelf;
  const canReactivate = user.status === "INACTIVE";
  const canDelete = !isSelf;

  return (
    <div className={styles.profileCard}>
      <div className={styles.profileHeader}>
        <div className={styles.profileIdentity}>
          <Avatar name={user.name} />
          <div className="min-w-0">
            <h2 className={styles.profileName}>{user.name}</h2>
            <p className={styles.profileEmail}>{user.email}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${roleTone(user.role)}`}>
                {roleLabels[user.role]}
              </span>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(user.status)}`}>
                {statusLabels[user.status]}
              </span>
              {user.role === "MANAGER" ? (
                <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                  Reserved role
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className={styles.profileActions}>
          <PermissionAction permission={"users.manage"}><ActionButton icon={<UserCog className="h-4 w-4" />} onClick={onEdit}>
            Edit
          </ActionButton></PermissionAction>
          <PermissionAction permission={"users.manage"}><ActionButton icon={<KeyRound className="h-4 w-4" />} onClick={onPasswordReset}>
            {user.status === "PENDING" ? "Send Setup" : "Reset Password"}
          </ActionButton></PermissionAction>
          {canSuspend ? (
            <PermissionAction permission={"users.manage"}><ActionButton icon={<Ban className="h-4 w-4" />} tone="danger" onClick={onSuspend}>
              Suspend
            </ActionButton></PermissionAction>
          ) : null}
          {canReactivate ? (
            <PermissionAction permission={"users.manage"}><ActionButton icon={<CheckCircle2 className="h-4 w-4" />} tone="success" onClick={onReactivate}>
              Reactivate
            </ActionButton></PermissionAction>
          ) : null}
          {canDelete ? (
            <PermissionAction permission={"users.manage"}><ActionButton icon={<Trash2 className="h-4 w-4" />} tone="danger" onClick={onDelete}>
              Delete
            </ActionButton></PermissionAction>
          ) : null}
        </div>
      </div>

      <dl className={styles.profileDetails}>
        <ProfileItem label="Employee ID" value={user.id} />
        <ProfileItem label="Phone" value={user.phone ?? "Not provided"} />
        <ProfileItem label="Last Login" value={formatDateTime(user.lastLoginAt)} />
        <ProfileItem label="Joined Date" value={formatDateTime(user.createdAt)} />
      </dl>
    </div>
  );
}

function ProfileItem({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.profileItem}>
      <dt>
        {label}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}

function ActionButton({
  children,
  icon,
  tone = "neutral",
  onClick,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  tone?: "neutral" | "danger" | "success";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
        tone === "danger"
          ? "border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
          : tone === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function TabBar({
  activeTab,
  onChange,
}: {
  activeTab: DetailTab;
  onChange: (tab: DetailTab) => void;
}) {
  const tabs: [DetailTab, string][] = [
    ["overview", "Overview"],
    ["permissions", "Permission"],
    ["activity", "Activity"],
    ["sessions", "Sessions"],
  ];

  return (
    <div className={styles.detailTabs} aria-label="User detail sections">
      {tabs.map(([tab, label]) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          aria-pressed={activeTab === tab}
          className={styles.detailTab}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function OverviewTab({
  user,
  sessions,
  sessionsLoading,
  activity,
  activityLoading,
}: {
  user: UserDetail;
  sessions: UserSession[];
  sessionsLoading: boolean;
  activity: UserActivityItem[];
  activityLoading: boolean;
}) {
  const activeSessions = sessions.filter((session) => sessionStatus(session) === "Active").length;


  return (
    <div className={styles.overviewCards}>
      <SummaryPanel
        icon={<ShieldCheck className="h-5 w-5" />}
        label="Permission Overview"
        value={roleLabels[user.role]}
        detail="View the Permissions tab for effective grants from all assigned roles"
      />
      <SummaryPanel
        icon={<Activity className="h-5 w-5" />}
        label="Recent Activity"
        value={activityLoading ? "Loading" : `${activity.length} shown`}
        detail={activity[0] ? formatActivity(activity[0]).title : "No activity yet"}
      />
      <SummaryPanel
        icon={<UsersRound className="h-5 w-5" />}
        label="Active Sessions"
        value={sessionsLoading ? "Loading" : String(activeSessions)}
        detail={sessionsLoading ? "Checking sessions..." : activeSessions === 0 ? "No active sign-ins" : "Currently signed-in sessions"}
      />
    </div>
  );
}

function SummaryPanel({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className={styles.overviewCard}>
      <div className={styles.overviewCardHeading}>
        <span className={styles.overviewIcon} aria-hidden="true">{icon}</span>
        <p>{label}</p>
      </div>
      <p className={styles.overviewValue}>{value}</p>
      <p className={styles.overviewDetail}>{detail}</p>
    </div>
  );
}

function ActivityTab({
  items,
  loading,
  error,
  page,
  totalPages,
  onPageChange,
  onRefresh,
}: {
  items: UserActivityItem[];
  loading: boolean;
  error: string | null;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
}) {
  if (loading) {
    return <LoadingBlock label="Loading activity..." />;
  }

  if (error) {
    return <EmptyBlock title="Unable to load activity" description={error} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ActionButton icon={<RefreshCw className="h-4 w-4" />} onClick={onRefresh}>
          Refresh
        </ActionButton>
      </div>
      {items.length === 0 ? (
        <EmptyBlock title="No activity" description="No attributable activity records are available for this user." />
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const formatted = formatActivity(item);
            return (
              <div key={`${item.type}:${item.referenceId}:${item.occurredAt}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{formatted.title}</p>
                    <p className="mt-1 text-sm text-slate-500">{formatted.description}</p>
                    <p className="mt-2 break-all text-xs text-slate-400">
                      Reference {item.referenceId}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-slate-500">
                    {formatDateTime(item.occurredAt)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Pagination
        page={page}
        totalPages={totalPages}
        totalItems={items.length}
        onPageChange={onPageChange}
      />
    </div>
  );
}

function SessionsTab({
  sessions,
  loading,
  error,
  onRefresh,
  onRevoke,
  onRevokeAll,
}: {
  sessions: UserSession[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onRevoke: (session: UserSession) => void;
  onRevokeAll: () => void;
}) {
  if (loading) {
    return <LoadingBlock label="Loading sessions..." />;
  }

  if (error) {
    return <EmptyBlock title="Unable to load sessions" description={error} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <ActionButton icon={<RefreshCw className="h-4 w-4" />} onClick={onRefresh}>
          Refresh
        </ActionButton>
        <PermissionAction permission={"users.sessions.revoke"}><ActionButton icon={<XCircle className="h-4 w-4" />} tone="danger" onClick={onRevokeAll}>
          Revoke All
        </ActionButton></PermissionAction>
      </div>
      {sessions.length === 0 ? (
        <EmptyBlock title="No sessions" description="This user has no session records to display." />
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const state = sessionStatus(session);
            const userAgent = safeDisplayText(session.userAgent);
            const ipAddress = safeDisplayText(session.ipAddress, 64);

            return (
              <div key={session.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-950">
                      {userAgent ? "Browser session" : "User session"}
                    </p>
                    <p className="mt-1 break-words text-xs text-slate-500">
                      {userAgent ?? "No user agent recorded"}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      IP address: {ipAddress ?? "Not recorded"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      state === "Active"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-slate-50 text-slate-600"
                    }`}>
                      {state}
                    </span>
                    {state === "Active" ? (
                      <PermissionAction permission={"users.sessions.revoke"}><ActionButton icon={<XCircle className="h-4 w-4" />} tone="danger" onClick={() => onRevoke(session)}>
                        Revoke
                      </ActionButton></PermissionAction>
                    ) : null}
                  </div>
                </div>
                <dl className="mt-4 grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))]">
                  <ProfileItem label="Created" value={formatDateTime(session.createdAt)} />
                  <ProfileItem label="Last Seen" value={formatDateTime(session.lastSeenAt)} />
                  <ProfileItem label="Expires" value={formatDateTime(session.expiresAt)} />
                  <ProfileItem label="Idle Expiry" value={formatDateTime(session.idleExpiresAt)} />
                </dl>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UserFormDialog({
  mode,
  open,
  user,
  currentUserId,
  submitting,
  errorMessage,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  open: boolean;
  user: UserDetail | null;
  currentUserId: string | null;
  submitting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSubmit: (input: CreateUserInput) => Promise<void>;
}) {
  if (!open) {
    return null;
  }

  return (
    <UserFormDialogBody
      key={`${mode}:${user?.id ?? "new"}`}
      mode={mode}
      user={user}
      currentUserId={currentUserId}
      submitting={submitting}
      errorMessage={errorMessage}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

function UserFormDialogBody({
  mode,
  user,
  currentUserId,
  submitting,
  errorMessage,
  onClose,
  onSubmit,
}: Omit<Parameters<typeof UserFormDialog>[0], "open">) {
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [middleInitial, setMiddleInitial] = useState(user?.middleInitial ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState((user?.phone ?? "").replace(/^\+63/, "").replace(/^0(?=9)/, ""));
  const [role, setRole] = useState<AssignableUserRole>(
    user?.role === "ADMINISTRATOR" ? "ADMINISTRATOR" : "STAFF",
  );
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [phoneInputError, setPhoneInputError] = useState<string | null>(null);
  const editingSelf = mode === "edit" && user?.id === currentUserId;
  const editingReservedManager = mode === "edit" && user?.role === "MANAGER";
  const fieldErrors: Record<string, string | undefined> = {
    firstName: !firstName.trim() ? "First name is required." : undefined,
    lastName: !lastName.trim() ? "Last name is required." : undefined,
    email: !email.trim() ? "Email is required." : !/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email.trim()) ? "Enter a valid email address." : undefined,
    phone: !phone.trim() ? "Phone is required." : !/^9[0-9]{9}$/.test(phone) ? "Enter 10 digits starting with 9, excluding +63." : undefined,
    middleInitial: middleInitial.trim().length > 1 ? "Middle initial must be one character." : undefined,
    role: !editingReservedManager && !["ADMINISTRATOR", "STAFF"].includes(role) ? "Select a role." : undefined,
  };
  const showFieldError = (field: string) => field === "phone" && phoneInputError ? phoneInputError : validationAttempted ? fieldErrors[field] : undefined;
  const fieldMessage = (field: string) => showFieldError(field) ? <p id={`${mode}-user-${field}-error`} role="alert" className={styles.fieldError}>{showFieldError(field)}</p> : null;
  const fieldClass = (field: string) => `${inventoryInputClasses} ${showFieldError(field) ? styles.invalidInput : ""}`;

  function validate() {
    setValidationAttempted(true);
    return !Object.values(fieldErrors).some(Boolean) && !phoneInputError;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (!validate()) {
      return;
    }

    await onSubmit({
      firstName: firstName.trim(),
      middleInitial: middleInitial.trim() || null,
      lastName: lastName.trim(),
      email: email.trim(),
      phone: `+63${phone}`,
      role:
        (editingSelf || editingReservedManager) && user
          ? (user.role as AssignableUserRole)
          : role,
    });
  }

  const formContent = (
      <form noValidate className={styles.userDialogForm} onSubmit={handleSubmit}>
        <div className={styles.userFormIntro}>
          <span className={styles.userFormIcon}><UserPlus size={22} aria-hidden="true" /></span>
          <div><strong>{mode === "create" ? "Account details" : "Profile details"}</strong><p>{mode === "create" ? "The user will receive an email to finish setting up their account." : "Update the user's contact information and role."}</p></div>
          <span className={styles.requiredNote}><span className="text-red-600" aria-hidden="true">*</span> Required</span>
        </div>
        {errorMessage ? (
          <div className="md:col-span-2 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <div className={styles.nameFields}>
        <InventoryField htmlFor={`${mode}-user-first-name`} label="First Name" required>
          <input id={`${mode}-user-first-name`} placeholder="Ex. juan" autoComplete="given-name" required aria-invalid={!!showFieldError("firstName")} aria-describedby={showFieldError("firstName") ? `${mode}-user-firstName-error` : undefined} value={firstName} onChange={(event) => setFirstName(event.target.value)} className={fieldClass("firstName")} />
          {fieldMessage("firstName")}
        </InventoryField>
        <InventoryField htmlFor={`${mode}-user-last-name`} label="Last Name" required>
          <input id={`${mode}-user-last-name`} placeholder="Ex. Dela Cruz" autoComplete="family-name" required aria-invalid={!!showFieldError("lastName")} aria-describedby={showFieldError("lastName") ? `${mode}-user-lastName-error` : undefined} value={lastName} onChange={(event) => setLastName(event.target.value)} className={fieldClass("lastName")} />
          {fieldMessage("lastName")}
        </InventoryField>
        <InventoryField htmlFor={`${mode}-user-middle-initial`} label="Middle Initial">
          <input id={`${mode}-user-middle-initial`} aria-label="Middle initial (optional)" placeholder="Optional" aria-invalid={!!showFieldError("middleInitial")} aria-describedby={showFieldError("middleInitial") ? `${mode}-user-middleInitial-error` : undefined} value={middleInitial} maxLength={1} onChange={(event) => setMiddleInitial(event.target.value.toUpperCase())} className={fieldClass("middleInitial")} />
          {fieldMessage("middleInitial")}
        </InventoryField>
        </div>
        <InventoryField htmlFor={`${mode}-user-email`} label="Email" required>
          <input id={`${mode}-user-email`} type="email" autoComplete="email" required aria-invalid={!!showFieldError("email")} aria-describedby={showFieldError("email") ? `${mode}-user-email-error` : undefined} value={email} onChange={(event) => setEmail(event.target.value)} className={fieldClass("email")} placeholder="name@example.com" />
          {fieldMessage("email")}
        </InventoryField>
        <InventoryField htmlFor={`${mode}-user-phone`} label="Phone" required>
          <div className={`${styles.phoneField} ${showFieldError("phone") ? styles.invalidPhone : ""}`}>
            <span className={styles.phonePrefix}>+63</span>
            <input id={`${mode}-user-phone`} type="tel" inputMode="numeric" autoComplete="tel-national" required minLength={10} maxLength={10} pattern="9[0-9]{9}" title="Enter 10 digits starting with 9, excluding +63." aria-label="Phone number, +63 followed by 10 digits" aria-invalid={!!showFieldError("phone")} aria-describedby={showFieldError("phone") ? `${mode}-user-phone-error` : undefined} value={phone} onChange={(event) => {
              if (!/^[0-9]*$/.test(event.target.value)) { setPhoneInputError("Phone number must contain digits only."); return; }
              setPhoneInputError(null);
              setPhone(event.target.value);
            }} className={fieldClass("phone")} placeholder="9171234567" />
          </div>
          {fieldMessage("phone")}
        </InventoryField>
        <InventoryField
          htmlFor={`${mode}-user-role`}
          label="Role"
          required
          hint={mode === "create" ? undefined : editingSelf ? "Self role changes are protected." : editingReservedManager ? "Manager is reserved for future implementation." : undefined}
        >
          <StyledSelect aria-label="Role"
            required
            id={`${mode}-user-role`}
            value={(editingSelf || editingReservedManager) && user ? user.role : role}
            disabled={editingSelf || editingReservedManager}
            onValueChange={(value) => setRole(value as AssignableUserRole)}
            className={styles.roleSelect}
          >
            {editingReservedManager ? (
              <option value="MANAGER">Manager (reserved)</option>
            ) : null}
            <option value="ADMINISTRATOR">Administrator</option>
            <option value="STAFF">Staff</option>
          </StyledSelect>
        </InventoryField>

        <div className={styles.userDialogActions}>
          <button type="submit" disabled={submitting} className="rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
            <UserPlus size={16} aria-hidden="true" />
            {submitting ? "Saving..." : mode === "create" ? "Create User" : "Save Changes"}
          </button>
        </div>
      </form>
  );

  return <InventoryModal professional panelClassName="userFormDialog" bodyClassName={styles.userDialogBody} title={mode === "create" ? "Add User" : `Edit ${user?.name ?? "User"}`} description={mode === "create" ? "Create a pending account and send an account setup email." : "Update profile fields and assignable role data."} onClose={submitting ? () => undefined : onClose}>
    {formContent}
  </InventoryModal>;
}

function ConfirmDialog({
  dialog,
  submitting,
  errorMessage,
  onClose,
  onConfirm,
}: {
  dialog: DialogState | null;
  submitting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onConfirm: (action: Exclude<DialogState["type"], "create" | "edit">) => Promise<void>;
}) {
  if (!dialog || dialog.type === "create" || dialog.type === "edit") {
    return null;
  }

  const copy = getConfirmCopy(dialog);

  return (
    <InventoryModal professional panelClassName={styles.confirmPanel} bodyClassName={styles.confirmBody} title={copy.title} description={copy.description} onClose={submitting ? () => undefined : onClose}>
      <div className={styles.confirmContent}>
        {errorMessage ? (
          <div role="alert" className={styles.confirmError}>
            {errorMessage}
          </div>
        ) : null}
        <div className={styles.confirmSummary}>
          <p className="text-sm font-semibold text-slate-950">{dialog.user.name}</p>
          <p className="mt-1 text-sm text-slate-500">{dialog.user.email}</p>
        </div>
        <div className={styles.confirmActions}>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void onConfirm(dialog.type)}
            className={copy.danger ? styles.confirmDanger : styles.confirmPrimary}
          >
            {submitting ? "Working..." : copy.confirm}
          </button>
        </div>
      </div>
    </InventoryModal>
  );
}

function getConfirmCopy(dialog: Exclude<DialogState, { type: "create" } | { type: "edit"; user: UserDetail }>) {
  if (dialog.type === "suspend") {
    return {
      title: "Deactivate User",
      description: "Are you sure you want to deactivate this user? They will be signed out and unable to sign in until reactivated.",
      confirm: "Deactivate User",
      danger: true,
    };
  }
  if (dialog.type === "reactivate") {
    return {
      title: "Reactivate User",
      description: "The account will move from Inactive back to Active.",
      confirm: "Reactivate User",
      danger: false,
    };
  }
  if (dialog.type === "password-reset") {
    return {
      title: dialog.user.status === "PENDING" ? "Send Account Setup" : "Reset Password",
      description:
        dialog.user.status === "PENDING"
          ? "Send this user an account setup email so they can choose their password."
          : "Send this user a password reset email. Inactive accounts will remain inactive.",
      confirm: dialog.user.status === "PENDING" ? "Send Setup" : "Reset Password",
      danger: false,
    };
  }
  if (dialog.type === "delete") {
    return {
      title: "Delete User",
      description: "Are you sure you want to permanently delete this user? This cannot be undone. Users with protected history cannot be deleted.",
      confirm: "Delete User",
      danger: true,
    };
  }
  if (dialog.type === "revoke-session") {
    return {
      title: "Revoke Session",
      description: "This selected session will become unusable.",
      confirm: "Revoke Session",
      danger: true,
    };
  }
  return {
    title: "Revoke All Sessions",
    description: "All active sessions for this selected user will be signed out.",
    confirm: "Revoke All",
    danger: true,
  };
}
