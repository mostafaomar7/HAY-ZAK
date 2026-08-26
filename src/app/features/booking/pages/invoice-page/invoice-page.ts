import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import type { Invoice } from '@core/models/payment.model';
import type { PriceBreakdown } from '@core/utils/money.utils';
import { NotificationService } from '@core/services/notification.service';
import { UiBadge } from '@shared/components/ui-badge/ui-badge';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiModal } from '@shared/components/ui-modal/ui-modal';
import { UiMoney } from '@shared/components/ui-money/ui-money';
import { UiPriceBreakdown } from '@shared/components/ui-price-breakdown/ui-price-breakdown';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';
import { BookingService } from '../../services/booking.service';
import type { RenterBooking } from '@core/models/renter-booking';
import { RenterBookingsService } from '../../services/renter-bookings.service';

/**
 * The ZATCA tax invoice (RNT-07, FR-PAY-09).
 *
 * The page renders the invoice from data rather than embedding the server's PDF
 * in a frame: the figures then read correctly on a phone, with the app's own
 * typography and RTL handling, and screen readers get real text. The PDF is
 * still the legal artefact — "تحميل" fetches it, and printing uses the browser's
 * own dialog on this markup.
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
  private readonly bookings = inject(BookingService);
  private readonly renterBookings = inject(RenterBookingsService);
  private readonly notifications = inject(NotificationService);
  private readonly document = inject(DOCUMENT);

  protected readonly i18n = inject(LanguageService);

  readonly bookingId = input.required<string>();

  protected readonly booking = signal<RenterBooking | null>(null);
  protected readonly invoice = signal<Invoice | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly failed = signal(false);
  protected readonly previewOpen = signal(false);

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

  constructor() {
    queueMicrotask(() => this.load());
  }

  protected load(): void {
    this.isLoading.set(true);
    this.failed.set(false);

    this.renterBookings.byId(this.bookingId()).subscribe({
      next: ({ booking }) => this.booking.set(booking),
      error: () => this.failed.set(true),
    });

    this.bookings.invoice(this.bookingId()).subscribe({
      next: (invoice) => {
        this.invoice.set(invoice);
        this.isLoading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.isLoading.set(false);
      },
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

  /**
   * Fetched through the API client rather than linked directly, so the request
   * carries the Authorization header — a bare `<a href>` to a protected PDF
   * would come back as a 401 rendered as a broken download.
   */
  protected download(): void {
    this.bookings.downloadInvoice(this.bookingId()).subscribe({
      next: (blob) => this.saveBlob(blob),
      error: () => this.notifications.error(this.i18n.t('results.errorHint')),
    });
  }

  private saveBlob(blob: Blob): void {
    const url = URL.createObjectURL(blob);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = `${this.invoice()?.invoiceNo ?? this.bookingId()}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
