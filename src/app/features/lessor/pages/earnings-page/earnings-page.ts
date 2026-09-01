import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { APP } from '@core/constants/app.constants';
import {
  BOOKING_STATUS_DISPLAY,
  RELEASE_RULE_TEXT,
  statusText,
} from '@core/constants/status-display';
import { BookingStatus } from '@core/enums/booking-status.enum';
import { LanguageService } from '@core/i18n/language.service';
import type { RenterBooking } from '@core/models/renter-booking';
import type { LessorEarnings } from '@core/models/payment.model';
import { UiBadge } from '@shared/components/ui-badge/ui-badge';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiMoney } from '@shared/components/ui-money/ui-money';
import { UiPager } from '@shared/components/ui-pager/ui-pager';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';
import { UiStatTile } from '@shared/components/ui-stat-tile/ui-stat-tile';
import { LessorAccountService } from '../../services/lessor-account.service';
import { LessorRequestsService } from '../../services/lessor-requests.service';

/**
 * LSR-07 — "المستحقات".
 *
 * **The table read `/lessor/earnings/rows`, which has never existed**, so the
 * screen showed the three buckets above a red "تعذّر تحميل المستحقات" — the
 * money was on screen and none of the bookings behind it were.
 *
 * It reads `/lessor/bookings` now, which is shipped and carries the commission
 * and the net on every row. Same figures, from the endpoint that answers.
 *
 * Three controls went with the change, all for the same reason: the endpoint
 * takes `status`, `page` and `pageSize` and nothing else.
 *
 * The **period** and **unit** filters were narrowing the rows already loaded.
 * Over a paged list of two hundred that filters a page and looks like it
 * filtered the set — an answer that is wrong and confident. Status is a real
 * server filter and stays.
 *
 * **"تصدير كشف الحساب"** had no endpoint behind it. A statement of account is
 * a document somebody sends to an accountant; one generated from the page in
 * hand would carry whatever happened to be on screen.
 *
 * Two columns went too. The bank reference and the transfer date belong to a
 * payout run, which covers several bookings and does not exist until an
 * operator approves one — so no booking row carries them, and the buckets
 * above already say what has been transferred.
 *
 * The table is a CSS grid rather than a `<table>` element so the same markup
 * can reflow into stacked cards on a phone, which a real table cannot do. It
 * keeps table semantics via explicit ARIA roles.
 */
@Component({
  selector: 'app-earnings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [LessorRequestsService],
  imports: [
    DatePipe,
    RouterLink,
    UiBadge,
    UiButton,
    UiEmptyState,
    UiMoney,
    UiPager,
    UiSkeleton,
    UiStatTile,
  ],
  templateUrl: './earnings-page.html',
  styleUrl: './earnings-page.scss',
})
export class EarningsPage {
  private readonly account = inject(LessorAccountService);
  private readonly bookings = inject(LessorRequestsService);

  protected readonly i18n = inject(LanguageService);

  protected readonly rows = signal<readonly RenterBooking[]>([]);

  /**
   * The three buckets, from the endpoint that actually ships.
   *
   * Loaded beside the table rather than derived from it: the table is a page of
   * bookings, and the buckets are the account's position now. Adding up the
   * rows on screen would answer a question nobody asked.
   */
  protected readonly buckets = signal<LessorEarnings | null>(null);

  /**
   * Why money is in the pending bucket, in a sentence.
   *
   * The backend asked for this on the screen and was right to: "why is my
   * money still pending" is the question that becomes a support ticket when
   * the page does not answer it. A rule this build has not heard of renders
   * nothing — a wrong explanation is worse than none.
   */
  protected readonly releaseRule = computed(() => {
    const rule = this.buckets()?.releaseRule;
    const text = rule ? RELEASE_RULE_TEXT[rule] : undefined;
    return text ? statusText(text, this.i18n.language()) : '';
  });

  protected readonly isLoading = signal(true);
  protected readonly failed = signal(false);
  protected readonly page = signal(1);
  protected readonly total = signal(0);

  /** The one filter the endpoint actually takes. */
  protected readonly status = signal<BookingStatus | ''>('');

  protected readonly dateFormat = APP.dateDisplayFormat;
  protected readonly pageSize = APP.pageSize;
  protected readonly statuses = Object.values(BookingStatus);

  constructor() {
    this.fetch();
  }

  protected statusTone(booking: RenterBooking) {
    return BOOKING_STATUS_DISPLAY[booking.status].tone;
  }

  protected statusLabel(status: BookingStatus): string {
    return statusText(BOOKING_STATUS_DISPLAY[status], this.i18n.language());
  }

  /**
   * The lessor's half of the money.
   *
   * `commission` is present only on the lessor's own view of a booking, which
   * this endpoint is — but it is optional on the model because the renter's
   * response has none, so it is read through here rather than in the template.
   */
  protected commissionOf(booking: RenterBooking): number {
    return booking.commission?.commissionHalalas ?? 0;
  }

  protected netOf(booking: RenterBooking): number {
    return booking.commission?.netToLessorHalalas ?? 0;
  }

  protected onStatus(value: string): void {
    this.status.set((value as BookingStatus) || '');
    this.page.set(1);
    this.fetch();
  }

  protected onPage(page: number): void {
    this.page.set(page);
    this.fetch();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected fetch(): void {
    this.failed.set(false);
    this.isLoading.set(true);

    // The buckets are the account's position and do not depend on the page, so
    // their failure must not blank the table: the two answer different
    // questions and fail independently.
    this.account.earnings().subscribe({
      next: (earnings) => this.buckets.set(earnings),
      error: () => this.buckets.set(null),
    });

    this.bookings.load(this.status() || undefined, this.page()).subscribe({
      next: (response) => {
        this.rows.set(response.items);
        this.total.set(response.pagination.total);
        this.isLoading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.isLoading.set(false);
      },
    });
  }
}
