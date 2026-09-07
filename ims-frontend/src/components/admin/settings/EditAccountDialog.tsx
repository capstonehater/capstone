"use client";

import type { FormEvent } from "react";
import Image from "next/image";
import { useEffect, useState } from "react";
import InventoryModal from "@/components/admin/inventory/InventoryModal";
import {
  InventoryField,
  inventoryInputClasses,
} from "@/components/admin/inventory/InventoryField";
import {
  updateSettingsAccount,
  profilePictureSrc,
  type SettingsAccount,
  type UpdateSettingsAccountInput,
  type UpdateSettingsAccountResponse,
} from "@/lib/settings";

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

  return (
    <InventoryModal
      title="Edit Account"
      description="Update your profile details. Role, status, and Employee ID are read-only."
      onClose={submitting ? () => undefined : onClose}
    >
      <form className="grid gap-6" onSubmit={handleSubmit}>
        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="flex flex-col items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-orange-100 text-2xl font-bold text-orange-700">
            {preview ? <Image src={preview} alt="Profile picture preview" width={96} height={96} unoptimized className="h-full w-full object-cover" /> : account.firstName.charAt(0)}
          </div>
          <div className="w-full min-w-0 flex-1">
            <label htmlFor="settings-profile-picture" className="block text-sm font-semibold text-slate-700">Profile picture</label>
            <input id="settings-profile-picture" type="file" accept="image/jpeg,image/png,image/webp"
              disabled={submitting} className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-orange-50 file:px-4 file:py-2 file:font-semibold file:text-orange-700"
              onChange={(event) => {
                const selected = event.target.files?.[0];
                if (!selected) return;
                if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type) || selected.size > 5 * 1024 * 1024 || selected.size === 0) {
                  setError("Choose a JPG, PNG, or WebP image up to 5 MB.");
                  event.target.value = "";
                  return;
                }
                setError(null);
                setPicture(selected);
                setPreview(URL.createObjectURL(selected));
              }} />
            <p className="mt-2 text-xs text-slate-500">JPG, PNG, or WebP, up to 5 MB. Your picture updates when you save changes.</p>
          </div>
        </div>

        <div className="grid items-start gap-4 md:grid-cols-3">
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
          <p id="settings-middle-initial-hint" className="text-xs text-slate-500">Optional, one character.</p>
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
        <div className="grid items-start gap-4 md:grid-cols-2">
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
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className={inventoryInputClasses}
              autoComplete="tel"
              placeholder="+639171234567"
            />
          </InventoryField>
        </div>

        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
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
            className="rounded-full bg-[#f45a1f] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#d94d18] disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </InventoryModal>
  );
}
