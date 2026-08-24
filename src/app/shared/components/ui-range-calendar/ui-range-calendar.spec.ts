import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { DateRange } from './ui-range-calendar';
import { UiRangeCalendar, expandBlockedDates } from './ui-range-calendar';

/**
 * The calendar is the one new component with real rules inside it — minimum and
 * maximum stay, and a refusal to draw a range across booked days (FR-UNT-08).
 * Those are booking-correctness rules, not styling, so they are tested through
 * the DOM the way a renter drives them.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiRangeCalendar],
  template: `
    <app-ui-range-calendar
      initiallyOpen
      compact
      [today]="today"
      [startDate]="start()"
      [minDays]="3"
      [maxDays]="30"
      [blockedDates]="blocked"
      (rangeChange)="onRange($event)"
    />
  `,
})
class Host {
  readonly today = '2026-08-10';
  readonly start = signal('2026-08-12');
  readonly blocked = ['2026-08-20', '2026-08-21'];

  emitted: DateRange | null = null;

  onRange(range: DateRange): void {
    this.emitted = range;
  }
}

describe('UiRangeCalendar', () => {
  let fixture: ComponentFixture<Host>;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();

    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  /** Finds a day button by its accessible label, which carries the full date. */
  function day(iso: string): HTMLButtonElement | undefined {
    const label = new Intl.DateTimeFormat('ar-SA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(
      new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))),
    );

    return Array.from(el.querySelectorAll<HTMLButtonElement>('.day')).find((button) =>
      button.getAttribute('aria-label')?.startsWith(label),
    );
  }

  it('disables days before today', () => {
    // The month opens on August 2026 and today is the 10th.
    expect(day('2026-08-09')?.disabled).withContext('yesterday').toBeTrue();
    expect(day('2026-08-14')?.disabled).withContext('a future day').toBeFalse();
  });

  it('disables booked days and marks them as booked for assistive tech', () => {
    const booked = day('2026-08-20');

    expect(booked?.disabled).toBeTrue();
    expect(booked?.getAttribute('aria-label')).toContain('محجوز');
    expect(booked?.classList).toContain('day--blocked');
  });

  // FR-BKG-01 — the minimum stay is the unit's own, so it has to be enforced
  // here rather than left to the server to reject after the fact.
  it('refuses a range shorter than the minimum stay', () => {
    day('2026-08-12')?.click();
    day('2026-08-13')?.click();
    fixture.detectChanges();

    expect(el.querySelector('.panel__error')?.textContent).toContain('أقل مدة');
    expect(fixture.componentInstance.emitted).toBeNull();
  });

  it('refuses a range longer than the maximum stay', () => {
    day('2026-08-12')?.click();
    day('2026-09-30')?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.emitted).toBeNull();
  });

  it('emits a valid range and shows both calendars for it', () => {
    day('2026-08-12')?.click();
    day('2026-08-16')?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.emitted).toEqual({
      start: '2026-08-12',
      end: '2026-08-16',
      days: 4,
    });

    // NFR-USB-05 — the Hijri reading of the same range sits under the Gregorian.
    expect(el.querySelector('.panel__summarySub')?.textContent?.trim()).not.toBe('');
  });

  /**
   * The behaviour that motivated the component: a range drawn over a booked day
   * is capped at the day before, with an explanation — not silently discarded.
   */
  it('caps a range at the day before a booked one', () => {
    day('2026-08-12')?.click();
    day('2026-08-25')?.click();
    fixture.detectChanges();

    expect(el.querySelector('.panel__error')?.textContent).toContain('محجوزة');
    expect(fixture.componentInstance.emitted?.end).toBe('2026-08-19');
  });

  it('relabels the days in the Hijri calendar without changing the value', () => {
    day('2026-08-12')?.click();
    day('2026-08-16')?.click();
    fixture.detectChanges();

    const gregorianLabel = day('2026-08-12')?.textContent?.trim();

    const hijriToggle = Array.from(el.querySelectorAll<HTMLButtonElement>('.switch__opt')).at(-1);
    hijriToggle?.click();
    fixture.detectChanges();

    expect(day('2026-08-12')?.textContent?.trim()).not.toBe(gregorianLabel);
    // The emitted value is still the ISO Gregorian date.
    expect(fixture.componentInstance.emitted?.start).toBe('2026-08-12');
  });

  it('follows a range handed down by the parent', () => {
    fixture.componentInstance.start.set('2026-09-01');
    fixture.detectChanges();

    expect(el.querySelector('.field__main')?.textContent).toContain('سبتمبر');
  });
});

describe('expandBlockedDates', () => {
  /**
   * The range is half-open. A stay of `[20, 23)` occupies three nights and
   * hands the unit back on the 23rd, so the 23rd stays for sale — marking it
   * taken would cost the lessor a bookable day on every neighbouring booking.
   */
  it('covers the nights a block occupies and releases its end date', () => {
    expect(expandBlockedDates([{ startDate: '2026-09-20', endDate: '2026-09-23' }])).toEqual([
      '2026-09-20',
      '2026-09-21',
      '2026-09-22',
    ]);
  });

  it('lets one block start on the day the previous one ends', () => {
    const days = expandBlockedDates([
      { startDate: '2026-09-20', endDate: '2026-09-23' },
      { startDate: '2026-09-23', endDate: '2026-09-25' },
    ]);

    // No day is claimed twice, and the join is seamless.
    expect(days).toEqual(new Array(...new Set(days)));
    expect(days).toContain('2026-09-23');
  });

  it('yields nothing for a block whose end precedes its start', () => {
    // A malformed block must not spin the loop that walks it.
    expect(expandBlockedDates([{ startDate: '2026-09-20', endDate: '2026-09-01' }])).toEqual([]);
  });
});
