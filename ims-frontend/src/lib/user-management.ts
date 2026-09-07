import { apiJsonFetch } from "./api";
import type { Role } from "./auth";

export type AccountStatus = "PENDING" | "ACTIVE" | "INACTIVE";
export type UserManagementRole = Role;
export type AssignableUserRole = "ADMINISTRATOR" | "STAFF";

export type Pagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type UserSummary = {
  id: string;
  name: string;
  email: string;
  role: UserManagementRole;
  status: AccountStatus;
  lastLoginAt: string | null;
  lastActive: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserDetail = UserSummary & {
  firstName: string;
  middleInitial: string | null;
  lastName: string;
  phone: string | null;
};

export type UserSession = {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  idleExpiresAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
};

export type UserActivityType =
  | "SESSION"
  | "ORDER"
  | "STOCK_RUN"
  | "INVENTORY_TRANSACTION"
  | "ORDER_REVERSAL"
  | "PRODUCT_ARCHIVE"
  | "ALERT_ACKNOWLEDGEMENT"
  | "ALERT_DISMISSAL";

export type UserActivityItem = {
  type: UserActivityType;
  occurredAt: string;
  referenceId: string;
  details: Record<string, unknown>;
};

export type ListUsersParams = {
  search?: string;
  role?: UserManagementRole;
  status?: AccountStatus;
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
};

export type ListUsersResponse = {
  items: UserSummary[];
  pagination: Pagination;
};

export type UserDetailResponse = {
  user: UserDetail;
};

export type UserSessionsResponse = {
  sessions: UserSession[];
};

export type UserActivityResponse = {
  items: UserActivityItem[];
  pagination: Pagination & {
    boundedWindow: number;
  };
};

export type CreateUserInput = {
  firstName: string;
  middleInitial?: string | null;
  lastName: string;
  email: string;
  phone: string;
  role: AssignableUserRole;
};

export type UpdateUserInput = Partial<CreateUserInput>;

type MutatingUserResponse = {
  message: string;
  user: UserDetail;
};

type MessageResponse = {
  message: string;
};

type RevokeAllSessionsResponse = MessageResponse & {
  revokedCount: number;
};

function buildQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }

  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export async function listManagedUsers(
  params: ListUsersParams = {},
): Promise<ListUsersResponse> {
  const { signal, ...queryParams } = params;
  return apiJsonFetch<ListUsersResponse>(`/users${buildQuery(queryParams)}`, {
    method: "GET",
    cache: "no-store",
    signal,
  });
}

export async function getManagedUser(
  userId: string,
  signal?: AbortSignal,
): Promise<UserDetail> {
  const response = await apiJsonFetch<UserDetailResponse>(`/users/${userId}`, {
    method: "GET",
    cache: "no-store",
    signal,
  });

  return response.user;
}

export async function createManagedUser(
  input: CreateUserInput,
): Promise<MutatingUserResponse> {
  return apiJsonFetch<MutatingUserResponse>("/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateManagedUser(
  userId: string,
  input: UpdateUserInput,
): Promise<MutatingUserResponse> {
  return apiJsonFetch<MutatingUserResponse>(`/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function suspendManagedUser(
  userId: string,
): Promise<MutatingUserResponse> {
  return apiJsonFetch<MutatingUserResponse>(`/users/${userId}/suspend`, {
    method: "POST",
  });
}

export async function reactivateManagedUser(
  userId: string,
): Promise<MutatingUserResponse> {
  return apiJsonFetch<MutatingUserResponse>(`/users/${userId}/reactivate`, {
    method: "POST",
  });
}

export async function requestManagedUserPasswordReset(
  userId: string,
): Promise<MessageResponse> {
  return apiJsonFetch<MessageResponse>(`/users/${userId}/password-reset`, {
    method: "POST",
  });
}

export async function listManagedUserSessions(
  userId: string,
  signal?: AbortSignal,
): Promise<UserSessionsResponse> {
  return apiJsonFetch<UserSessionsResponse>(`/users/${userId}/sessions`, {
    method: "GET",
    cache: "no-store",
    signal,
  });
}

export async function revokeManagedUserSession(
  userId: string,
  sessionId: string,
): Promise<MessageResponse> {
  return apiJsonFetch<MessageResponse>(`/users/${userId}/sessions/${sessionId}`, {
    method: "DELETE",
  });
}

export async function revokeAllManagedUserSessions(
  userId: string,
): Promise<RevokeAllSessionsResponse> {
  return apiJsonFetch<RevokeAllSessionsResponse>(
    `/users/${userId}/sessions/revoke-all`,
    {
      method: "POST",
    },
  );
}

export async function listManagedUserActivity(
  userId: string,
  params: { page?: number; pageSize?: number; signal?: AbortSignal } = {},
): Promise<UserActivityResponse> {
  const { signal, ...queryParams } = params;
  return apiJsonFetch<UserActivityResponse>(
    `/users/${userId}/activity${buildQuery(queryParams)}`,
    {
      method: "GET",
      cache: "no-store",
      signal,
    },
  );
}

export async function deleteManagedUser(userId: string): Promise<MessageResponse> {
  return apiJsonFetch<MessageResponse>(`/users/${userId}`, {
    method: "DELETE",
  });
}
