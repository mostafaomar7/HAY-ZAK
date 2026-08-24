import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { APP } from '@core/constants/app.constants';
import { LanguageService } from '@core/i18n/language.service';
import type { Unit } from '@core/models/unit.model';
import { ApiService } from '@core/services/api.service';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { NotificationService } from '@core/services/notification.service';
import { todayPlain } from '@core/utils/date.utils';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiLocationMap } from '@shared/components/ui-location-map/ui-location-map';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import {
  UiRangeCalendar,
  expandBlockedDates,
} from '@shared/components/ui-range-calendar/ui-range-calendar';
import type { DateRange } from '@shared/components/ui-range-calendar/ui-range-calendar';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';
import { BookingSummary } from '../../components/booking-summary/booking-summary';
import { BookingService } from '../../services/booking.service';
import { BookingWizardService } from '../../services/booking-wizard.service';

/**
 * Step one — dates and duration (RNT-03, FR-BKG-01).
 *
 * Nothing is held here. The design states it plainly on screen, and the reason
 * matters: a hold taken at the calendar would let one browser tab quietly lock a
 * popular space for fifteen minutes at a time. The hold starts at the identity
 * step, immediately before payment.
 */
@Component({
  selector: 'app-dates-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    BookingSummary,
    UiButton,
    UiEmptyState,
    UiLocationMap,
    UiNotice,
    UiRangeCalendar,
    UiSkeleton,
  ],
  templateUrl: './dates-step.html',
  styleUrl: './dates-step.scss',
})
export class DatesStep {
  private readonly api = inject(ApiService);
  private readonly bookings = inject(BookingService);
  private readonly wizard = inject(BookingWizardService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly i18n = inject(LanguageService);

  /** Route parameter and the dates carried over from the details page. */
  readonly unitId = input.required<string>();
  readonly start = input('');
  readonly end = input('');

  protected readonly unit = signal<Unit | null>(null);
  protected readonly blockedDates = signal<string[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly failed = signal(false);
  protected readonly submitting = signal(false);

  protected readonly today = todayPlain();
  protected readonly holdMinutes = APP.bookingHoldMinutes;

  protected readonly draft = this.wizard.draft;

  private readonly range = signal<DateRange | null>(null);

  protected readonly minDays = computed(() => this.unit()?.minDays ?? 1);
  protected readonly maxDays = computed(() => this.unit()?.maxDays ?? 365);

  protected readonly initialStart = computed(
    () => this.start() || this.draft()?.startDate || this.today,
  );
  protected readonly initialEnd = computed(() => this.end() || this.draft()?.endDate || '');

  protected readonly canContinue = computed(() => !!this.range() || this.wizard.hasDates());

  constructor() {
    queueMicrotask(() => this.load());
  }

  protected load(): void {
    this.isLoading.set(true);
    this.failed.set(false);

    this.api.get<Unit>(API_ENDPOINTS.marketplace.unitById(this.unitId())).subscribe({
      next: (unit) => {
        this.unit.set(unit);
        this.wizard.setUnit(unit);
        this.isLoading.set(false);

        // Seed the draft so the summary card has something to show before the
        // renter touches the calendar.
        if (this.initialEnd()) {
          this.wizard.setDates(unit.id, this.initialStart(), this.initialEnd());
        }
      },
      error: () => {
        this.failed.set(true);
        this.isLoading.set(false);
      },
    });

    this.api
      .get<{ startDate: string; endDate: string }[]>(
        API_ENDPOINTS.marketplace.unitAvailability(this.unitId()),
      )
      .subscribe({
        next: (blocks) => this.blockedDates.set(expandBlockedDates(blocks)),
        error: () => this.blockedDates.set([]),
      });
  }

  protected onRange(range: DateRange): void {
    this.range.set(range);
    this.wizard.setDates(this.unitId(), range.start, range.end);
  }

  /**
   * Creates the Draft booking server-side and moves on. The draft is created
   * here rather than at the end so an interrupted journey leaves something the
   * renter can resume from "حجوزاتي" (SRS §2.2).
   */
  protected goNext(): void {
    const draft = this.draft();
    if (!draft || !this.wizard.hasDates() || this.submitting()) return;

    this.submitting.set(true);

    this.bookings
      .createDraft({
        unitId: draft.unitId,
        startDate: draft.startDate,
        daysCount: draft.daysCount,
      })
      .subscribe({
        next: (booking) => {
          this.wizard.setBookingId(booking.id);
          this.submitting.set(false);
          void this.router.navigate(['/booking', booking.id, 'goods']);
        },
        error: () => this.submitting.set(false),
      });
  }

  protected notifyMissing(): void {
    this.notifications.error(this.i18n.t('calendar.chooseEnd'));
  }
}
