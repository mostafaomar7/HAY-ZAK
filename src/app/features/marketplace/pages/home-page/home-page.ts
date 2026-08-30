import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import type { PublicUnitSummary } from '@core/models/public-unit';
import type { ReferenceItem } from '@core/models/unit.model';
import { ReferenceDataService } from '@core/services/reference-data.service';
import { todayPlain, toPlainDate } from '@core/utils/date.utils';
import {
  fromHijriParts,
  hijriMonthLength,
  hijriMonthName,
  hijriSupported,
  hijriToday,
  toHijriParts,
} from '@core/utils/hijri.utils';
import { controlChanges } from '@core/utils/form-signals';
import { UiButton } from '@shared/components/ui-button/ui-button';
import type { IconName } from '@shared/components/ui-icon/ui-icon';
import { UiIcon } from '@shared/components/ui-icon/ui-icon';
import { notPastDate } from '@shared/validators/saudi.validators';
import { UnitResultCard } from '../../components/unit-result-card/unit-result-card';
import { MarketplaceService } from '../../services/marketplace.service';

/** Which calendar the start-date field is *entered* in (NFR-USB-05). */
type Calendar = 'gregorian' | 'hijri';

/** How far ahead the Hijri year list runs — a start date, not a birthday. */
const HIJRI_YEARS_AHEAD = 2;

/** One of the three "كيف تعمل المنصة" cards. */
interface HowStep {
  readonly num: string;
  readonly icon: IconName;
  readonly titleKey: 'home.step1' | 'home.step2' | 'home.step3';
  readonly textKey: 'home.step1Text' | 'home.step2Text' | 'home.step3Text';
}

/** One of the five reasons in the band under the steps. */
interface Feature {
  readonly icon: IconName;
  readonly titleKey: 'home.why1' | 'home.why2' | 'home.why3' | 'home.why4' | 'home.why5';
  readonly textKey:
    'home.why1Text' | 'home.why2Text' | 'home.why3Text' | 'home.why4Text' | 'home.why5Text';
}

/**
 * The renter landing page (FR-MKT-01).
 *
 * Open to guests: the design's first binding rule is that browsing and search
 * never require an account, and registration only appears when "احجز الآن" is
 * pressed. Nothing here is guarded.
 *
 * Copy note — design rule 6 forbids any security promise (surveillance,
 * guarding, insurance) anywhere in the product, because SRS §3 item 1 records
 * that the platform cannot guarantee it. Keep new marketing strings clear of it.
 */
@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MarketplaceService],
  imports: [ReactiveFormsModule, RouterLink, UiButton, UiIcon, UnitResultCard],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage {
  private readonly fb = inject(FormBuilder);
  private readonly reference = inject(ReferenceDataService);
  private readonly marketplace = inject(MarketplaceService);
  private readonly router = inject(Router);

  protected readonly i18n = inject(LanguageService);

  protected readonly cities = signal<ReferenceItem[]>([]);
  protected readonly categories = signal<ReferenceItem[]>([]);
  protected readonly latest = signal<PublicUnitSummary[]>([]);
  protected readonly calendar = signal<Calendar>('gregorian');

  /**
   * What the Hijri selects are showing.
   *
   * Held apart from the form because a half-made choice is a real state: year
   * and month are seeded, the day is not, and there is no Gregorian date to
   * write until all three exist. Writing an incomplete guess into `startDate`
   * would put a date in the field that nobody picked.
   */
  protected readonly hijriYear = signal<number | null>(null);
  protected readonly hijriMonth = signal<number | null>(null);
  protected readonly hijriDay = signal<number | null>(null);

  /** No Umm al-Qura table in this browser — the toggle hides itself. */
  protected readonly hijriAvailable = hijriSupported();

  protected readonly minDate = todayPlain();

  /**
   * The hero photograph the design's prototype used, still served from
   * Unsplash. It is a placeholder for the client's own photography — replace it
   * with a file under `src/assets/`, and drop `images.unsplash.com` from the
   * CSP in `public/.htaccess` at the same time.
   */
  protected readonly heroPhoto =
    'https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=1800&q=70';

  /**
   * The quick picks under the search bar. Data-driven rather than a hardcoded
   * list of three category ids: the reference list is maintained on the admin
   * console, and a landing page naming its categories in code would go stale
   * the first time one is renamed.
   */
  protected readonly chips = computed(() => this.categories().slice(0, 3));

  protected readonly howSteps: readonly HowStep[] = [
    { num: '٠١', icon: 'search', titleKey: 'home.step1', textKey: 'home.step1Text' },
    { num: '٠٢', icon: 'file', titleKey: 'home.step2', textKey: 'home.step2Text' },
    { num: '٠٣', icon: 'check', titleKey: 'home.step3', textKey: 'home.step3Text' },
  ];

  protected readonly features: readonly Feature[] = [
    { icon: 'grid', titleKey: 'home.why1', textKey: 'home.why1Text' },
    { icon: 'check', titleKey: 'home.why2', textKey: 'home.why2Text' },
    { icon: 'refresh', titleKey: 'home.why3', textKey: 'home.why3Text' },
    { icon: 'pin', titleKey: 'home.why4', textKey: 'home.why4Text' },
    { icon: 'card', titleKey: 'home.why5', textKey: 'home.why5Text' },
  ];

  protected readonly form = this.fb.group({
    cityId: [''],
    categoryId: [''],
    startDate: ['', [notPastDate]],
    days: [7, [Validators.min(1), Validators.max(365)]],
  });

  private readonly changes = controlChanges(this.form);

  /**
   * The Hijri reading of whatever date is currently chosen.
   *
   * Shown under the Gregorian input so the two calendars are never in doubt,
   * and it is a *reading* — the value going to the API stays Gregorian, which
   * is the only thing the API accepts.
   */
  protected readonly hijriDate = computed(() => {
    this.changes();
    const parts = toHijriParts(this.form.controls.startDate.value ?? '');
    if (!parts) return '';

    const month = hijriMonthName(parts.month, this.i18n.language());
    return `${parts.day} ${month} ${parts.year} ${this.i18n.t('home.hijriSuffix')}`;
  });

  /** The current Hijri year and the two after it. */
  protected readonly hijriYears = computed(() => {
    const start = hijriToday()?.year ?? 0;
    if (!start) return [];
    return Array.from({ length: HIJRI_YEARS_AHEAD + 1 }, (_, i) => start + i);
  });

  protected readonly hijriMonths = computed(() =>
    Array.from({ length: 12 }, (_, i) => ({
      value: i + 1,
      label: hijriMonthName(i + 1, this.i18n.language()),
    })),
  );

  /**
   * 29 or 30, asked of the calendar rather than assumed.
   *
   * Umm al-Qura months alternate by observation, not by rule, so offering a
   * 30th in a 29-day month would produce a date that does not exist — and the
   * conversion would then answer `null` for a day the person had just chosen.
   */
  protected readonly hijriDays = computed(() => {
    const year = this.hijriYear();
    const month = this.hijriMonth();
    if (!year || !month) return [];
    return Array.from({ length: hijriMonthLength(year, month) }, (_, i) => i + 1);
  });

  /** The Gregorian date the Hijri choice lands on — the reassurance line. */
  protected readonly hijriGregorian = computed(() => {
    this.changes();
    return this.calendar() === 'hijri' ? (this.form.controls.startDate.value ?? '') : '';
  });

  /** Set once the person has picked a day that turned out to be in the past. */
  protected readonly startDateInPast = computed(() => {
    this.changes();
    return this.form.controls.startDate.hasError('notPastDate');
  });

  constructor() {
    this.reference.cities().subscribe({
      next: (list) => this.cities.set(list),
      error: () => this.cities.set([]),
    });
    this.reference.categories().subscribe({
      next: (list) => this.categories.set(list),
      error: () => this.categories.set([]),
    });

    // "أحدث المساحات" — four newest, and the section hides itself if the call
    // fails. A landing page that renders an error box above the fold reads as a
    // broken site; the rest of it is still perfectly usable.
    this.marketplace.search({ sort: 'newest', pageSize: 4 }).subscribe({
      next: (page) => this.latest.set(page.items.slice(0, 4)),
      error: () => this.latest.set([]),
    });
  }

  /** The tile icon for a category, falling back to a generic box. */
  protected iconFor(categoryId: string): IconName {
    return CATEGORY_ICONS[categoryId] ?? 'box';
  }

  /**
   * Switching to Hijri seeds the selects from the date already chosen, or from
   * today when there is none — so the month list opens somewhere sensible
   * rather than on "اختر". The day is left unset in the second case: a seeded
   * day would be a date the person never picked.
   */
  protected setCalendar(calendar: Calendar): void {
    this.calendar.set(calendar);
    if (calendar !== 'hijri') return;

    const chosen = toHijriParts(this.form.controls.startDate.value ?? '');
    const seed = chosen ?? hijriToday();
    if (!seed) return;

    this.hijriYear.set(seed.year);
    this.hijriMonth.set(seed.month);
    this.hijriDay.set(chosen ? seed.day : null);
  }

  protected setHijriYear(value: string): void {
    this.hijriYear.set(Number(value) || null);
    this.clampHijriDay();
    this.commitHijri();
  }

  protected setHijriMonth(value: string): void {
    this.hijriMonth.set(Number(value) || null);
    this.clampHijriDay();
    this.commitHijri();
  }

  protected setHijriDay(value: string): void {
    this.hijriDay.set(Number(value) || null);
    this.commitHijri();
  }

  /** A 30th survives a move into a 29-day month by becoming the 29th. */
  private clampHijriDay(): void {
    const year = this.hijriYear();
    const month = this.hijriMonth();
    const day = this.hijriDay();
    if (!year || !month || !day) return;

    this.hijriDay.set(Math.min(day, hijriMonthLength(year, month)));
  }

  /**
   * Writes the Gregorian equivalent into the form — the one value the search
   * and the API ever see. Nothing is written until all three parts exist.
   */
  private commitHijri(): void {
    const year = this.hijriYear();
    const month = this.hijriMonth();
    const day = this.hijriDay();
    if (!year || !month || !day) return;

    const plain = fromHijriParts({ year, month, day });
    if (plain) this.form.controls.startDate.setValue(plain);
  }

  protected stepDays(by: number): void {
    const control = this.form.controls.days;
    const next = Math.min(365, Math.max(1, (control.value ?? 1) + by));
    control.setValue(next);
  }

  /** Everything is optional — an empty search is a valid "show me everything". */
  protected search(): void {
    const { cityId, categoryId, startDate, days } = this.form.getRawValue();

    // A date window is both ends or neither: one end of a range excludes
    // nothing, and the API refuses a half of one outright. The hero asks for a
    // start and a length, so the far end is worked out here rather than left
    // for the results page to guess at.
    const endDate = startDate ? addDays(startDate, Math.max(1, days ?? 1)) : null;

    void this.router.navigate(['/units'], {
      queryParams: {
        cityId: cityId || null,
        categoryId: categoryId || null,
        startDate: startDate || null,
        endDate,
      },
    });
  }
}

/**
 * Category id to icon. A map rather than a field on the reference item: the
 * icon is a property of this application's icon set, not of the seed data an
 * operator maintains, and an operator adding a category should not have to know
 * which glyphs exist.
 */
const CATEGORY_ICONS: Readonly<Record<string, IconName>> = {
  warehouse: 'warehouse',
  room: 'room',
  garage: 'garage',
  open_space: 'open-space',
};

/**
 * `YYYY-MM-DD` plus a number of days, half-open — the end is the first day the
 * space is free again.
 */
function addDays(plain: string, days: number): string {
  const date = new Date(`${plain}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toPlainDate(date);
}
