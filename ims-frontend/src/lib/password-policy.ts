export const PASSWORD_REQUIREMENTS = "Use 8–16 characters with uppercase, lowercase, and a special character.";

export function passwordChecks(value: string) {
  return [
    { label: "8–16 characters", met: value.length >= 8 && value.length <= 16 },
    { label: "Uppercase letter (A–Z)", met: /[A-Z]/.test(value) },
    { label: "Lowercase letter (a–z)", met: /[a-z]/.test(value) },
    { label: "Special character (e.g. ! @ #)", met: /[^A-Za-z0-9\s]/.test(value) },
  ];
}

export function meetsPasswordPolicy(value: string) {
  return passwordChecks(value).every(check => check.met);
}
