"use client";

import type { FormEvent } from "react";
import Image from "next/image";
import styles from "./EditAccountDialog.module.css";
import { useEffect, useState } from "react";
import InventoryModal from "@/components/admin/inventory/InventoryModal";
import ProfilePictureCropper from "./ProfilePictureCropper";
import {
  InventoryField,
} from "@/components/admin/inventory/InventoryField";
import {
  updateSettingsAccount,
  profilePictureSrc,
  type SettingsAccount,
  type UpdateSettingsAccountInput,
  type UpdateSettingsAccountResponse,
} from "@/lib/settings";

const inventoryInputClasses = styles.input;

type EditAccountDialogProps = {
  account: SettingsAccount;
  onClose: () => void;
  onSaved: (response: UpdateSettingsAccountResponse) => void;
};

function normalizeOptional(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export default function EditAccountDialog({
  account,
  onClose,
  onSaved,
}: EditAccountDialogProps) {
  const [firstName, setFirstName] = useState(account.firstName);
  const [middleInitial, setMiddleInitial] = useState(
    account.middleInitial ?? ""
  );
  const [lastName, setLastName] = useState(account.lastName);
  const [email, setEmail] = useState(account.email);
  const [phone, setPhone] = useState(account.phone ?? "");
  const [picture, setPicture] = useState<File | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | undefined>(profilePictureSrc(account.profilePictureUrl));
  useEffect(() => {
    return () => { if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview); };
  }, [preview]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedFirstName = firstName.trim();
    const trimmedMiddleInitial = middleInitial.trim();
    const trimmedLastName = lastName.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedFirstName || !trimmedLastName || !trimmedEmail) {
      setError("First name, last name, and email are required.");
      return;
    }

    if (trimmedMiddleInitial.length > 1) {
      setError("Middle initial must be one character or blank.");
      return;
    }

    const payload: UpdateSettingsAccountInput = {};

    if (trimmedFirstName !== account.firstName) payload.firstName = trimmedFirstName;
    if (trimmedLastName !== account.lastName) payload.lastName = trimmedLastName;
    if (trimmedEmail.toLowerCase() !== account.email.toLowerCase()) {
      payload.email = trimmedEmail;
    }
    if (normalizeOptional(trimmedMiddleInitial) !== account.middleInitial) {
      payload.middleInitial = normalizeOptional(trimmedMiddleInitial);
    }
    if (trimmedPhone !== (account.phone ?? "")) payload.phone = trimmedPhone;

    if (Object.keys(payload).length === 0 && !picture) {
      onClose();
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await updateSettingsAccount(payload, picture);
      onSaved(response);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to update account settings."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (cropFile) {
    return (
      <InventoryModal title="Crop profile picture" description="Adjust your photo before adding it to your profile." onClose={() => setCropFile(null)}>
        <ProfilePictureCropper
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onApply={(cropped) => {
            setPicture(cropped);
            setPreview(URL.createObjectURL(cropped));
            setCropFile(null);
          }}
        />
      </InventoryModal>
    );
  }

  return (
    <InventoryModal
      professional
      bodyClassName={styles.body}
      title="Edit Account"
      description="Update your profile details. Role, status, and Employee ID are read-only."
      onClose={submitting ? () => undefined : onClose}
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        {error ? (
          <div role="alert" className={styles.error}>
            {error}
          </div>
        ) : null}

        <div className={styles.pictureSection}>
          <div className={styles.avatar}>
            {preview ? <Image src={preview} alt="Profile picture preview" width={96} height={96} unoptimized onError={() => setPreview(undefined)} className="h-full w-full object-cover" /> : `${account.firstName.charAt(0)}${account.lastName.charAt(0)}`}
          </div>
          <div className="w-full min-w-0 flex-1">
            <label htmlFor="settings-profile-picture" className="block text-sm font-semibold text-[#232d46]">Profile picture</label>
            <input id="settings-profile-picture" type="file" accept="image/jpeg,image/png,image/webp"
              disabled={submitting} className="mt-2 block w-full text-sm text-[#232d46]/80 file:mr-3 file:rounded-full file:border-0 file:bg-[#f5f5f5] file:px-4 file:py-2 file:font-semibold file:text-[#232d46]"
              onChange={(event) => {
                const selected = event.target.files?.[0];
                event.target.value = "";
                if (!selected) return;
                if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type) || selected.size > 5 * 1024 * 1024 || selected.size === 0) {
                  setError("Choose a JPG, PNG, or WebP image up to 5 MB.");
                  event.target.value = "";
                  return;
                }
                setError(null);
                setCropFile(selected);
              }} />
            <p className="mt-2 text-xs text-[#232d46]/70">JPG, PNG, or WebP, up to 5 MB. Your picture updates when you save changes.</p>
          </div>
        </div>

        <div className={styles.nameFields}>
        <InventoryField htmlFor="settings-first-name" label="First Name">
          <input
            id="settings-first-name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className={inventoryInputClasses}
            autoComplete="given-name"
            required
          />
        </InventoryField>

        <InventoryField
          htmlFor="settings-middle-initial"
          label="Middle Initial"
        >
          <input
            id="settings-middle-initial"
            value={middleInitial}
            onChange={(event) => setMiddleInitial(event.target.value)}
            className={inventoryInputClasses}
            autoComplete="additional-name"
            aria-describedby="settings-middle-initial-hint"
            maxLength={1}
          />
          <p id="settings-middle-initial-hint" className="text-xs text-[#232d46]/70">Optional, one character.</p>
        </InventoryField>

        <InventoryField htmlFor="settings-last-name" label="Last Name">
          <input
            id="settings-last-name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className={inventoryInputClasses}
            autoComplete="family-name"
            required
          />
        </InventoryField>

        </div>
        <div className={styles.contactFields}>
        <InventoryField htmlFor="settings-email" label="Email">
          <input
            id="settings-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inventoryInputClasses}
            autoComplete="email"
            required
          />
        </InventoryField>

        <div className="min-w-0">
          <InventoryField htmlFor="settings-phone" label="Phone">
            <input
              id="settings-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className={inventoryInputClasses}
              autoComplete="tel"
              placeholder="+639171234567"
            />
          </InventoryField>
        </div>

        </div>
        <div className={styles.actions}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-full border border-[#232d46]/15 bg-white px-5 py-2 text-sm font-semibold text-[#232d46] transition hover:border-slate-300 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-[#232d46] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#232d46] disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </InventoryModal>
  );
}
