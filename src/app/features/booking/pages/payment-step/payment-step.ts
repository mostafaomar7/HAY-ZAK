import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BookingStatus } from '@core/enums/booking-status.enum';
import { LanguageService } from '@core/i18n/language.service';
import { ApiError } from '@core/models/api-error.model';
import type { RenterBooking } from '@core/models/renter-booking';
import { countdown } from '@core/utils/countdown';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiCountdown } from '@shared/components/ui-countdown/ui-countdown';
import { UiMoney } from '@shared/components/ui-money/ui-money';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';
import { RenterBookingsService } from '../../services/renter-bookings.service';
import { BookingWizardService } from '../../services/booking-wizard.service';

/**
 * The last step — hand the browser to the gateway (FR-PAY).
 *
 * There is no payment-method picker here any more. The API answers with one
 * `redirectUrl` and the gateway's own hosted page is where the card, the
 * wallet and mada are chosen; a picker on this screen would be asking a
 * question whose answer went nowhere.
 *
 * **The whole browser goes.** Not an iframe and not a fetch: 3-D Secure will
 * not run inside a frame, and a challenge cannot be carried by XHR. The
 * `returnUrl` is built from this application's own origin — the API refuses
 * anything else, because an open return parameter is a phishing tool.
 *
 * The countdown is the server's `holdExpiresAt`, re-read on every load. A
 * fifteen-minute timer started in the browser outlives the hold on a slow
 * connection, and somebody then pays for dates that are no longer theirs.
 */
@Component({
  selector: 'app-payment-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiButton, UiCountdown, UiMoney, UiNotice, UiSkeleton],
  templateUrl: './payment-step.html',
  styleUrl: './payment-step.scss',
})
export class PaymentStep {
  private readonly bookings = inject(RenterBookingsService);
  private readonly wizard = inject(BookingWizardService);
  private readonly router = inject(Router);

  protected readonly i18n = inject(LanguageService);

  readonly bookingId = input.required<string>();

  protected readonly booking = signal<RenterBooking | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly failed = signal(false);
  protected readonly paying = signal(false);
  protected readonly errorText = signal('');

  protected readonly holdUntil = signal<string | null>(null);
  protected readonly holdSeconds = countdown(this.holdUntil);
  protected readonly holdLapsed = computed(() => !!this.holdUntil() && this.holdSeconds() <= 0);

  /**
   * Already settled — usually because the visitor came back to this URL after
   * paying. Offering "ادفع" again would be offering a 409.
   */
  protected readonly alreadyPaid = computed(
    () =>
      this.booking()?.status !== undefined &&
      this.booking()?.status !== BookingStatus.AwaitingPayment,
  );

  protected readonly canPay = computed(
    () => !!this.booking() && !this.alreadyPaid() && !this.holdLapsed() && !this.paying(),
  );

  constructor() {
    queueMicrotask(() => this.load());
  }

  protected load(): void {
    this.isLoading.set(true);
    this.failed.set(false);

    this.bookings.byId(this.bookingId()).subscribe({
      next: ({ booking, holdExpiresAt }) => {
        this.booking.set(booking);
        // The server's deadline, not a local one. Null once nothing is held.
        this.holdUntil.set(holdExpiresAt);
        this.wizard.setHold(holdExpiresAt ?? undefined);
        this.isLoading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Starts the payment and leaves.
   *
   * Safe to press twice — the API answers with the same charge rather than a
   * second one — which is what makes "try another card" on the return screen a
   * retry rather than a second attempt to pay for the same nights.
   */
  protected pay(): void {
    if (!this.canPay()) return;

    this.paying.set(true);
    this.errorText.set('');

    this.bookings.pay(this.bookingId()).subscribe({
      next: (redirectUrl) => {
        // Deliberately a full navigation. Leaves this application entirely.
        window.location.assign(redirectUrl);
      },
      error: (error: unknown) => {
        this.paying.set(false);

        if (error instanceof ApiError && error.code === 'BOOKING_HOLD_EXPIRED') {
          this.holdUntil.set(null);
          this.load();
          return;
        }

        this.errorText.set(
          error instanceof ApiError
            ? error.details?.[0]?.message || error.message
            : this.i18n.t('pay.startFailed'),
        );
      },
    });
  }

  /** The hold lapsed on screen — the dates are back on the market. */
  protected startOver(): void {
    const unitId = this.wizard.draft()?.unitId;
    this.wizard.clear();
    void this.router.navigate(unitId ? ['/units', unitId] : ['/units']);
  }
}
