import { apiJsonFetch } from "./api";
import type { Role } from "./auth";

export type SettingsAccountStatus = "PENDING" | "ACTIVE" | "INACTIVE";

export type SettingsAccount = {
  id: string;
  firstName: string;
  middleInitial: string | null;
  lastName: string;
  name: string;
  email: string;
  phone: string | null;
  profilePictureUrl: string | null;
  role: Role;
  status: SettingsAccountStatus;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpdateSettingsAccountInput = Partial<{
  firstName: string;
  middleInitial: string | null;
  lastName: string;
  email: string;
  phone: string;
}>;

export type UpdateSettingsAccountResponse = {
  message: string;
  user: SettingsAccount;
  requiresReauthentication: boolean;
};

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

export type ChangePasswordResponse = {
  message: string;
  requiresReauthentication: boolean;
};

type SettingsAccountResponse = {
  user: SettingsAccount;
};

export async function fetchSettingsAccount(): Promise<SettingsAccount> {
  const response = await apiJsonFetch<SettingsAccountResponse>(
    "/settings/account",
    {
      method: "GET",
      cache: "no-store",
    }
  );

  return response.user;
}

export async function updateSettingsAccount(
  input: UpdateSettingsAccountInput,
  picture?: File | null
): Promise<UpdateSettingsAccountResponse> {
  let body: string | FormData = JSON.stringify(input);
  if (picture) {
    body = new FormData();
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) body.append(key, value ?? "");
    }
    body.append("profilePicture", picture);
  }
  return apiJsonFetch<UpdateSettingsAccountResponse>("/settings/account", {
    method: "PATCH",
    body,
  });
}

export async function changeSettingsPassword(
  input: ChangePasswordInput
): Promise<ChangePasswordResponse> {
  return apiJsonFetch<ChangePasswordResponse>("/settings/change-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function profilePictureSrc(url: string | null): string | undefined {
  if (!url) return undefined;
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "") + url;
}
