import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import type { ReferenceItem, Unit } from '@core/models/unit.model';
import { ReferenceDataService } from '@core/services/reference-data.service';
import { toIsoDate } from '@core/utils/date.utils';
import { UiButton } from '@shared/components/ui-button/ui-button';
import type { IconName } from '@shared/components/ui-icon/ui-icon';
import { UiIcon } from '@shared/components/ui-icon/ui-icon';
import { notPastDate } from '@shared/validators/saudi.validators';
import { UnitResultCard } from '../../components/unit-result-card/unit-result-card';
import { MarketplaceService } from '../../services/marketplace.service';

/** Which calendar the start-date field is showing (NFR-USB-05). */
type Calendar = 'gregorian' | 'hijri';

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
  protected readonly latest = signal<Unit[]>([]);
  protected readonly calendar = signal<Calendar>('gregorian');

  protected readonly minDate = toIsoDate(new Date());

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

  /**
   * The Hijri equivalent of the chosen date.
   *
   * `<input type="date">` is Gregorian-only in every browser, so the toggle
   * shows the same instant in the Umm al-Qura calendar rather than swapping the
   * control. That satisfies NFR-USB-05's display requirement without a date
   * library, and keeps one unambiguous value going to the API.
   */
  protected readonly hijriDate = computed(() => {
    const value = this.form.controls.startDate.value;
    if (!value) return '';

    try {
      return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(value));
    } catch {
      // A browser without the calendar falls back to no secondary line rather
      // than showing a wrong date.
      return '';
    }
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
    this.marketplace.search({ sortBy: 'newest', limit: 4 }).subscribe({
      next: (page) => this.latest.set(page.items.slice(0, 4)),
      error: () => this.latest.set([]),
    });
  }

  /** The tile icon for a category, falling back to a generic box. */
  protected iconFor(categoryId: string): IconName {
    return CATEGORY_ICONS[categoryId] ?? 'box';
  }

  protected setCalendar(calendar: Calendar): void {
    this.calendar.set(calendar);
  }

  protected stepDays(by: number): void {
    const control = this.form.controls.days;
    const next = Math.min(365, Math.max(1, (control.value ?? 1) + by));
    control.setValue(next);
  }

  /** Everything is optional — an empty search is a valid "show me everything". */
  protected search(): void {
    const { cityId, categoryId, startDate, days } = this.form.getRawValue();

    void this.router.navigate(['/units'], {
      queryParams: {
        cityId: cityId || null,
        categoryId: categoryId || null,
        availableFrom: startDate || null,
        days: days ?? null,
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
