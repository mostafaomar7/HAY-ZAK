import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import type { ReferenceItem } from '@core/models/unit.model';
import { ReferenceDataService } from '@core/services/reference-data.service';
import { toIsoDate } from '@core/utils/date.utils';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiField } from '@shared/components/ui-field/ui-field';
import { notPastDate } from '@shared/validators/saudi.validators';

/** Which calendar the start-date field is showing (NFR-USB-05). */
type Calendar = 'gregorian' | 'hijri';

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
  imports: [ReactiveFormsModule, RouterLink, UiButton, UiField],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage {
  private readonly fb = inject(FormBuilder);
  private readonly reference = inject(ReferenceDataService);
  private readonly router = inject(Router);

  protected readonly i18n = inject(LanguageService);

  protected readonly cities = signal<ReferenceItem[]>([]);
  protected readonly categories = signal<ReferenceItem[]>([]);
  protected readonly calendar = signal<Calendar>('gregorian');

  protected readonly minDate = toIsoDate(new Date());

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
  }

  protected setCalendar(calendar: Calendar): void {
    this.calendar.set(calendar);
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

  protected searchByCategory(categoryId: string): void {
    void this.router.navigate(['/units'], { queryParams: { categoryId } });
  }
}
