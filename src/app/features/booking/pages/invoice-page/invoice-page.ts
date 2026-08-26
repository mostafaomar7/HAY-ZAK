import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import type { TaxInvoice } from '@core/models/tax-invoice';
import { AuthService } from '@core/services/auth.service';
import { formatInstant } from '@core/utils/date.utils';
import type { PriceBreakdown } from '@core/utils/money.utils';
import { UiBadge } from '@shared/components/ui-badge/ui-badge';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiModal } from '@shared/components/ui-modal/ui-modal';
import { UiMoney } from '@shared/components/ui-money/ui-money';
import { UiPriceBreakdown } from '@shared/components/ui-price-breakdown/ui-price-breakdown';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';
import type { RenterBooking } from '@core/models/renter-booking';
import { RenterBookingsService } from '../../services/renter-bookings.service';

/**
 * The ZATCA tax invoice (RNT-07, FR-PAY-09).
 *
 * The page renders the invoice from its own figures. There is no PDF to embed
 * or download — the server answers `Accept: application/pdf` with the same
 * JSON — so "تحميل" is deliberately absent rather than offering a button that
 * saves a JSON file under a `.pdf` name. Printing uses the browser's own dialog
 * on this markup, which reads correctly on a phone, in RTL, and to a screen
 * reader.
 *
 * The money comes from the invoice and not from the booking. They agree today,
 * and on the day they do not, the document is the one that was issued.
 *
 * The owner is never named. SRS §5 keeps the counterparty's identity out of the
 * renter's view; the invoice is between the renter and the platform.
 */
@Component({
  selector: 'app-invoice-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [RenterBookingsService],
  imports: [
    RouterLink,
    UiBadge,
    UiButton,
    UiEmptyState,
    UiModal,
    UiMoney,
    UiPriceBreakdown,
    UiSkeleton,
  ],
  templateUrl: './invoice-page.html',
  styleUrl: './invoice-page.scss',
})
export class InvoicePage {
  private readonly bookings = inject(RenterBookingsService);
  private readonly auth = inject(AuthService);
  private readonly document = inject(DOCUMENT);

  protected readonly i18n = inject(LanguageService);

  readonly bookingId = input.required<string>();

  protected readonly booking = signal<RenterBooking | null>(null);
  protected readonly invoice = signal<TaxInvoice | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly failed = signal(false);
  protected readonly previewOpen = signal(false);

  /**
   * The signed-in visitor — this invoice is addressed to them.
   *
   * Not `booking().contact`: on a renter's booking that is the *counterparty*,
   * so reading it here printed the owner's name in the field labelled
   * "المستأجر" on a document that is not supposed to identify them at all.
   */
  protected readonly renterName = computed(() => this.auth.user()?.fullName ?? '—');

  /** A full instant with milliseconds is not a date anybody reads. */
  protected readonly issuedAt = computed(() => {
    const issued = this.invoice()?.issuedAt;
    return issued ? formatInstant(issued) : '';
  });

  /**
   * What the renter was charged, and nothing else.
   *
   * No commission and no net-to-lessor: the API does not send them on a
   * renter's booking, and the breakdown omits the row rather than printing a
   * zero for a number that was never theirs to see.
   *
   * The daily rate is the one figure the invoice does not carry, so it is read
   * from the booking — and shows as zero if that call failed, which costs a
   * sub-line rather than the document.
   */
  protected readonly price = computed<PriceBreakdown>(() => {
    const invoice = this.invoice();
    return {
      dailyPriceHalalas: this.booking()?.price.dailyPriceHalalas ?? 0,
      days: invoice?.booking.nights ?? 0,
      subtotalHalalas: invoice?.taxableHalalas ?? 0,
      vatHalalas: invoice?.vatHalalas ?? 0,
      totalHalalas: invoice?.totalHalalas ?? 0,
    };
  });

  constructor() {
    queueMicrotask(() => this.load());
  }

  protected load(): void {
    this.isLoading.set(true);
    this.failed.set(false);

    this.bookings.invoice(this.bookingId()).subscribe({
      next: (invoice) => {
        this.invoice.set(invoice);
        this.isLoading.set(false);
      },
      error: () => {
        // Includes the 404 that means "not paid for yet", which is a state of
        // the booking rather than a failure — the template says so.
        this.failed.set(true);
        this.isLoading.set(false);
      },
    });

    // Only for the daily rate. Its failure is not the page's failure.
    this.bookings.byId(this.bookingId()).subscribe({
      next: ({ booking }) => this.booking.set(booking),
      error: () => this.booking.set(null),
    });
  }

  protected openPreview(): void {
    this.previewOpen.set(true);
  }

  protected closePreview(): void {
    this.previewOpen.set(false);
  }

  protected print(): void {
    this.document.defaultView?.print();
  }
}
