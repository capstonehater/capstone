import { apiFetch, apiJsonFetch } from "./api";

export type Role = "ADMINISTRATOR" | "MANAGER" | "STAFF";

export type AssignedAuthRole = { id: string; key: string; name: string; description: string };

export type AuthUser = {
  roles?: AssignedAuthRole[];
  effectivePermissions?: string[];
  authorizationRevision?: string | null;
  id: string;
  email: string;
  name: string;
  role: Role;
  profilePictureUrl?: string | null;
};

type LoginResponse = {
  message: string;
  user: AuthUser;
};

type CurrentUserResponse = {
  user: AuthUser;
};

type ForgotPasswordResponse = {
  message: string;
};

type ResetPasswordResponse = {
  message: string;
};

export const PASSWORD_REQUIREMENTS_MESSAGE =
  "Use at least 10 characters with uppercase, lowercase, and a number.";


export async function loginWithPassword(credentials: {
  email: string;
  password: string;
}): Promise<AuthUser> {
  const response = await apiJsonFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });

  return response.user;
}

export class AuthSessionError extends Error {
  constructor(public readonly status: number) { super("Unable to refresh session"); }
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const response = await apiFetch("/auth/me", { method: "GET", cache: "no-store" });
  if (!response.ok) throw new AuthSessionError(response.status);
  const data = await response.json() as CurrentUserResponse;
  return data.user;
}

export async function logoutSession(): Promise<void> {
  await apiFetch("/auth/logout", {
    method: "POST",
  });
}

export async function requestPasswordReset(email: string): Promise<string> {
  const response = await apiJsonFetch<ForgotPasswordResponse>(
    "/auth/forgot-password",
    {
      method: "POST",
      body: JSON.stringify({ email }),
    }
  );

  return response.message;
}

export async function resetPassword(input: {
  token: string;
  newPassword: string;
}): Promise<string> {
  const response = await apiJsonFetch<ResetPasswordResponse>(
    "/auth/reset-password",
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );

  return response.message;
}
