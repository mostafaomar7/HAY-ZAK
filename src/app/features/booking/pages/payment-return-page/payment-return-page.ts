import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BookingStatus } from '@core/enums/booking-status.enum';
import { LanguageService } from '@core/i18n/language.service';
import type { RenterBooking } from '@core/models/renter-booking';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiMoney } from '@shared/components/ui-money/ui-money';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';
import { RenterBookingsService } from '../../services/renter-bookings.service';
import { BookingWizardService } from '../../services/booking-wizard.service';

/** What this page decided, after asking the server. */
type Outcome = 'settling' | 'confirmed' | 'unpaid' | 'gone' | 'error';

/** How long to keep asking before offering the reload instead. */
const MAX_POLLS = 6;
const POLL_MS = 1500;

/**
 * Where the payment gateway sends the browser back to (FR-PAY).
 *
 * **The query string is a hint, not a fact.** The gateway appends
 * `?status=paid` or `?status=failed`, and the webhook that actually settles the
 * payment races the browser — it lands before the redirect as often as after.
 * A page that believed `status=paid` would tell somebody their booking was
 * confirmed while the server still had it awaiting payment; a page that
 * believed `status=failed` would send somebody to pay again for a booking they
 * had already paid for.
 *
 * So the id is taken from the query string and nothing else is. The page reads
 * the booking, and re-reads it a few times while the status is still
 * `AWAITING_PAYMENT`, because "not settled yet" and "declined" look identical
 * for the second or two the webhook is in flight.
 *
 * A declined card is not a lost booking: the hold survives, so the way out of
 * this page is "try another card" on the same booking rather than a trip back
 * to the calendar to choose the same dates again.
 */
@Component({
  selector: 'app-payment-return-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Both, because this page sits *outside* the wizard shell — it is where the
  // gateway drops the browser, not a step — so it inherits nothing from it.
  // Injecting one it does not provide is a NullInjectorError at construction,
  // which the router renders as an empty page after the money has moved.
  providers: [RenterBookingsService, BookingWizardService],
  imports: [RouterLink, UiButton, UiEmptyState, UiMoney, UiNotice, UiSkeleton],
  templateUrl: './payment-return-page.html',
  styleUrl: './payment-return-page.scss',
})
export class PaymentReturnPage {
  private readonly bookings = inject(RenterBookingsService);
  private readonly wizard = inject(BookingWizardService);

  protected readonly i18n = inject(LanguageService);

  /**
   * From the query string, bound by the router.
   *
   * `bookingId` is ours — we put it in `returnUrl`. `status` is the gateway's
   * and is read only to decide how loudly to wait: it never decides the
   * outcome. It is deliberately not used anywhere else in this component.
   */
  readonly bookingId = input('');
  readonly status = input('');

  protected readonly booking = signal<RenterBooking | null>(null);
  protected readonly outcome = signal<Outcome>('settling');
  protected readonly polls = signal(0);

  protected readonly isSettling = computed(() => this.outcome() === 'settling');
  protected readonly gaveUpWaiting = computed(
    () => this.outcome() === 'unpaid' && this.polls() >= MAX_POLLS,
  );

  constructor() {
    queueMicrotask(() => this.check());
  }

  protected check(): void {
    const id = this.bookingId();
    if (!id) {
      this.outcome.set('error');
      return;
    }

    this.outcome.set('settling');
    this.polls.set(0);
    this.read(id);
  }

  private read(id: string): void {
    this.bookings.byId(id).subscribe({
      next: ({ booking }) => {
        this.booking.set(booking);

        if (booking.status === BookingStatus.Confirmed) {
          this.outcome.set('confirmed');
          // The journey is over. Leaving the draft behind would let a later
          // visit resume a booking that is already paid for.
          this.wizard.clear();
          return;
        }

        // The hold lapsed while the card was being entered. There is nothing
        // to retry — the dates are back on the market.
        if (booking.status === BookingStatus.Expired) {
          this.outcome.set('gone');
          this.wizard.clear();
          return;
        }

        if (booking.status === BookingStatus.AwaitingPayment) {
          // Still unsettled, or genuinely declined — indistinguishable for the
          // moment the webhook is in flight, so ask again rather than guess.
          const next = this.polls() + 1;
          this.polls.set(next);
          this.outcome.set(next >= MAX_POLLS ? 'unpaid' : 'settling');
          if (next < MAX_POLLS) setTimeout(() => this.read(id), POLL_MS);
          return;
        }

        // ACTIVE, COMPLETED, CANCELLED — all settled, none of them a failure
        // of this payment.
        this.outcome.set('confirmed');
        this.wizard.clear();
      },
      error: () => this.outcome.set('error'),
    });
  }
}
