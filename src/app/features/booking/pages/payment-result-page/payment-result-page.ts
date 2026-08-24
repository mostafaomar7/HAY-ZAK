import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { APP } from '@core/constants/app.constants';
import { BOOKING_STATUS_DISPLAY } from '@core/constants/status-display';
import { LanguageService } from '@core/i18n/language.service';
import { countdown } from '@core/utils/countdown';
import type { Booking } from '@core/models/booking.model';
import type { AlternativePeriod } from '@core/models/renter.model';
import { UiBadge } from '@shared/components/ui-badge/ui-badge';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiCountdown } from '@shared/components/ui-countdown/ui-countdown';
import { UiMoney } from '@shared/components/ui-money/ui-money';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';
import { BookingService } from '../../services/booking.service';
import { BookingWizardService } from '../../services/booking-wizard.service';

/**
 * The four outcomes of a payment attempt (RNT-06).
 *
 * - `success` — paid, awaiting administration review.
 * - `failed` — the gateway declined; the hold is still running.
 * - `taken` — another renter completed payment for the same window first.
 * - `expired` — the 15-minute hold ran out (FR-BKG-05).
 *
 * Every one of them says explicitly whether money moved. That is the first thing
 * a renter wants to know after a failed payment, and leaving it implicit is how
 * a support queue fills up.
 */
export type PaymentOutcome = 'success' | 'failed' | 'taken' | 'expired';

@Component({
  selector: 'app-payment-result-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiBadge, UiButton, UiCountdown, UiMoney, UiNotice, UiSkeleton],
  templateUrl: './payment-result-page.html',
  styleUrl: './payment-result-page.scss',
})
export class PaymentResultPage {
  private readonly bookings = inject(BookingService);
  private readonly wizard = inject(BookingWizardService);
  private readonly router = inject(Router);

  protected readonly i18n = inject(LanguageService);

  readonly bookingId = input.required<string>();
  readonly status = input<PaymentOutcome>('success');
  /** Passed through by the gateway when it declines. */
  readonly reason = input('');

  protected readonly booking = signal<Booking | null>(null);
  protected readonly alternatives = signal<AlternativePeriod[]>([]);
  protected readonly isLoading = signal(true);

  protected readonly slaHours = APP.approvalSlaHours;
  protected readonly holdUntil = this.wizard.holdExpiresAt;
  protected readonly holdSeconds = countdown(this.holdUntil);

  protected readonly statusDisplay = computed(() => {
    const booking = this.booking();
    return booking ? BOOKING_STATUS_DISPLAY[booking.status] : null;
  });

  protected readonly showHold = computed(
    () => this.status() === 'failed' && (this.holdSeconds() ?? 0) > 0,
  );

  constructor() {
    queueMicrotask(() => this.load());
  }

  protected load(): void {
    this.isLoading.set(true);

    this.bookings.byId(this.bookingId()).subscribe({
      next: (booking) => {
        this.booking.set(booking);
        this.isLoading.set(false);

        // A successful payment ends the wizard; keeping the draft around would
        // let a later visit resume a booking that is already paid for.
        if (this.status() === 'success') this.wizard.clear();
      },
      error: () => this.isLoading.set(false),
    });

    if (this.status() === 'taken') {
      this.bookings.alternativePeriods(this.bookingId()).subscribe({
        next: (periods) => this.alternatives.set(periods),
        error: () => this.alternatives.set([]),
      });
    }
  }

  protected retry(): void {
    void this.router.navigate(['/booking', this.bookingId(), 'pay']);
  }

  protected restart(): void {
    const unitId = this.booking()?.unitId;
    this.wizard.clear();
    if (unitId) void this.router.navigate(['/booking', 'new', unitId]);
  }

  /** Restarts the journey on one of the free windows the server offered. */
  protected choose(period: AlternativePeriod): void {
    const unitId = this.booking()?.unitId;
    if (!unitId) return;

    this.wizard.clear();
    void this.router.navigate(['/booking', 'new', unitId], {
      queryParams: { start: period.startDate, end: period.endDate },
    });
  }

  protected onHoldExpired(): void {
    void this.router.navigate([], {
      queryParams: { status: 'expired' },
      replaceUrl: true,
    });
  }
}
