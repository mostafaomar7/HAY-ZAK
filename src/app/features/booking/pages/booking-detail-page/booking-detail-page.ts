import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { APP } from '@core/constants/app.constants';
import { BOOKING_STATUS_DISPLAY, statusText } from '@core/constants/status-display';
import { BookingStatus } from '@core/enums/booking-status.enum';
import { LanguageService } from '@core/i18n/language.service';
import type { BookingStatusHistoryEntry } from '@core/models/booking.model';
import type { PriceBreakdown } from '@core/utils/money.utils';
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
import type { RenterBooking } from '@core/models/renter-booking';
import { RenterBookingsService } from '../../services/renter-bookings.service';
import { canRaiseComplaint, isAddressReleased } from '../../services/renter-bookings.service';

/**
 * The milestones, in order.
 *
 * Four, not six. The design drew a review stage between payment and approval,
 * from a lifecycle where the platform took the money and then decided whether
 * to honour the booking. Payment confirms it — see `booking-status.enum.ts` —
 * so drawing "قيد المراجعة" would be showing a wait that does not exist.
 */
const STAGES: { key: string; reached: BookingStatus }[] = [
  { key: 'bookingDetail.stageCreated', reached: BookingStatus.Draft },
  { key: 'bookingDetail.stagePaid', reached: BookingStatus.AwaitingPayment },
  { key: 'bookingDetail.stageConfirmed', reached: BookingStatus.Confirmed },
  { key: 'bookingDetail.stageStart', reached: BookingStatus.Active },
  { key: 'bookingDetail.stageEnd', reached: BookingStatus.Completed },
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
  providers: [RenterBookingsService],
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
  private readonly renterBookings = inject(RenterBookingsService);

  protected readonly i18n = inject(LanguageService);

  readonly bookingId = input.required<string>();

  protected readonly booking = signal<RenterBooking | null>(null);
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

  /**
   * No visiting hours here.
   *
   * A booking's `unit` carries an id, a title, the city and — once confirmed —
   * the address. It does not carry the opening times, and this screen will not
   * fetch the public listing to fill the gap: the lessor may have changed them
   * since, and a confirmed booking showing today's hours as if they were the
   * agreed ones is worse than showing none. The details page has them.
   */

  protected readonly addressReleased = computed(() => {
    const booking = this.booking();
    return !!booking && isAddressReleased(booking);
  });

  /** FR-ADM-08 — the one route out of a problem, on every booking. */
  protected readonly canComplain = computed(() => {
    const booking = this.booking();
    return !!booking && canRaiseComplaint(booking);
  });

  protected readonly hasInvoice = computed(() => {
    const booking = this.booking();
    if (!booking) return false;
    return (
      booking.status !== BookingStatus.Draft && booking.status !== BookingStatus.AwaitingPayment
    );
  });

  /**
   * What the renter was charged, and nothing else.
   *
   * No commission and no net-to-lessor: the API does not send them on a
   * renter's booking, and the breakdown omits the row rather than printing a
   * zero for a number that was never theirs to see.
   */
  protected readonly price = computed<PriceBreakdown>(() => {
    const booking = this.booking();
    return {
      dailyPriceHalalas: booking?.price.dailyPriceHalalas ?? 0,
      days: booking?.nights ?? 0,
      subtotalHalalas: booking?.price.subtotalHalalas ?? 0,
      vatHalalas: booking?.price.vatHalalas ?? 0,
      totalHalalas: booking?.price.totalHalalas ?? 0,
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

    const currentIndex = STAGES.findIndex((stage) => stage.reached === booking.status);

    return STAGES.map((stage, index) => {
      const entry = this.history().find((item) => item.toStatus === stage.reached);
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

    this.renterBookings.byId(this.bookingId()).subscribe({
      next: ({ booking }) => {
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
