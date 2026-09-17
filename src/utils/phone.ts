/** Strips everything except digits and a leading "+". */
export function sanitizePhoneInput(value: string): string {
  return value.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
}

/** Digits with all non-numeric characters removed. */
export function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Accepts a 10-digit Indian mobile number, optionally with a "+91",
 * "91", or "0" country-code prefix (with spaces/dashes allowed).
 */
export function isValidWhatsappNumber(value: string): boolean {
  const digits = phoneDigits(value);
  if (digits.length === 10) return true;
  if (digits.length === 12 && digits.startsWith("91")) return true;
  if (digits.length === 11 && digits.startsWith("0")) return true;
  return false;
}