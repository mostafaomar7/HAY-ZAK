/**
 * Umm al-Qura conversion, both directions (NFR-USB-05).
 *
 * The Saudi civil calendar is not arithmetic — Umm al-Qura is a published
 * table, and a month is 29 or 30 days by observation rather than by formula.
 * So nothing here calculates a Hijri date. `Intl` already carries the table in
 * every browser this application supports, and both directions go through it:
 * forwards by formatting, backwards by formatting candidates until one matches.
 *
 * That is why `fromHijriParts` scans. A mean-year estimate lands within a few
 * days of the answer and never exactly on it, and the alternative — shipping a
 * copy of the table — is a second source of truth that goes stale the year the
 * committee adjusts one.
 *
 * The value that leaves this file is always a plain Gregorian `YYYY-MM-DD`,
 * because that is the only thing the API accepts. The Hijri reading is for the
 * person, not for the wire.
 */

import type { PlainDate } from './date.utils';

export interface HijriParts {
  /** The Hijri year, e.g. 1448. */
  year: number;
  /** 1–12, Muharram first. */
  month: number;
  /** 1–30. */
  day: number;
}

/** Umm al-Qura month names, in order. */
export const HIJRI_MONTHS_AR: readonly string[] = [
  'محرم',
  'صفر',
  'ربيع الأول',
  'ربيع الآخر',
  'جمادى الأولى',
  'جمادى الآخرة',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذو القعدة',
  'ذو الحجة',
];

export const HIJRI_MONTHS_EN: readonly string[] = [
  'Muharram',
  'Safar',
  "Rabi' al-Awwal",
  "Rabi' al-Thani",
  'Jumada al-Ula',
  'Jumada al-Akhirah',
  'Rajab',
  "Sha'ban",
  'Ramadan',
  'Shawwal',
  "Dhu al-Qi'dah",
  'Dhu al-Hijjah',
];

const MS_PER_DAY = 86_400_000;

/** 1 Muharram 1 AH in the proleptic Gregorian calendar. */
const EPOCH_UTC = Date.UTC(622, 6, 16);

const MEAN_YEAR_DAYS = 354.367_07;
const MEAN_MONTH_DAYS = 29.530_589;

/**
 * How far either side of the estimate to look.
 *
 * The mean-year drift against the published table stays inside a week over the
 * range Umm al-Qura covers; fifteen is that with room to spare, and thirty-one
 * `Intl` formats is nothing next to a network call.
 */
const SCAN_DAYS = 15;

let formatter: Intl.DateTimeFormat | null | undefined;

/**
 * `null` on a browser with no Umm al-Qura calendar, which is the signal for
 * every caller to fall back to Gregorian rather than to print a wrong date.
 */
function hijriFormatter(): Intl.DateTimeFormat | null {
  if (formatter !== undefined) return formatter;

  try {
    const candidate = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
      numberingSystem: 'latn',
    });
    // A browser that does not know the calendar silently resolves to Gregorian
    // rather than throwing, so ask it what it settled on.
    formatter = candidate.resolvedOptions().calendar === 'islamic-umalqura' ? candidate : null;
  } catch {
    formatter = null;
  }

  return formatter;
}

/** Whether this browser can do any of it. */
export function hijriSupported(): boolean {
  return hijriFormatter() !== null;
}

function partsOf(utcMs: number): HijriParts | null {
  const fmt = hijriFormatter();
  if (!fmt) return null;

  const out: Record<string, number> = {};
  for (const part of fmt.formatToParts(new Date(utcMs))) {
    if (part.type === 'year' || part.type === 'month' || part.type === 'day') {
      // The year part can carry an era suffix depending on the browser.
      out[part.type] = Number.parseInt(part.value.replace(/\D/g, ''), 10);
    }
  }

  const { year, month, day } = out;
  if (!year || !month || !day) return null;
  return { year, month, day };
}

/** The Umm al-Qura reading of a plain Gregorian date. */
export function toHijriParts(plain: PlainDate): HijriParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(plain);
  if (!match) return null;

  return partsOf(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

/**
 * The plain Gregorian date a Hijri one falls on, or `null` if that day does not
 * exist — a 30th in a 29-day month is the case that matters, and it has to be
 * `null` rather than rolled forward into the next month.
 */
export function fromHijriParts({ year, month, day }: HijriParts): PlainDate | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 30) return null;
  if (!hijriFormatter()) return null;

  const estimate =
    EPOCH_UTC +
    Math.round(
      ((year - 1) * MEAN_YEAR_DAYS + (month - 1) * MEAN_MONTH_DAYS + (day - 1)) * MS_PER_DAY,
    );

  for (let offset = -SCAN_DAYS; offset <= SCAN_DAYS; offset++) {
    const utcMs = estimate + offset * MS_PER_DAY;
    const parts = partsOf(utcMs);
    if (parts && parts.year === year && parts.month === month && parts.day === day) {
      return new Date(utcMs).toISOString().slice(0, 10);
    }
  }

  return null;
}

/** 29 or 30 — asked of the table rather than worked out. */
export function hijriMonthLength(year: number, month: number): number {
  return fromHijriParts({ year, month, day: 30 }) ? 30 : 29;
}

/** Today, in Umm al-Qura. */
export function hijriToday(): HijriParts | null {
  const now = new Date();
  return partsOf(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/** The month's name in the reader's language. */
export function hijriMonthName(month: number, lang: 'ar' | 'en'): string {
  const names = lang === 'ar' ? HIJRI_MONTHS_AR : HIJRI_MONTHS_EN;
  return names[month - 1] ?? '';
}
