"use client";

import type { FormEvent } from "react";
import Image from "next/image";
import { Check, UserRound } from "lucide-react";
import styles from "./EditAccountDialog.module.css";
import { useEffect, useState } from "react";
import InventoryModal from "@/components/admin/inventory/InventoryModal";
import ProfilePictureCropper from "./ProfilePictureCropper";
import cropStyles from "./ProfilePictureCropper.module.css";
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
  const [phone, setPhone] = useState((account.phone ?? "").replace(/^\+63/, "").replace(/^0(?=9)/, ""));
  const [picture, setPicture] = useState<File | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | undefined>(profilePictureSrc(account.profilePictureUrl));
  useEffect(() => {
    return () => { if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview); };
  }, [preview]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [phoneInputError, setPhoneInputError] = useState<string | null>(null);
  const fieldErrors: Record<string, string | undefined> = {
    firstName: !firstName.trim() ? "First name is required." : undefined,
    lastName: !lastName.trim() ? "Last name is required." : undefined,
    middleInitial: middleInitial.trim().length > 1 ? "Middle initial must be one character." : undefined,
    email: !email.trim() ? "Email is required." : !/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email.trim()) ? "Enter a valid email address, such as name@example.com." : undefined,
    phone: !phone.trim() ? "Phone is required." : !/^9[0-9]{9}$/.test(phone) ? "Enter 10 digits starting with 9, excluding +63." : undefined,
  };
  const showError = (field: string) => field === "phone" && phoneInputError ? phoneInputError : validationAttempted ? fieldErrors[field] : undefined;
  const fieldClass = (field: string) => `${inventoryInputClasses} ${showError(field) ? styles.invalidInput : ""}`;
  const fieldMessage = (field: string) => showError(field) ? <p id={`settings-${field}-error`} role="alert" className={styles.fieldError}>{showError(field)}</p> : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setValidationAttempted(true);
    if (Object.values(fieldErrors).some(Boolean) || phoneInputError) return;

    const trimmedFirstName = firstName.trim();
    const trimmedMiddleInitial = middleInitial.trim();
    const trimmedLastName = lastName.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = `+63${phone.trim()}`;

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
      <InventoryModal title="Crop profile picture" description="Adjust your photo before adding it to your profile." panelClassName={cropStyles.modal} bodyClassName={cropStyles.body} onClose={() => setCropFile(null)}>
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
      panelClassName="editAccountDialog"
      bodyClassName={styles.body}
      title="Edit Account"
      description="Update your profile details. Role, status, and Employee ID are read-only."
      onClose={submitting ? () => undefined : onClose}
    >
      <form noValidate className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.intro}>
          <span className={styles.introIcon}><UserRound size={22} aria-hidden="true" /></span>
          <div><strong>Your profile</strong><p>Keep your photo and contact information up to date.</p></div>
          <span className={styles.requiredNote}><span className="text-red-600" aria-hidden="true">*</span> Required</span>
        </div>
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
        <InventoryField htmlFor="settings-first-name" label="First Name" required>
          <input
            id="settings-first-name"
            placeholder="Ex. juan"
            aria-invalid={!!showError("firstName")}
            aria-describedby={showError("firstName") ? "settings-firstName-error" : undefined}
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className={fieldClass("firstName")}
            autoComplete="given-name"
            required
          />
          {fieldMessage("firstName")}
        </InventoryField>



        <InventoryField htmlFor="settings-last-name" label="Last Name" required>
          <input
            id="settings-last-name"
            placeholder="Ex. Dela Cruz"
            aria-invalid={!!showError("lastName")}
            aria-describedby={showError("lastName") ? "settings-lastName-error" : undefined}
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className={fieldClass("lastName")}
            autoComplete="family-name"
            required
          />
          {fieldMessage("lastName")}
        </InventoryField>

        <InventoryField
          htmlFor="settings-middle-initial"
          label="Middle Initial"
        >
          <input
            id="settings-middle-initial"
            placeholder="Optional"
            aria-invalid={!!showError("middleInitial")}
            value={middleInitial}
            onChange={(event) => setMiddleInitial(event.target.value.toUpperCase())}
            className={fieldClass("middleInitial")}
            autoComplete="additional-name"
            aria-describedby={showError("middleInitial") ? "settings-middleInitial-error settings-middle-initial-hint" : "settings-middle-initial-hint"}
            maxLength={1}
          />
          {fieldMessage("middleInitial")}
          <p id="settings-middle-initial-hint" className="text-xs text-[#232d46]/70">Optional, one character.</p>
        </InventoryField>

        </div>
        <div className={styles.contactFields}>
        <InventoryField htmlFor="settings-email" label="Email" required>
          <input
            id="settings-email"
            placeholder="name@example.com"
            aria-invalid={!!showError("email")}
            type="email"
            aria-describedby={showError("email") ? "settings-email-error" : undefined}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={fieldClass("email")}
            autoComplete="email"
            required
          />
          {fieldMessage("email")}
        </InventoryField>

        <div className="min-w-0">
          <InventoryField htmlFor="settings-phone" label="Phone" required>
            <div className={`${styles.phoneField} ${showError("phone") ? styles.invalidPhone : ""}`}>
            <span className={styles.phonePrefix}>+63</span>
            <input
              id="settings-phone"
              type="tel"
              value={phone}
              required
              inputMode="numeric"
              maxLength={10}
              onChange={(event) => {
                if (!/^\d*$/.test(event.target.value)) { setPhoneInputError("Phone number must contain digits only."); return; }
                setPhoneInputError(null);
                setPhone(event.target.value);
              }}
              className={fieldClass("phone")}
              aria-invalid={!!showError("phone")}
              aria-describedby={showError("phone") ? "settings-phone-error" : undefined}
              autoComplete="tel-national"
              placeholder="9171234567"
            />
            </div>
            {fieldMessage("phone")}
          </InventoryField>
        </div>

        </div>
        <div className={styles.actions}>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-[#232d46] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#232d46] disabled:opacity-50"
          >
            <Check size={16} aria-hidden="true" />
            {submitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </InventoryModal>
  );
}
