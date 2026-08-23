import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import type { TranslationKey } from '@core/i18n/translations';
import type { Booking } from '@core/models/booking.model';
import type {
  CancellationQuote,
  CancellationReasonCode,
  CancellationRuleCode,
} from '@core/models/renter.model';
import { NotificationService } from '@core/services/notification.service';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiModal } from '@shared/components/ui-modal/ui-modal';
import { UiMoney } from '@shared/components/ui-money/ui-money';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';
import { BookingService } from '../../services/booking.service';
import { canCancelBooking } from '../../services/renter-bookings.service';

const REASONS: { code: CancellationReasonCode; labelKey: TranslationKey }[] = [
  { code: 'planChanged', labelKey: 'cancel.reasonPlanChanged' },
  { code: 'foundCloser', labelKey: 'cancel.reasonFoundCloser' },
  { code: 'postponed', labelKey: 'cancel.reasonPostponed' },
  { code: 'other', labelKey: 'cancel.reasonOther' },
];

const APPLIED_LABEL: Record<CancellationRuleCode, TranslationKey> = {
  adminRejection: 'cancel.appliedRejection',
  earlyCancellation: 'cancel.appliedEarly',
  lateCancellation: 'cancel.appliedLate',
  afterStart: 'cancel.appliedAfterStart',
};

/**
 * Cancelling a booking (RNT-08, FR-BKG-08).
 *
 * The refund figure is read from the server and displayed; it is never computed
 * here. The tiers are administrator-configurable (FR-ADM-06) and the number the
 * renter sees before confirming is the number they will expect to receive — a
 * client-side calculation that drifted from the server's would be a refund
 * dispute, not a display bug.
 *
 * The confirmation dialog exists because this is irreversible: it releases the
 * dates to other renters immediately.
 */
@Component({
  selector: 'app-cancel-booking-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiButton, UiEmptyState, UiModal, UiMoney, UiSkeleton],
  templateUrl: './cancel-booking-page.html',
  styleUrl: './cancel-booking-page.scss',
})
export class CancelBookingPage {
  private readonly bookings = inject(BookingService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly i18n = inject(LanguageService);

  readonly bookingId = input.required<string>();

  protected readonly booking = signal<Booking | null>(null);
  protected readonly quote = signal<CancellationQuote | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly failed = signal(false);
  protected readonly submitting = signal(false);
  protected readonly dialogOpen = signal(false);

  protected readonly reasons = REASONS;
  protected readonly reason = signal<CancellationReasonCode | null>(null);
  protected readonly note = signal('');

  protected readonly cancellable = computed(() => {
    const booking = this.booking();
    return !!booking && canCancelBooking(booking);
  });

  protected readonly appliedLabel = computed(() => {
    const quote = this.quote();
    if (!quote) return '';
    return this.i18n.t(APPLIED_LABEL[quote.appliedRule], { days: quote.daysBeforeStart });
  });

  constructor() {
    queueMicrotask(() => this.load());
  }

  protected load(): void {
    this.isLoading.set(true);
    this.failed.set(false);

    this.bookings.byId(this.bookingId()).subscribe({
      next: (booking) => this.booking.set(booking),
      error: () => this.failed.set(true),
    });

    this.bookings.cancellationQuote(this.bookingId()).subscribe({
      next: (quote) => {
        this.quote.set(quote);
        this.isLoading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.isLoading.set(false);
      },
    });
  }

  protected setReason(code: CancellationReasonCode): void {
    this.reason.set(code);
  }

  protected setNote(event: Event): void {
    this.note.set((event.target as HTMLTextAreaElement).value);
  }

  protected openDialog(): void {
    this.dialogOpen.set(true);
  }

  protected closeDialog(): void {
    this.dialogOpen.set(false);
  }

  protected confirm(): void {
    if (this.submitting()) return;
    this.submitting.set(true);

    this.bookings
      .cancel(this.bookingId(), {
        reasonCode: this.reason() ?? undefined,
        note: this.note().trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.dialogOpen.set(false);
          this.notifications.success(this.i18n.t('cancel.done'));
          void this.router.navigate(['/my-bookings', this.bookingId()]);
        },
        error: () => {
          this.submitting.set(false);
          this.dialogOpen.set(false);
        },
      });
  }
}
