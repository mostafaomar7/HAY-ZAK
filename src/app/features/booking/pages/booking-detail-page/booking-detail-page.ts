import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { APP } from '@core/constants/app.constants';
import { BOOKING_STATUS_DISPLAY, statusText } from '@core/constants/status-display';
import { BookingStatus } from '@core/enums/booking-status.enum';
import { LanguageService } from '@core/i18n/language.service';
import type { Booking, BookingStatusHistoryEntry } from '@core/models/booking.model';
import { calculatePrice } from '@core/utils/money.utils';
import { summariseSchedule } from '@core/utils/schedule.utils';
import { UiBadge } from '@shared/components/ui-badge/ui-badge';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiLocationMap } from '@shared/components/ui-location-map/ui-location-map';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { UiPriceBreakdown } from '@shared/components/ui-price-breakdown/ui-price-breakdown';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';
import type { StepperStep } from '@shared/components/ui-stepper/ui-stepper';
import { UiStepper } from '@shared/components/ui-stepper/ui-stepper';
import { BookingService } from '../../services/booking.service';
import { canCancelBooking, isAddressReleased } from '../../services/renter-bookings.service';

/** The six milestones the design draws, in order. */
const STAGES: { key: string; reached: BookingStatus[] }[] = [
  { key: 'bookingDetail.stageCreated', reached: [BookingStatus.Draft] },
  { key: 'bookingDetail.stagePaid', reached: [BookingStatus.PaidPendingApproval] },
  { key: 'bookingDetail.stageReview', reached: [BookingStatus.PaidPendingApproval] },
  { key: 'bookingDetail.stageApproved', reached: [BookingStatus.Approved] },
  { key: 'bookingDetail.stageStart', reached: [BookingStatus.Active] },
  { key: 'bookingDetail.stageEnd', reached: [BookingStatus.Completed] },
];

/**
 * One booking in full (RNT-02).
 *
 * The address section is the load-bearing part. FR-UNT-11 releases the exact
 * location only once administration approves, so the decision is taken from the
 * booking's status through `isAddressReleased` and handed to UiLocationMap as a
 * flag — the template never reads coordinates and decides for itself.
 */
@Component({
  selector: 'app-booking-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    UiBadge,
    UiButton,
    UiEmptyState,
    UiLocationMap,
    UiNotice,
    UiPriceBreakdown,
    UiSkeleton,
    UiStepper,
  ],
  templateUrl: './booking-detail-page.html',
  styleUrl: './booking-detail-page.scss',
})
export class BookingDetailPage {
  private readonly bookings = inject(BookingService);

  protected readonly i18n = inject(LanguageService);

  readonly bookingId = input.required<string>();

  protected readonly booking = signal<Booking | null>(null);
  protected readonly history = signal<BookingStatusHistoryEntry[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly failed = signal(false);

  protected readonly radiusMetres = APP.approximateLocationRadiusMetres;

  protected readonly status = computed(() => {
    const booking = this.booking();
    return booking ? statusText(BOOKING_STATUS_DISPLAY[booking.status], this.i18n.language()) : '';
  });

  protected readonly tone = computed(() => {
    const booking = this.booking();
    return booking ? BOOKING_STATUS_DISPLAY[booking.status].tone : 'neutral';
  });

  /** The unit's visiting hours, shown alongside the released address. */
  protected readonly visitSummary = computed(() => {
    const windows = this.booking()?.unit?.visitSchedule ?? [];
    return summariseSchedule(windows, this.i18n.language() === 'en' ? 'en-GB' : 'ar-SA');
  });

  protected readonly addressReleased = computed(() => {
    const booking = this.booking();
    return !!booking && isAddressReleased(booking);
  });

  protected readonly canCancel = computed(() => {
    const booking = this.booking();
    return !!booking && canCancelBooking(booking);
  });

  protected readonly hasInvoice = computed(() => {
    const booking = this.booking();
    if (!booking) return false;
    return (
      booking.status !== BookingStatus.Draft && booking.status !== BookingStatus.AwaitingPayment
    );
  });

  protected readonly price = computed(() => {
    const booking = this.booking();
    if (!booking) return calculatePrice(0, 0);
    return {
      dailyPriceHalalas: booking.dailyPriceSnapshotHalalas,
      days: booking.daysCount,
      subtotalHalalas: booking.subtotalHalalas,
      commissionHalalas: booking.commissionHalalas,
      vatHalalas: booking.vatHalalas,
      totalHalalas: booking.totalHalalas,
      netToLessorHalalas: booking.netToLessorHalalas ?? 0,
    };
  });

  /**
   * The milestone trail. Positions are derived from the status rather than from
   * the history entries, so a booking whose history the API has not filled in
   * still renders a correct trail — with timestamps added where they exist.
   */
  protected readonly stages = computed<StepperStep[]>(() => {
    const booking = this.booking();
    if (!booking) return [];

    const order = [
      BookingStatus.Draft,
      BookingStatus.PaidPendingApproval,
      BookingStatus.PaidPendingApproval,
      BookingStatus.Approved,
      BookingStatus.Active,
      BookingStatus.Completed,
    ];
    const currentIndex = order.lastIndexOf(booking.status);

    return STAGES.map((stage, index) => {
      const entry = this.history().find((item) => item.toStatus === stage.reached[0]);
      const state =
        currentIndex === -1
          ? 'upcoming'
          : index < currentIndex
            ? 'done'
            : index === currentIndex
              ? 'current'
              : 'upcoming';

      return {
        label: this.i18n.t(stage.key as never),
        meta: entry?.changedAt ?? undefined,
        state,
      } satisfies StepperStep;
    });
  });

  constructor() {
    queueMicrotask(() => this.load());
  }

  protected load(): void {
    this.isLoading.set(true);
    this.failed.set(false);

    this.bookings.byId(this.bookingId()).subscribe({
      next: (booking) => {
        this.booking.set(booking);
        this.isLoading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.isLoading.set(false);
      },
    });

    this.bookings.history(this.bookingId()).subscribe({
      next: (entries) => this.history.set(entries),
      error: () => this.history.set([]),
    });
  }
}
