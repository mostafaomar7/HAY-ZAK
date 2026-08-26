import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BOOKING_STATUS_DISPLAY } from '@core/constants/status-display';
import { BookingStatus } from '@core/enums/booking-status.enum';
import type { RenterBooking } from '@core/models/renter-booking';
import { renterContactVisible } from '../../services/lessor-requests.service';
import { UiBadge } from '@shared/components/ui-badge/ui-badge';
import { UiMoney } from '@shared/components/ui-money/ui-money';
import { UiThumbnail } from '@shared/components/ui-thumbnail/ui-thumbnail';

/**
 * One card in "الطلبات الواردة" (LSR-05).
 *
 * Read-only: no approve or reject control exists here, because FR-LSR-06 gives
 * the lessor no such authority and SRS §2.5 forbids implying otherwise. The
 * whole card is a link to the detail view, which is also read-only.
 *
 * The renter's name is gated behind `renterContactVisible` — pre-approval the
 * card shows a placeholder rather than leaking identity (FR-LSR-09).
 */
@Component({
  selector: 'app-request-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, RouterLink, UiBadge, UiMoney, UiThumbnail],
  templateUrl: './request-card.html',
  styleUrl: './request-card.scss',
})
export class RequestCard {
  readonly booking = input.required<RenterBooking>();

  protected readonly status = computed(() => BOOKING_STATUS_DISPLAY[this.booking().status]);

  protected readonly isDraft = computed(() => this.booking().status === BookingStatus.Draft);

  protected readonly renterName = computed(() =>
    renterContactVisible(this.booking()) ? (this.booking().contact?.fullName ?? null) : null,
  );

  /** A booking carries no image; the card shows a placeholder. */
  protected readonly coverImage = computed(() => undefined);

  /** "12 أغسطس – 11 سبتمبر · 30 ليلة" as one isolated numeric run. */
  protected readonly period = computed(() => {
    const b = this.booking();
    const fmt = new Intl.DateTimeFormat('ar-SA', { day: 'numeric', month: 'long' });
    const from = fmt.format(new Date(b.startDate));
    const to = fmt.format(new Date(b.endDate));
    // Nights: the two dates are right there, and "30 يوم" between them is a
    // disagreement anybody can see.
    return `${from} – ${to} · ${b.nights} ليلة`;
  });
}
