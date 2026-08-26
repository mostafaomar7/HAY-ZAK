import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { APP } from '@core/constants/app.constants';
import { LanguageService } from '@core/i18n/language.service';
import type { PublicUnit } from '@core/models/public-unit';
import type { ReferenceItem } from '@core/models/unit.model';
import { AuthService } from '@core/services/auth.service';
import { ReferenceDataService } from '@core/services/reference-data.service';
import { toPlainDate, todayPlain } from '@core/utils/date.utils';
import { calculatePrice } from '@core/utils/money.utils';
import { formatTimeRange } from '@core/utils/schedule.utils';
import { UiBadge } from '@shared/components/ui-badge/ui-badge';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiLocationMap } from '@shared/components/ui-location-map/ui-location-map';
import { UiModal } from '@shared/components/ui-modal/ui-modal';
import { UiPriceBreakdown } from '@shared/components/ui-price-breakdown/ui-price-breakdown';
import { UiProhibitedList } from '@shared/components/ui-prohibited-list/ui-prohibited-list';
import { UiRangeCalendar } from '@shared/components/ui-range-calendar/ui-range-calendar';
import type { DateRange } from '@shared/components/ui-range-calendar/ui-range-calendar';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';
import { UiThumbnail } from '@shared/components/ui-thumbnail/ui-thumbnail';
import { MarketplaceService } from '../../services/marketplace.service';

/**
 * One space in full (PUB-04, FR-MKT-09).
 *
 * Design rule 5 gives this page exactly one primary action — "احجز الآن" — and
 * no way to contact the owner. That is not a layout preference: SRS §5 keeps the
 * two parties' contact details sealed until administration approves a booking,
 * so a message control here would be a hole in that rule. The API holds up its
 * end — `GET /public/units/:id` returns no phone, no email and no owner name,
 * and there is no parameter that would produce them.
 *
 * Design rule 1 means a guest can read all of this. Pressing "احجز الآن" is the
 * first moment an account is needed, and it opens a dialog rather than throwing
 * the visitor at a login screen and losing the dates they picked.
 *
 * Two sections the design has and this page does not: the taken dates greyed
 * out on the calendar, and the "مساحات مشابهة" rail. Both need endpoints the
 * server does not serve yet — see `docs/api/backend-notes.md`. Showing an empty
 * calendar is the safe failure: the booking step re-checks the window and the
 * server is the one that refuses, so the worst case is a date rejected a step
 * later rather than a booking taken over one that exists.
 */
@Component({
  selector: 'app-unit-details-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MarketplaceService],
  imports: [
    RouterLink,
    UiBadge,
    UiButton,
    UiEmptyState,
    UiLocationMap,
    UiModal,
    UiPriceBreakdown,
    UiProhibitedList,
    UiRangeCalendar,
    UiSkeleton,
    UiThumbnail,
  ],
  templateUrl: './unit-details-page.html',
  styleUrl: './unit-details-page.scss',
})
export class UnitDetailsPage {
  private readonly marketplace = inject(MarketplaceService);
  private readonly reference = inject(ReferenceDataService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly i18n = inject(LanguageService);

  /** Bound from the `:id` route parameter. */
  readonly id = input.required<string>();

  protected readonly unit = signal<PublicUnit | null>(null);
  protected readonly prohibited = signal<ReferenceItem[]>([]);

  protected readonly isLoading = signal(true);
  protected readonly failed = signal(false);
  protected readonly activePhoto = signal(0);
  protected readonly joinPromptOpen = signal(false);

  protected readonly today = todayPlain();
  protected readonly holdMinutes = APP.bookingHoldMinutes;
  protected readonly slaHours = APP.approvalSlaHours;

  private readonly range = signal<DateRange | null>(null);

  protected readonly minDays = computed(() => this.unit()?.minDays ?? 1);
  protected readonly maxDays = computed(() => this.unit()?.maxDays ?? 365);

  /** Defaults to the shortest stay the owner allows, so a price is on screen at once. */
  protected readonly defaultRange = computed(() => {
    const start = this.today;
    const end = new Date(start);
    end.setDate(end.getDate() + this.minDays());
    return { start, end: toPlainDate(end) };
  });

  protected readonly days = computed(() => this.range()?.days ?? this.minDays());

  /**
   * Priced locally for immediate feedback as the dates change. The figure that
   * gets charged comes from `BookingService.quote` at the payment step, which is
   * the one the server stands behind.
   */
  protected readonly price = computed(() =>
    calculatePrice(this.unit()?.dailyPriceHalalas ?? 0, this.days()),
  );

  protected readonly isBooked = computed(() => this.unit()?.isFullyBooked === true);

  protected readonly photos = computed(() => this.unit()?.images ?? []);

  /**
   * FR-UNT-06 — one window, the same every day.
   *
   * The API keeps a single opening time per unit rather than a per-day table,
   * so this is a line of text and not a schedule. Stated as "يوميًا" rather
   * than a list of seven days, which would imply the lessor chose them.
   */
  protected readonly visitTime = computed(() => {
    const window = this.unit()?.visitWindow;
    return window ? formatTimeRange(window.from, window.to) : '';
  });

  /** "~١٫٧ كم" — rounded by the server to the nearest 100 m. See the card. */
  protected readonly distance = computed(() => {
    const metres = this.unit()?.distanceMeters ?? null;
    if (metres === null) return null;
    return metres < 1000
      ? { value: String(metres), unit: this.i18n.t('common.metres') }
      : { value: (metres / 1000).toFixed(1), unit: this.i18n.t('results.km') };
  });

  protected readonly prohibitedLabels = computed(() =>
    this.prohibited().map((item) => this.i18n.pick(item)),
  );

  protected readonly place = computed(() => {
    const unit = this.unit();
    if (!unit) return '';
    return [this.i18n.pick(unit.district ?? undefined), this.i18n.pick(unit.city ?? undefined)]
      .filter(Boolean)
      .join('، ');
  });

  constructor() {
    this.reference.prohibitedItems().subscribe({
      next: (items) => this.prohibited.set(items),
      error: () => this.prohibited.set([]),
    });

    // `id` is a required input, so read it once the router has bound it.
    queueMicrotask(() => this.load());
  }

  protected load(): void {
    this.isLoading.set(true);
    this.failed.set(false);

    this.marketplace.byId(this.id()).subscribe({
      next: (unit) => {
        this.unit.set(unit);
        this.isLoading.set(false);
      },
      // Draft, rejected, archived and "never existed" all answer the same 404,
      // deliberately — so this page can only ever say "not found", and must not
      // try to guess which of them it was.
      error: () => {
        this.failed.set(true);
        this.isLoading.set(false);
      },
    });
  }

  protected setRange(range: DateRange): void {
    this.range.set(range);
  }

  protected setPhoto(index: number): void {
    this.activePhoto.set(index);
  }

  /**
   * The single primary action. A guest gets the sign-up dialog; everyone else
   * goes to step one of the wizard with the dates already chosen, so the picker
   * does not have to be filled in twice.
   */
  protected book(): void {
    if (this.isBooked()) return;

    if (!this.auth.isAuthenticated()) {
      this.joinPromptOpen.set(true);
      return;
    }

    void this.router.navigate(['/booking', 'new', this.id()], {
      queryParams: this.range()
        ? { start: this.range()!.start, end: this.range()!.end }
        : { start: this.defaultRange().start, end: this.defaultRange().end },
    });
  }

  protected closeJoinPrompt(): void {
    this.joinPromptOpen.set(false);
  }

  /** Keeps the chosen dates through the sign-up round trip (design rule 1). */
  protected get returnUrl(): string {
    const range = this.range() ?? this.defaultRange();
    return `/booking/new/${this.id()}?start=${range.start}&end=${range.end}`;
  }
}
