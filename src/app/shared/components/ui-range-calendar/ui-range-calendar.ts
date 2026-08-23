import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { LanguageService } from '@core/i18n/language.service';
import { toIsoDate } from '@core/utils/date.utils';

export interface DateRange {
  start: string;
  end: string;
  days: number;
}

/** Which calendar the day numbers are read in (NFR-USB-05). */
export type CalendarSystem = 'gregorian' | 'hijri';

interface DayCell {
  iso: string;
  /** Day number in the active calendar; empty for the leading blanks. */
  label: string;
  blank: boolean;
  past: boolean;
  blocked: boolean;
  isStart: boolean;
  isEnd: boolean;
  inRange: boolean;
}

interface MonthGrid {
  key: string;
  title: string;
  cells: DayCell[];
}

const MS_PER_DAY = 86_400_000;

/**
 * Date-range picker for booking a space (FR-BKG-01, FR-UNT-08).
 *
 * Four things make this a component rather than two `<input type="date">`s, and
 * each maps to a requirement:
 *
 * - Booked days must be visibly unavailable, not merely rejected on submit
 *   (FR-UNT-08). A native date input cannot grey out a scattered set of days.
 * - A range that spans a booked day has to be refused *as it is drawn*, with the
 *   selection capped at the day before rather than silently discarded.
 * - Minimum and maximum stay are per-unit, so the error text has to name the
 *   unit's own limits.
 * - NFR-USB-05 asks for Hijri alongside Gregorian. The toggle relabels the same
 *   days through the Umm al-Qura calendar; the value emitted is always the ISO
 *   Gregorian date, so nothing downstream has to know a second calendar exists.
 *
 * Month names and weekday names come from `Intl` in the active language, so the
 * English switch is not a second hard-coded table that can drift.
 */
@Component({
  selector: 'app-ui-range-calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'onEscape()' },
  templateUrl: './ui-range-calendar.html',
  styleUrl: './ui-range-calendar.scss',
})
export class UiRangeCalendar {
  protected readonly i18n = inject(LanguageService);

  readonly startDate = input('');
  readonly endDate = input('');
  readonly minDays = input(1);
  readonly maxDays = input(365);
  /** ISO days that are already taken — the API's availability blocks, expanded. */
  readonly blockedDates = input<readonly string[]>([]);
  /** Overridable so tests are not tied to the wall clock. */
  readonly today = input(toIsoDate(new Date()));
  readonly initiallyOpen = input(false, { transform: booleanAttribute });
  /** One month instead of two — the phone layout and narrow side panels. */
  readonly compact = input(false, { transform: booleanAttribute });

  readonly rangeChange = output<DateRange>();

  // linkedSignal, not a plain signal: the parent may hand down a new range (the
  // "choose an alternative period" flow does exactly that) and the picker has to
  // follow without the parent destroying it.
  protected readonly selectedStart = linkedSignal(() => this.startDate());
  protected readonly selectedEnd = linkedSignal(() => this.endDate());

  protected readonly open = linkedSignal(() => this.initiallyOpen());
  protected readonly calendar = signal<CalendarSystem>('gregorian');
  protected readonly hovered = signal<string | null>(null);
  protected readonly error = signal('');

  /** Which month sits leftmost in the panel; null means "follow the selection". */
  private readonly cursor = signal<{ year: number; month: number } | null>(null);

  private readonly blockedSet = computed(() => new Set(this.blockedDates()));

  protected readonly days = computed(() => {
    const start = this.selectedStart();
    const end = this.selectedEnd();
    return start && end ? diffDays(start, end) : 0;
  });

  protected readonly weekdayNames = computed(() => {
    const formatter = new Intl.DateTimeFormat(this.locale(), { weekday: 'short' });
    // 2024-01-07 was a Sunday — the first column in a Saudi week.
    return Array.from({ length: 7 }, (_, index) => formatter.format(new Date(2024, 0, 7 + index)));
  });

  protected readonly months = computed<MonthGrid[]>(() => {
    const anchor = this.anchorMonth();
    const grids = [this.buildMonth(anchor.year, anchor.month)];

    if (!this.compact()) {
      const next = new Date(anchor.year, anchor.month + 1, 1);
      grids.push(this.buildMonth(next.getFullYear(), next.getMonth()));
    }
    return grids;
  });

  protected readonly headerTitle = computed(() => {
    const grids = this.months();
    return grids.length === 1 ? grids[0].title : `${grids[0].title} — ${grids[1].title}`;
  });

  /** The month before the current one is only reachable if it holds a bookable day. */
  protected readonly canGoBack = computed(() => {
    const anchor = this.anchorMonth();
    const today = parseIso(this.today());
    return (
      new Date(anchor.year, anchor.month, 1) > new Date(today.getFullYear(), today.getMonth(), 1)
    );
  });

  protected readonly startLabel = computed(() => this.longDate(this.selectedStart()));
  protected readonly startSubLabel = computed(() => this.hijriDate(this.selectedStart()));
  protected readonly endLabel = computed(() =>
    this.selectedEnd() ? this.longDate(this.selectedEnd()) : this.i18n.t('calendar.choose'),
  );
  protected readonly endSubLabel = computed(() =>
    this.selectedEnd() ? this.hijriDate(this.selectedEnd()) : this.i18n.t('common.notAvailable'),
  );

  protected readonly summary = computed(() => {
    if (!this.selectedEnd()) return this.i18n.t('calendar.chooseEnd');

    const gregorian = this.i18n.t('calendar.summary', {
      start: this.longDate(this.selectedStart()),
      end: this.longDate(this.selectedEnd()),
      days: this.days(),
    });

    if (this.calendar() === 'gregorian') return gregorian;

    return this.i18n.t('calendar.summary', {
      start: this.hijriDate(this.selectedStart()),
      end: this.hijriDate(this.selectedEnd()),
      days: this.days(),
    });
  });

  /** The other calendar's reading of the same range, shown underneath. */
  protected readonly summarySub = computed(() => {
    if (!this.selectedEnd()) return '';
    return this.calendar() === 'gregorian'
      ? `${this.hijriDate(this.selectedStart())} — ${this.hijriDate(this.selectedEnd())}`
      : `${this.longDate(this.selectedStart())} — ${this.longDate(this.selectedEnd())}`;
  });

  protected readonly closedSummary = computed(() =>
    this.selectedEnd()
      ? `${this.longDate(this.selectedStart())} — ${this.longDate(this.selectedEnd())}`
      : this.i18n.t('calendar.minDays', { count: this.minDays() }),
  );

  protected toggleOpen(): void {
    this.open.update((value) => !value);
    this.error.set('');
  }

  protected onEscape(): void {
    if (this.open()) this.open.set(false);
  }

  protected setCalendar(system: CalendarSystem): void {
    this.calendar.set(system);
  }

  protected shiftMonth(delta: number): void {
    if (delta < 0 && !this.canGoBack()) return;
    const anchor = this.anchorMonth();
    const moved = new Date(anchor.year, anchor.month + delta, 1);
    this.cursor.set({ year: moved.getFullYear(), month: moved.getMonth() });
  }

  /**
   * One tap does everything: the first sets the start, the second closes the
   * range, and a tap before the current start restarts from there. Two separate
   * "pick start" / "pick end" modes were the alternative and read worse on a
   * phone, where the design puts this in a bottom sheet.
   */
  protected pick(cell: DayCell): void {
    if (cell.blank || cell.past || cell.blocked) return;

    const start = this.selectedStart();
    const hasOpenRange = !!start && !this.selectedEnd();

    if (!hasOpenRange || cell.iso <= start) {
      this.selectedStart.set(cell.iso);
      this.selectedEnd.set('');
      this.hovered.set(null);
      this.error.set('');
      return;
    }

    const blocker = this.firstBlockedBetween(start, cell.iso);
    if (blocker) {
      // Cap at the day before the block rather than dropping the whole gesture —
      // the user's intent was "from here to about there", and a silent no-op
      // reads as the calendar being broken.
      const capped = addDays(blocker, -1);
      this.error.set(this.i18n.t('calendar.blockedInRange'));
      this.hovered.set(null);
      if (diffDays(start, capped) >= this.minDays()) this.commit(start, capped);
      return;
    }

    const length = diffDays(start, cell.iso);
    if (length < this.minDays()) {
      this.error.set(this.i18n.t('calendar.minDays', { count: this.minDays() }));
      return;
    }
    if (length > this.maxDays()) {
      this.error.set(this.i18n.t('calendar.maxDays', { count: this.maxDays() }));
      return;
    }

    this.error.set('');
    this.hovered.set(null);
    this.commit(start, cell.iso);
  }

  protected hover(cell: DayCell): void {
    if (cell.blank || cell.past || cell.blocked) return;
    if (!this.selectedStart() || this.selectedEnd()) return;
    if (cell.iso <= this.selectedStart()) return;
    this.hovered.set(cell.iso);
  }

  protected clearHover(): void {
    this.hovered.set(null);
  }

  protected confirm(): void {
    if (!this.selectedEnd()) {
      this.error.set(this.i18n.t('calendar.chooseEnd'));
      return;
    }
    this.open.set(false);
    this.error.set('');
    this.emit();
  }

  protected reset(): void {
    this.selectedEnd.set('');
    this.hovered.set(null);
    this.error.set('');
  }

  protected dayAriaLabel(cell: DayCell): string {
    const date = this.longDate(cell.iso);
    if (cell.blocked) return `${date} — ${this.i18n.t('calendar.blocked')}`;
    if (cell.past) return `${date} — ${this.i18n.t('calendar.past')}`;
    return date;
  }

  private commit(start: string, end: string): void {
    this.selectedStart.set(start);
    this.selectedEnd.set(end);
    this.emit();
  }

  private emit(): void {
    const start = this.selectedStart();
    const end = this.selectedEnd();
    if (!start || !end) return;
    this.rangeChange.emit({ start, end, days: diffDays(start, end) });
  }

  private anchorMonth(): { year: number; month: number } {
    const explicit = this.cursor();
    if (explicit) return explicit;

    const from = parseIso(this.selectedStart() || this.today());
    return { year: from.getFullYear(), month: from.getMonth() };
  }

  private firstBlockedBetween(start: string, end: string): string | null {
    const blocked = [...this.blockedSet()].filter((day) => day > start && day <= end).sort();
    return blocked[0] ?? null;
  }

  private buildMonth(year: number, month: number): MonthGrid {
    const today = this.today();
    const start = this.selectedStart();
    const hoverEnd = !this.selectedEnd() ? this.hovered() : null;
    const rangeEnd = this.selectedEnd() || hoverEnd;
    const blocked = this.blockedSet();

    const leading = new Date(year, month, 1).getDay();
    const length = new Date(year, month + 1, 0).getDate();
    const cells: DayCell[] = [];

    for (let index = 0; index < leading; index++) {
      cells.push(blankCell(`${year}-${month}-blank-${index}`));
    }

    for (let day = 1; day <= length; day++) {
      const iso = `${year}-${pad(month + 1)}-${pad(day)}`;
      cells.push({
        iso,
        label: this.calendar() === 'gregorian' ? String(day) : hijriDayNumber(iso),
        blank: false,
        past: iso < today,
        blocked: blocked.has(iso),
        isStart: iso === start,
        isEnd: !!rangeEnd && iso === rangeEnd,
        inRange: !!rangeEnd && iso > start && iso < rangeEnd,
      });
    }

    return {
      key: `${year}-${pad(month + 1)}`,
      title: new Intl.DateTimeFormat(this.locale(), { month: 'long', year: 'numeric' }).format(
        new Date(year, month, 1),
      ),
      cells,
    };
  }

  private locale(): string {
    return this.i18n.language() === 'en' ? 'en-GB' : 'ar-SA';
  }

  private longDate(iso: string): string {
    if (!iso) return '';
    return new Intl.DateTimeFormat(this.locale(), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(parseIso(iso));
  }

  private hijriDate(iso: string): string {
    if (!iso) return '';
    try {
      return new Intl.DateTimeFormat(`${this.locale()}-u-ca-islamic-umalqura`, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(parseIso(iso));
    } catch {
      // A runtime without the calendar drops the secondary line rather than
      // printing a date that is quietly wrong.
      return '';
    }
  }
}

function blankCell(key: string): DayCell {
  return {
    iso: key,
    label: '',
    blank: true,
    past: false,
    blocked: false,
    isStart: false,
    isEnd: false,
    inRange: false,
  };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Parsed as local midnight — `new Date('2026-08-12')` is UTC and shifts a day. */
function parseIso(iso: string): Date {
  return new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
}

function diffDays(from: string, to: string): number {
  return Math.round((parseIso(to).getTime() - parseIso(from).getTime()) / MS_PER_DAY);
}

function addDays(iso: string, delta: number): string {
  const date = parseIso(iso);
  date.setDate(date.getDate() + delta);
  return toIsoDate(date);
}

function hijriDayNumber(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric' }).format(
      parseIso(iso),
    );
  } catch {
    return iso.slice(8, 10);
  }
}

/** Expands API availability blocks into the flat list of ISO days this needs. */
export function expandBlockedDates(
  blocks: readonly { startDate: string; endDate: string }[],
): string[] {
  const days: string[] = [];

  for (const block of blocks) {
    let cursor = block.startDate;
    // Guard the loop: a malformed block with end before start must not hang the page.
    while (cursor <= block.endDate && days.length < 3_650) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
    }
  }
  return days;
}
