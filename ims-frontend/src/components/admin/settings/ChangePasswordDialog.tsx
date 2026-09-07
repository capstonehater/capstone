"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import InventoryModal from "@/components/admin/inventory/InventoryModal";
import {
  InventoryField,
  inventoryInputClasses,
} from "@/components/admin/inventory/InventoryField";
import { PASSWORD_REQUIREMENTS_MESSAGE } from "@/lib/auth";
import {
  changeSettingsPassword,
  type ChangePasswordResponse,
} from "@/lib/settings";

type ChangePasswordDialogProps = {
  onClose: () => void;
  onChanged: (response: ChangePasswordResponse) => void;
};

function validatePassword(value: string) {
  if (value.length < 10 || value.length > 72) return false;
  return /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value);
}

export default function ChangePasswordDialog({
  onClose,
  onChanged,
}: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setError("Current password, new password, and confirmation are required.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError("New password and confirmation must match.");
      return;
    }

    if (!validatePassword(newPassword)) {
      setError(PASSWORD_REQUIREMENTS_MESSAGE);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await changeSettingsPassword({
        currentPassword,
        newPassword,
      });
      onChanged(response);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to change password."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <InventoryModal
      title="Change Password"
      description="Enter your current password and choose a new password that meets policy."
      onClose={submitting ? () => undefined : onClose}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <InventoryField htmlFor="settings-current-password" label="Current Password">
          <input
            id="settings-current-password"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className={inventoryInputClasses}
            autoComplete="current-password"
            required
          />
        </InventoryField>

        <InventoryField
          htmlFor="settings-new-password"
          label="New Password"
          hint={PASSWORD_REQUIREMENTS_MESSAGE}
        >
          <input
            id="settings-new-password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className={inventoryInputClasses}
            autoComplete="new-password"
            minLength={10}
            maxLength={72}
            required
          />
        </InventoryField>

        <InventoryField
          htmlFor="settings-confirm-password"
          label="Confirm New Password"
        >
          <input
            id="settings-confirm-password"
            type="password"
            value={confirmNewPassword}
            onChange={(event) => setConfirmNewPassword(event.target.value)}
            className={inventoryInputClasses}
            autoComplete="new-password"
            minLength={10}
            maxLength={72}
            required
          />
        </InventoryField>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? "Changing..." : "Change Password"}
          </button>
        </div>
      </form>
    </InventoryModal>
  );
}
