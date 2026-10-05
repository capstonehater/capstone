"use client";

import type { FormEvent, InputHTMLAttributes } from "react";
import { useState } from "react";
import { Check, Eye, EyeOff, Circle } from "lucide-react";
import passwordStyles from "./ChangePasswordDialog.module.css";
import styles from "./EditAccountDialog.module.css";
import InventoryModal from "@/components/admin/inventory/InventoryModal";
import {
  InventoryField,
} from "@/components/admin/inventory/InventoryField";
import { PASSWORD_REQUIREMENTS, passwordChecks, meetsPasswordPolicy } from "@/lib/password-policy";
import {
  changeSettingsPassword,
  type ChangePasswordResponse,
} from "@/lib/settings";

const inventoryInputClasses = styles.input;

type ChangePasswordDialogProps = {
  onClose: () => void;
  onChanged: (response: ChangePasswordResponse) => void;
};

function PasswordInput(props: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const [visible, setVisible] = useState(false);
  const { label, ...inputProps } = props;
  return <div className={passwordStyles.inputWrap}>
    <input {...inputProps} type={visible ? "text" : "password"} />
    <button className={passwordStyles.passwordToggle} type="button" disabled={props.disabled} aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`} aria-controls={props.id} aria-pressed={visible} onClick={() => setVisible(current => !current)}>
      {visible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
    </button>
  </div>;
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

    if (!meetsPasswordPolicy(newPassword)) {
      setError(PASSWORD_REQUIREMENTS);
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
      professional
      bodyClassName={styles.body}
      title="Change Password"
      description="Enter your current password and choose a new password that meets policy."
      onClose={submitting ? () => undefined : onClose}
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        {error ? (
          <div role="alert" className={styles.error}>
            {error}
          </div>
        ) : null}

        <InventoryField htmlFor="settings-current-password" label="Current Password">
          <PasswordInput
            label="Current password"
            disabled={submitting}
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
        >
          <PasswordInput
            label="New password"
            disabled={submitting}
            id="settings-new-password"
            aria-describedby="settings-password-requirements settings-password-strength"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className={inventoryInputClasses}
            autoComplete="new-password"
            minLength={8}
            maxLength={16}
            required
          />
        </InventoryField>

        <div className={passwordStyles.policy}>
          <p id="settings-password-requirements">{PASSWORD_REQUIREMENTS}</p>
          <div id="settings-password-strength" aria-live="polite" className={passwordStyles.strength}>
            <span>Password strength</span><strong>{!newPassword ? "Not entered" : meetsPasswordPolicy(newPassword) ? (newPassword.length >= 12 ? "Strong" : "Moderate") : "Weak"}</strong>
          </div>
          <div className={passwordStyles.meter} aria-hidden="true">{[0, 1, 2, 3].map(index => <span key={index} data-active={newPassword.length > 0 && index < (meetsPasswordPolicy(newPassword) ? (newPassword.length >= 12 ? 4 : 3) : 1)} data-valid={meetsPasswordPolicy(newPassword)} />)}</div>
          <ul className={passwordStyles.checks}>{passwordChecks(newPassword).map(check => <li key={check.label} data-met={check.met}>{check.met ? <Check size={15} aria-hidden="true" /> : <Circle size={13} aria-hidden="true" />}{check.label}</li>)}</ul>
        </div>

        <InventoryField
          htmlFor="settings-confirm-password"
          label="Confirm New Password"
        >
          <PasswordInput
            label="Confirm new password"
            disabled={submitting}
            id="settings-confirm-password"
            type="password"
            value={confirmNewPassword}
            onChange={(event) => setConfirmNewPassword(event.target.value)}
            className={inventoryInputClasses}
            autoComplete="new-password"
            minLength={8}
            maxLength={16}
            required
          />
        </InventoryField>

        <div className={styles.actions}>
          <button
            type="submit"
            disabled={submitting || !currentPassword || !meetsPasswordPolicy(newPassword) || newPassword !== confirmNewPassword}
            className="rounded-full bg-[#232d46] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#232d46]/90 disabled:opacity-50"
          >
            {submitting ? "Changing..." : "Change Password"}
          </button>
        </div>
      </form>
    </InventoryModal>
  );
}
