import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { LanguageService } from '@core/i18n/language.service';
import { todayPlain } from '@core/utils/date.utils';
import type { HijriParts } from '@core/utils/hijri.utils';
import {
  fromHijriParts,
  hijriMonthLength,
  hijriMonthName,
  hijriToday,
  toHijriParts,
} from '@core/utils/hijri.utils';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';

interface DayCell {
  /** The plain Gregorian date this square stands for. */
  iso: string;
  /** The Hijri day number. */
  day: number;
  disabled: boolean;
}

/**
 * A month grid for picking one date in Umm al-Qura (NFR-USB-05).
 *
 * The point is that the *grid* is Hijri: a month runs 1 to 29 or 1 to 30 by the
 * published table, and the arrows step a Hijri month rather than a Gregorian
 * one. A Gregorian grid with Hijri numerals written in it — which is what
 * `UiRangeCalendar`'s toggle does, correctly, for a range — cannot be paged
 * that way, and a person entering a date in Hijri is thinking in Hijri months.
 *
 * The value in and out is always a plain Gregorian `YYYY-MM-DD`. Nothing
 * downstream learns that a second calendar exists, which is the same contract
 * the range picker keeps.
 *
 * Every square comes from the conversion rather than from arithmetic, so a
 * month that has no 30th simply has no thirtieth square.
 */
@Component({
  selector: 'app-ui-hijri-date',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ClickOutsideDirective],
  host: { '(document:keydown.escape)': 'close()' },
  templateUrl: './ui-hijri-date.html',
  styleUrl: './ui-hijri-date.scss',
})
export class UiHijriDate {
  protected readonly i18n = inject(LanguageService);

  /** Plain Gregorian `YYYY-MM-DD`, or empty for no choice yet. */
  readonly value = input('');
  /** The earliest selectable day, plain Gregorian. Defaults to today. */
  readonly min = input(todayPlain());
  /** Placeholder on the closed trigger. */
  readonly placeholder = input('');
  /** How many Hijri years past the current one the arrows may reach. */
  readonly yearsAhead = input(3);

  readonly valueChange = output<string>();

  protected readonly open = signal(false);

  /** The Hijri reading of the current value, or null when there is none. */
  protected readonly selected = computed(() => toHijriParts(this.value()));

  /**
   * The month on screen. A `linkedSignal` so a value handed down from the
   * parent re-anchors the grid, while paging with the arrows still holds.
   */
  protected readonly cursor = linkedSignal<HijriParts | null>(
    () => this.selected() ?? toHijriParts(this.min()) ?? hijriToday(),
  );

  protected readonly weekdayNames = computed(() => {
    const formatter = new Intl.DateTimeFormat(this.locale(), { weekday: 'narrow' });
    // 2024-01-07 was a Sunday, the first column of a Saudi week.
    return Array.from({ length: 7 }, (_, i) => formatter.format(new Date(2024, 0, 7 + i)));
  });

  protected readonly title = computed(() => {
    const at = this.cursor();
    if (!at) return '';
    return `${hijriMonthName(at.month, this.i18n.language())} ${at.year}`;
  });

  /** The trigger's label: the Hijri date, with the Gregorian one beneath it. */
  protected readonly label = computed(() => {
    const parts = this.selected();
    if (!parts) return this.placeholder();
    const month = hijriMonthName(parts.month, this.i18n.language());
    return `${parts.day} ${month} ${parts.year} ${this.i18n.t('home.hijriSuffix')}`;
  });

  protected readonly subLabel = computed(() => this.value());

  /**
   * Leading blanks then one square per day the month actually has.
   *
   * `fromHijriParts` decides both: the length comes from it, and a day it
   * cannot place is skipped rather than drawn as an unusable square.
   */
  protected readonly cells = computed<(DayCell | null)[]>(() => {
    const at = this.cursor();
    if (!at) return [];

    const min = this.min();
    const length = hijriMonthLength(at.year, at.month);
    const days: DayCell[] = [];

    for (let day = 1; day <= length; day++) {
      const iso = fromHijriParts({ year: at.year, month: at.month, day });
      if (iso) days.push({ iso, day, disabled: !!min && iso < min });
    }

    if (!days.length) return [];

    const lead = new Date(`${days[0].iso}T00:00:00`).getDay();
    return [...(Array.from({ length: lead }) as null[]), ...days];
  });

  /** The first month is the one holding `min`; there is nothing before it. */
  protected readonly canGoBack = computed(() => {
    const at = this.cursor();
    const floor = toHijriParts(this.min());
    if (!at || !floor) return true;
    return at.year > floor.year || (at.year === floor.year && at.month > floor.month);
  });

  protected readonly canGoForward = computed(() => {
    const at = this.cursor();
    const now = hijriToday();
    if (!at || !now) return true;
    return at.year < now.year + this.yearsAhead();
  });

  protected toggle(): void {
    this.open.update((open) => !open);
  }

  protected close(): void {
    this.open.set(false);
  }

  protected shiftMonth(by: number): void {
    const at = this.cursor();
    if (!at) return;

    const index = at.year * 12 + (at.month - 1) + by;
    this.cursor.set({ year: Math.floor(index / 12), month: (index % 12) + 1, day: 1 });
  }

  protected pick(cell: DayCell): void {
    if (cell.disabled) return;
    this.valueChange.emit(cell.iso);
    this.close();
  }

  protected isSelected(cell: DayCell): boolean {
    return cell.iso === this.value();
  }

  protected dayLabel(cell: DayCell): string {
    const at = this.cursor();
    if (!at) return String(cell.day);
    return `${cell.day} ${hijriMonthName(at.month, this.i18n.language())} ${at.year}`;
  }

  private locale(): string {
    return this.i18n.language() === 'ar' ? 'ar-SA' : 'en-GB';
  }
}
