import type { VisitWindow, Weekday } from '../models/unit.model';

/**
 * Turning a visiting-hours schedule into the words on screen (FR-UNT-06).
 *
 * Three screens render the same schedule — the renter's details page, the
 * lessor's own listing, and the booking record — so the grouping and the
 * wording live here rather than three times over.
 *
 * Day names come from `Intl`, not a table: the English switch then needs no
 * second list that can drift from the Arabic one.
 */

/** A week whose 5th is a Sunday, used only to name weekdays. 2024-01-07 is one. */
const REFERENCE_SUNDAY = new Date(2024, 0, 7);

export function weekdayName(day: Weekday, locale: string): string {
  const date = new Date(REFERENCE_SUNDAY);
  date.setDate(date.getDate() + day);
  return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date);
}

/**
 * "الأحد — الخميس" for a run, "الجمعة والسبت" for a pair, "الأحد" for one.
 *
 * A run is collapsed only from three days up: "الأحد — الاثنين" reads worse
 * than naming both, and is no shorter.
 */
export function formatWeekdays(days: readonly Weekday[], locale: string): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 0) return '';

  const names = sorted.map((day) => weekdayName(day, locale));
  if (sorted.length === 1) return names[0];

  const isRun = sorted.every((day, index) => index === 0 || day === sorted[index - 1] + 1);
  if (isRun && sorted.length >= 3) return `${names[0]} — ${names[names.length - 1]}`;

  // ListFormat gives the locale its own conjunction — "و" in Arabic, "and" in
  // English — without either being written out here.
  return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(names);
}

/**
 * "9:00 — 21:00", always read left to right.
 *
 * The caller wraps this in `dir="ltr"`; a time range inside an Arabic run is
 * reordered by the bidi algorithm and comes out with the closing time first.
 */
export function formatTimeRange(from: string, to: string): string {
  return `${trimLeadingZero(from)} — ${trimLeadingZero(to)}`;
}

/** One line for the places too small for the full table. */
export function summariseSchedule(windows: readonly VisitWindow[], locale: string): string {
  return windows
    .map(
      (window) =>
        `${formatWeekdays(window.days, locale)} ${formatTimeRange(window.from, window.to)}`,
    )
    .join(' · ');
}

/** Which days of the week the schedule leaves out — the lessor's own warning. */
export function uncoveredDays(windows: readonly VisitWindow[]): Weekday[] {
  const covered = new Set(windows.flatMap((window) => window.days));
  return ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).filter((day) => !covered.has(day));
}

/**
 * A window is usable when it names at least one day and closes after it opens.
 *
 * String comparison is safe and deliberate: the format is zero-padded 24-hour,
 * so "09:00" < "21:00" lexically as well as chronologically, and no Date is
 * built for a value that carries no date.
 */
export function isValidWindow(window: VisitWindow): boolean {
  return window.days.length > 0 && !!window.from && !!window.to && window.from < window.to;
}

/** "09:00" reads as an hour; "9:00" is how the design writes it. */
function trimLeadingZero(time: string): string {
  return time.startsWith('0') ? time.slice(1) : time;
}
