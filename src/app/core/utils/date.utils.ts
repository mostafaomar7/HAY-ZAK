/**
 * Two kinds of date travel over the API and they are not interchangeable.
 *
 * **Plain dates** — `startDate`, `endDate` and anything else a booking is
 * measured in. `"2026-10-10"`. No time, no timezone, no instant: the tenth of
 * October is the tenth of October wherever the reader is sitting.
 *
 * `new Date("2026-10-10")` is the trap. JavaScript reads a bare date string as
 * **UTC midnight**, so in any negative offset it renders as the ninth — the
 * customer sees one start date on the confirmation and another on the invoice.
 * Nothing in this file hands a plain date to that constructor. They are
 * compared as strings (ISO sorts lexically), and where a real `Date` is
 * unavoidable — a calendar grid needs one — it is built field by field at local
 * midnight, which is a position on a grid rather than a moment in time.
 *
 * **Instants** — `createdAt`, `expiresAt`, everything else. ISO 8601 UTC, a
 * real moment, displayed in Asia/Riyadh.
 *
 * Ranges are half-open: `[start, end)`. The 10th to the 15th is five nights,
 * the 10th through the 14th, and the unit is free again on the 15th. A picker
 * that refuses to let the next renter start on the 15th quietly costs every
 * unit a bookable day per booking.
 */

import { APP } from '../constants/app.constants';

/** `YYYY-MM-DD`. A calendar day, not a moment. */
export type PlainDate = string;

const MS_PER_DAY = 86_400_000;

// ── Plain dates ──────────────────────────────────────────────────────────

/** The local calendar day, as the server wants it written. */
export function todayPlain(): PlainDate {
  return toPlainDate(new Date());
}

/** A `Date` down to the calendar day it falls on locally. */
export function toPlainDate(date: Date): PlainDate {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

/**
 * A plain date as local midnight — for laying out a calendar grid, and for
 * nothing else. The result is a position, not an instant, and must never be
 * sent back to the server or compared against one.
 */
export function plainToLocalDate(date: PlainDate): Date {
  return new Date(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
  );
}

/** ISO dates sort lexically, so this needs no parsing at all. */
export function comparePlain(a: PlainDate, b: PlainDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isPastPlain(date: PlainDate): boolean {
  return date < todayPlain();
}

export function addDaysPlain(date: PlainDate, days: number): PlainDate {
  const moved = plainToLocalDate(date);
  moved.setDate(moved.getDate() + days);
  return toPlainDate(moved);
}

/**
 * Nights in the half-open range `[start, end)`.
 *
 * 10 → 15 is 5. Reversed ranges give 0 rather than a negative, so a half-made
 * selection cannot price a booking at minus three days.
 */
export function nightsBetween(start: PlainDate, end: PlainDate): number {
  const ms = plainToLocalDate(end).getTime() - plainToLocalDate(start).getTime();
  return Math.max(0, Math.round(ms / MS_PER_DAY));
}

/**
 * The days a half-open booking actually occupies: `start` up to but excluding
 * `end`. The one place the rule is written down, so a picker, an availability
 * check and a summary line cannot each interpret it differently.
 */
export function occupiedDays(start: PlainDate, end: PlainDate): PlainDate[] {
  const days: PlainDate[] = [];
  // Bounded so a malformed range from the API cannot spin the page.
  for (let day = start; day < end && days.length < 3_650; day = addDaysPlain(day, 1)) {
    days.push(day);
  }
  return days;
}

export function formatPlain(date: PlainDate, locale = APP.locale): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(plainToLocalDate(date));
}

// ── Instants ─────────────────────────────────────────────────────────────

export function isPastInstant(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

/**
 * Seconds left until a server-set deadline.
 *
 * Countdowns are computed against `expiresAt`, never against a timer the
 * client started: a 15-minute hold that began when the server said so is not
 * 15 minutes from when this tab happened to render, and a device with a skewed
 * clock or a tab that slept must not show time the booking no longer has.
 */
export function secondsUntil(iso: string): number {
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
}

/** An instant in the platform's timezone (SRS §2.4 — Asia/Riyadh). */
export function formatInstant(iso: string, locale = APP.locale): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: APP.timezone,
  }).format(new Date(iso));
}
