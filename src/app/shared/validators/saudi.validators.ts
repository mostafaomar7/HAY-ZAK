import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { REGEX } from '../../core/constants/app.constants';

/** FR-AUTH-02/03 — accepts 05XXXXXXXX, +9665XXXXXXXX and 009665XXXXXXXX. */
export const saudiMobile: ValidatorFn = (control): ValidationErrors | null => {
  if (!control.value) return null;
  const digits = String(control.value).replace(/[\s-]/g, '');
  return REGEX.saudiMobile.test(digits) ? null : { saudiMobile: true };
};

/** FR-AUTH-02 — National ID (starts with 1) or Iqama (starts with 2). */
export const saudiNationalId: ValidatorFn = (control): ValidationErrors | null => {
  if (!control.value) return null;
  return REGEX.saudiNationalId.test(String(control.value).trim())
    ? null
    : { saudiNationalId: true };
};

/**
 * FR-LSR-02 — SA + 22 characters, then the ISO 13616 mod-97 checksum.
 * Format alone lets typos through, and a wrong IBAN means a failed payout
 * (UC-04 alternate flow), so both checks run.
 */
export const saudiIban: ValidatorFn = (control): ValidationErrors | null => {
  if (!control.value) return null;
  const iban = String(control.value).replace(/\s/g, '').toUpperCase();

  if (!REGEX.saudiIban.test(iban)) return { saudiIban: true };

  // Move the first four characters to the end, then letters → digits (A=10).
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));

  // Chunked mod-97: the full number overflows Number.MAX_SAFE_INTEGER.
  let remainder = 0;
  for (const digit of numeric) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }

  return remainder === 1 ? null : { ibanChecksum: true };
};

/** FR-BKG-01 — a booking may not start in the past. */
export const notPastDate: ValidatorFn = (control): ValidationErrors | null => {
  if (!control.value) return null;
  const value = new Date(control.value).setHours(0, 0, 0, 0);
  return value < new Date().setHours(0, 0, 0, 0) ? { notPastDate: true } : null;
};

/** FR-UNT-06 — per-unit minimum and maximum booking duration. */
export function bookingDuration(minDays: number, maxDays?: number): ValidatorFn {
  return (control): ValidationErrors | null => {
    const days = Number(control.value);
    if (!days) return null;
    if (days < minDays) return { minBookingDays: { minDays, actual: days } };
    if (maxDays && days > maxDays) return { maxBookingDays: { maxDays, actual: days } };
    return null;
  };
}

/** FR-UNT-02 — between two and three photographs per unit. */
export function imageCount(min: number, max: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const count = Array.isArray(control.value) ? control.value.length : 0;
    if (count < min) return { minImages: { min, actual: count } };
    if (count > max) return { maxImages: { max, actual: count } };
    return null;
  };
}
