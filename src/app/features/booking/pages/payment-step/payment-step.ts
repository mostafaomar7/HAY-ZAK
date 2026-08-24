import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { APP } from '@core/constants/app.constants';
import { PaymentMethod } from '@core/enums/payment.enum';
import { LanguageService } from '@core/i18n/language.service';
import type { TranslationKey } from '@core/i18n/translations';
import type { Booking } from '@core/models/booking.model';
import { calculatePrice, type PriceBreakdown } from '@core/utils/money.utils';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { UiPriceBreakdown } from '@shared/components/ui-price-breakdown/ui-price-breakdown';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';
import { BookingService } from '../../services/booking.service';
import { BookingWizardService } from '../../services/booking-wizard.service';

interface MethodOption {
  method: PaymentMethod;
  labelKey: TranslationKey;
  hintKey: TranslationKey;
}

/**
 * Step four — price breakdown and payment (RNT-05, FR-BKG-02, FR-PAY-01).
 *
 * The total comes from the server's quote, not from the local helper. The
 * commission rate, who bears it and the VAT base are all administrator settings
 * (FR-ADM-06), so a locally computed figure would silently disagree with the
 * amount actually charged the first time one of them changed. The local figure
 * is used only as an optimistic placeholder while the quote is in flight.
 *
 * No card fields are collected here. FR-PAY-01 puts the card capture inside the
 * gateway's own hosted flow, which is what keeps this application out of PCI
 * scope — pressing confirm creates a payment intent and hands off.
 */
@Component({
  selector: 'app-payment-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiButton, UiNotice, UiPriceBreakdown, UiSkeleton],
  templateUrl: './payment-step.html',
  styleUrl: './payment-step.scss',
})
export class PaymentStep {
  private readonly bookings = inject(BookingService);
  private readonly wizard = inject(BookingWizardService);
  private readonly router = inject(Router);

  protected readonly i18n = inject(LanguageService);

  readonly bookingId = input.required<string>();

  protected readonly booking = signal<Booking | null>(null);
  protected readonly quote = signal<PriceBreakdown | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly paying = signal(false);
  protected readonly method = signal<PaymentMethod>(PaymentMethod.Mada);

  protected readonly draft = this.wizard.draft;
  protected readonly unit = this.wizard.unit;
  protected readonly slaHours = APP.approvalSlaHours;

  protected readonly methods: readonly MethodOption[] = [
    {
      method: PaymentMethod.Mada,
      labelKey: 'booking.methodMada',
      hintKey: 'booking.methodMadaHint',
    },
    {
      method: PaymentMethod.CreditCard,
      labelKey: 'booking.methodCard',
      hintKey: 'booking.methodCardHint',
    },
    {
      method: PaymentMethod.Wallet,
      labelKey: 'booking.methodWallet',
      hintKey: 'booking.methodWalletHint',
    },
  ];

  /** The server's figure once it arrives; the local one until then. */
  protected readonly price = computed(
    () =>
      this.quote() ??
      calculatePrice(this.unit()?.dailyPriceHalalas ?? 0, this.draft()?.daysCount ?? 0),
  );

  constructor() {
    queueMicrotask(() => this.load());
  }

  protected load(): void {
    this.isLoading.set(true);

    this.bookings.byId(this.bookingId()).subscribe({
      next: (booking) => {
        this.booking.set(booking);
        this.wizard.setHold(booking.holdExpiresAt);
        this.isLoading.set(false);

        this.bookings
          .quote(booking.unitId, booking.startDate, booking.daysCount)
          .subscribe({ next: (price) => this.quote.set(price), error: () => undefined });
      },
      error: () => this.isLoading.set(false),
    });
  }

  protected setMethod(method: PaymentMethod): void {
    this.method.set(method);
  }

  /**
   * Hands off to the gateway. A hosted checkout returns a URL to send the
   * browser to; a client-secret integration keeps the renter here and the
   * gateway's own script takes over. Both end at the result screen.
   */
  protected pay(): void {
    if (this.paying()) return;
    this.paying.set(true);

    this.bookings.createPaymentIntent(this.bookingId(), this.method()).subscribe({
      next: (intent) => {
        if (intent.redirectUrl) {
          window.location.assign(intent.redirectUrl);
          return;
        }

        this.paying.set(false);
        void this.router.navigate(['/booking', this.bookingId(), 'result'], {
          queryParams: { status: 'success' },
        });
      },
      error: () => {
        this.paying.set(false);
        void this.router.navigate(['/booking', this.bookingId(), 'result'], {
          queryParams: { status: 'failed' },
        });
      },
    });
  }
}
