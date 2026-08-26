import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { BookingStatus } from '@core/enums/booking-status.enum';
import { BOOKING_STATUS_DISPLAY, statusText } from '@core/constants/status-display';
import { LanguageService } from '@core/i18n/language.service';
import type { TranslationKey } from '@core/i18n/translations';
import type { RenterBooking } from '@core/models/renter-booking';
import { UiBadge } from '@shared/components/ui-badge/ui-badge';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiMoney } from '@shared/components/ui-money/ui-money';
import { UiThumbnail } from '@shared/components/ui-thumbnail/ui-thumbnail';
import { bookingPrimaryAction, canRaiseComplaint } from '../../services/renter-bookings.service';

/**
 * One booking in "حجوزاتي" (RNT-01).
 *
 * The design shows nine status variants of this card. They are one component
 * driven by `status`, because the only things that actually change are the badge
 * and which secondary action appears — and both of those already have a single
 * definition elsewhere: BOOKING_STATUS_DISPLAY for the label and tone, and
 * bookingPrimaryAction for the action.
 */
@Component({
  selector: 'app-booking-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiBadge, UiButton, UiMoney, UiThumbnail],
  templateUrl: './booking-card.html',
  styleUrl: './booking-card.scss',
})
export class BookingCard {
  protected readonly i18n = inject(LanguageService);

  readonly booking = input.required<RenterBooking>();
  /** The past tab drops the price detail and shows a closing note instead. */
  readonly past = input(false, { transform: booleanAttribute });
  /** Explains how a past booking ended — "أُلغي بطلب المستأجر…". */
  readonly note = input<string>();

  protected readonly status = computed(() =>
    statusText(BOOKING_STATUS_DISPLAY[this.booking().status], this.i18n.language()),
  );

  protected readonly tone = computed(() => BOOKING_STATUS_DISPLAY[this.booking().status].tone);

  protected readonly action = computed(() => bookingPrimaryAction(this.booking()));

  /** FR-ADM-08 — the route out of a problem belongs on every booking, not
   *  only on the one the renter thought to open. */
  protected readonly canComplain = computed(() => canRaiseComplaint(this.booking()));

  /**
   * No countdown on a card.
   *
   * `GET /renter/bookings` does not carry `holdExpiresAt` — only the detail
   * and the payment screen do — and a card that invented one would be showing
   * a deadline it had guessed. The row says the booking is waiting to be paid
   * for and links to the screen that knows how long is left.
   */
  protected readonly awaitingPayment = computed(
    () => this.booking().status === BookingStatus.AwaitingPayment,
  );

  protected readonly actionLabel = computed(
    () => this.action()?.labelKey as TranslationKey | undefined,
  );
}
