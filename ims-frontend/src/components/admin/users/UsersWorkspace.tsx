"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  Ban,
  CheckCircle2,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
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

const permissionsByRole: Record<
  UserManagementRole,
  { title: string; description: string }[]
> = {
  ADMINISTRATOR: [
    { title: "Dashboard", description: "View administrator dashboard metrics" },
    { title: "Inventory", description: "Manage inventory records and stock runs" },
    { title: "Products", description: "Manage products, variants, and recipes" },
    { title: "Reports", description: "Review sales and inventory reporting" },
    { title: "Recommendations", description: "Review administrator forecasting recommendations" },
    { title: "Alerts", description: "Review and resolve operational alerts" },
    { title: "Users", description: "Manage user accounts and sessions" },
  ],
  STAFF: [
    { title: "Staff Dashboard", description: "View staff dashboard tasks" },
    { title: "POS", description: "Use staff point-of-sale workflows" },
  ],
  MANAGER: [],
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
    return "border-orange-200 bg-orange-50 text-orange-700";
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
      router.replace(target);
      return;
    }

    router.push(target);
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
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const users = list?.items ?? [];
  const isSelf = Boolean(currentUser?.id && detail?.id === currentUser.id);
  const selectedVisibleOnMobile = Boolean(selectedUserId);

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
      const response = await createManagedUser(input);
      await refreshList();
      setDialog(null);
      setNotice("User created. Account setup was initiated and the user remains Pending until completion.");
      updateQuery({ userId: response.user.id, tab: "overview" }, "push");
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

  return (
    <div className="space-y-5">
      {workspaceError ? (
        <ActionAlert tone="error" title="Action failed" message={workspaceError} onDismiss={() => setWorkspaceError(null)} />
      ) : null}
      {listError ? <ActionAlert tone="error" title="Unable to load users" message={listError} /> : null}
      {notice ? (
        <ActionAlert tone="success" title="Success!" message={notice} onDismiss={() => setNotice(null)} />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[430px_minmax(0,1fr)]">
        <section className={`${selectedVisibleOnMobile ? "hidden xl:flex" : "flex"} min-h-[66vh] flex-col rounded-[28px] bg-white p-5 shadow-sm`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#232d46]">
                Account Directory
              </p>
              <h2 className="text-lg font-semibold text-slate-950">User List</h2>
            </div>
            <button
              type="button"
              onClick={() => setDialog({ type: "create" })}
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              Add User
            </button>
          </div>

          <div className="mt-4 space-y-3 rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
            <label className="relative block">
              <span className="sr-only">Search users</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
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

          <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
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
              <div className="space-y-3">
                {users.map((user) => (
                  <button
                    type="button"
                    key={user.id}
                    onClick={() => updateQuery({ userId: user.id, tab }, "push")}
                    className={`w-full rounded-3xl border p-4 text-left transition ${
                      selectedUserId === user.id
                        ? "border-[#f45a1f] bg-orange-50/60 shadow-sm"
                        : "border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/30"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar name={user.name} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-950">
                              {user.name}
                            </p>
                            <p className="truncate text-xs text-slate-500">{user.email}</p>
                          </div>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone(user.status)}`}>
                            {statusLabels[user.status]}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${roleTone(user.role)}`}>
                            {roleLabels[user.role]}
                          </span>
                          <span className="text-xs text-slate-500">
                            Last active {formatDateTime(user.lastActive)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
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

        <section className={`${selectedVisibleOnMobile ? "block" : "hidden xl:block"} min-h-[66vh] rounded-[28px] bg-white p-5 shadow-sm`}>
          {!selectedUserId ? (
            <EmptyBlock
              icon={<UsersRound className="h-7 w-7" />}
              title="Select a user"
              description="Choose an account from the directory to review profile, permissions, activity, and sessions."
            />
          ) : detailLoading && !detail ? (
            <LoadingBlock label="Loading user detail..." />
          ) : detailError ? (
            <EmptyBlock title="Unable to load user" description={detailError} />
          ) : detail ? (
            <div className="space-y-5">
              <button
                type="button"
                onClick={() => updateQuery({ userId: null, tab: null }, "push")}
                className="text-sm font-semibold text-[#f45a1f] xl:hidden"
              >
                Back to users
              </button>

              <UserProfileHeader
                user={detail}
                isSelf={isSelf}
                onEdit={() => setDialog({ type: "edit", user: detail })}
                onSuspend={() => setDialog({ type: "suspend", user: detail })}
                onReactivate={() => setDialog({ type: "reactivate", user: detail })}
                onPasswordReset={() => setDialog({ type: "password-reset", user: detail })}
                onDelete={() => setDialog({ type: "delete", user: detail })}
              />

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

              {tab === "permissions" ? <PermissionsTab role={detail.role} /> : null}

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

      <UserFormDialog
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
      />

      <ConfirmDialog
        dialog={dialog}
        submitting={submitting}
        errorMessage={dialogError}
        onClose={() => {
          resetDialogFeedback();
          setDialog(null);
        }}
        onConfirm={handleAction}
      />
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
    <label className="space-y-2">
      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#f45a1f] focus:ring-2 focus:ring-[#f45a1f]/15"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue || "all"} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
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
    <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <Avatar name={user.name} />
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold text-slate-950">{user.name}</h2>
            <p className="truncate text-sm text-slate-500">{user.email}</p>
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

        <div className="flex flex-wrap gap-2">
          <ActionButton icon={<UserCog className="h-4 w-4" />} onClick={onEdit}>
            Edit
          </ActionButton>
          <ActionButton icon={<KeyRound className="h-4 w-4" />} onClick={onPasswordReset}>
            {user.status === "PENDING" ? "Send Setup" : "Reset Password"}
          </ActionButton>
          {canSuspend ? (
            <ActionButton icon={<Ban className="h-4 w-4" />} tone="danger" onClick={onSuspend}>
              Suspend
            </ActionButton>
          ) : null}
          {canReactivate ? (
            <ActionButton icon={<CheckCircle2 className="h-4 w-4" />} onClick={onReactivate}>
              Reactivate
            </ActionButton>
          ) : null}
          {canDelete ? (
            <ActionButton icon={<Trash2 className="h-4 w-4" />} tone="danger" onClick={onDelete}>
              Delete
            </ActionButton>
          ) : null}
        </div>
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</dd>
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
  tone?: "neutral" | "danger";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
        tone === "danger"
          ? "border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
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
    <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2">
      {tabs.map(([tab, label]) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            activeTab === tab
              ? "bg-slate-950 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
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
  const permissionCount = permissionsByRole[user.role].length;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <SummaryPanel
        icon={<ShieldCheck className="h-5 w-5" />}
        label="Permission Overview"
        value={user.role === "MANAGER" ? "Reserved" : `${permissionCount} modules`}
        detail={user.role === "MANAGER" ? "No application permissions assigned yet" : roleLabels[user.role]}
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
        detail="Derived from session metadata"
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
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3 text-[#f45a1f]">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-4 text-2xl font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{detail}</p>
    </div>
  );
}

function PermissionsTab({ role }: { role: UserManagementRole }) {
  const permissions = permissionsByRole[role];

  if (role === "MANAGER") {
    return (
      <EmptyBlock
        icon={<ShieldCheck className="h-7 w-7" />}
        title="Manager is reserved"
        description="Manager accounts can be displayed and filtered, but no Manager application permissions are defined yet."
      />
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {permissions.map((permission) => (
        <div key={permission.title} className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-950">{permission.title}</p>
          <p className="mt-1 text-sm text-slate-500">{permission.description}</p>
        </div>
      ))}
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
        <ActionButton icon={<XCircle className="h-4 w-4" />} tone="danger" onClick={onRevokeAll}>
          Revoke All
        </ActionButton>
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
                      <ActionButton icon={<XCircle className="h-4 w-4" />} tone="danger" onClick={() => onRevoke(session)}>
                        Revoke
                      </ActionButton>
                    ) : null}
                  </div>
                </div>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [role, setRole] = useState<AssignableUserRole>(
    user?.role === "ADMINISTRATOR" ? "ADMINISTRATOR" : "STAFF",
  );
  const [clientErrors, setClientErrors] = useState<string[]>([]);
  const editingSelf = mode === "edit" && user?.id === currentUserId;
  const editingReservedManager = mode === "edit" && user?.role === "MANAGER";

  function validate() {
    const nextErrors: string[] = [];
    if (!firstName.trim()) nextErrors.push("First name is required.");
    if (!lastName.trim()) nextErrors.push("Last name is required.");
    if (!email.trim()) nextErrors.push("Email is required.");
    if (!phone.trim()) nextErrors.push("Phone is required.");
    if (middleInitial.trim().length > 1) {
      nextErrors.push("Middle initial must be one character.");
    }

    setClientErrors(nextErrors);
    return nextErrors.length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    await onSubmit({
      firstName: firstName.trim(),
      middleInitial: middleInitial.trim() || null,
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      role:
        (editingSelf || editingReservedManager) && user
          ? (user.role as AssignableUserRole)
          : role,
    });
  }

  return (
    <InventoryModal
      title={mode === "create" ? "Add User" : `Edit ${user?.name ?? "User"}`}
      description={
        mode === "create"
          ? "Create a pending account and initiate secure setup."
          : "Update profile fields and assignable role data."
      }
      onClose={onClose}
    >
      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        {clientErrors.length > 0 ? (
          <div className="md:col-span-2 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {clientErrors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        ) : null}
        {errorMessage ? (
          <div className="md:col-span-2 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <InventoryField htmlFor="user-first-name" label="First Name">
          <input id="user-first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} className={inventoryInputClasses} />
        </InventoryField>
        <InventoryField htmlFor="user-middle-initial" label="Middle Initial">
          <input id="user-middle-initial" value={middleInitial} maxLength={1} onChange={(event) => setMiddleInitial(event.target.value.toUpperCase())} className={inventoryInputClasses} />
        </InventoryField>
        <InventoryField htmlFor="user-last-name" label="Last Name">
          <input id="user-last-name" value={lastName} onChange={(event) => setLastName(event.target.value)} className={inventoryInputClasses} />
        </InventoryField>
        <InventoryField htmlFor="user-email" label="Email">
          <input id="user-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inventoryInputClasses} />
        </InventoryField>
        <InventoryField htmlFor="user-phone" label="Phone">
          <input id="user-phone" value={phone} onChange={(event) => setPhone(event.target.value)} className={inventoryInputClasses} placeholder="+639171234567" />
        </InventoryField>
        <InventoryField
          htmlFor="user-role"
          label="Role"
          hint={editingSelf ? "Self role changes are protected." : "Manager is reserved for future implementation."}
        >
          <select
            id="user-role"
            value={(editingSelf || editingReservedManager) && user ? user.role : role}
            disabled={editingSelf || editingReservedManager}
            onChange={(event) => setRole(event.target.value as AssignableUserRole)}
            className={inventoryInputClasses}
          >
            {editingReservedManager ? (
              <option value="MANAGER">Manager (reserved)</option>
            ) : null}
            <option value="ADMINISTRATOR">Administrator</option>
            <option value="STAFF">Staff</option>
          </select>
        </InventoryField>

        <div className="md:col-span-2 flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {submitting ? "Saving..." : mode === "create" ? "Create User" : "Save Changes"}
          </button>
        </div>
      </form>
    </InventoryModal>
  );
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
    <InventoryModal title={copy.title} description={copy.description} onClose={onClose}>
      <div className="space-y-5">
        {errorMessage ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}
        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-950">{dialog.user.name}</p>
          <p className="mt-1 text-sm text-slate-500">{dialog.user.email}</p>
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700">
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void onConfirm(dialog.type)}
            className={`rounded-full px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
              copy.danger ? "bg-rose-700 hover:bg-rose-800" : "bg-slate-950 hover:bg-slate-800"
            }`}
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
      title: "Suspend User",
      description: "The account will become Inactive and active sessions will be revoked.",
      confirm: "Suspend User",
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
          ? "A secure setup flow will be initiated without exposing tokens in the UI."
          : "A secure password reset flow will be initiated without reactivating inactive accounts.",
      confirm: dialog.user.status === "PENDING" ? "Send Setup" : "Reset Password",
      danger: false,
    };
  }
  if (dialog.type === "delete") {
    return {
      title: "Delete User",
      description: "Hard delete is only allowed when the backend confirms no protected historical records exist.",
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
