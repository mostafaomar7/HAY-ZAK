import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import type { ApiError } from '@core/models/api-error.model';
import { isApiError } from '@core/models/api-error.model';
import { applyFieldErrors, clearServerErrors } from '@core/utils/api-form';
import { markFormTouched } from '@core/utils/form.utils';
import { controlChanges } from '@core/utils/form-signals';
import { NotificationService } from '@core/services/notification.service';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiErrorNotice } from '@shared/components/ui-error-notice/ui-error-notice';
import { UiField } from '@shared/components/ui-field/ui-field';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { BookingService } from '../../services/booking.service';
import type { RenterBooking } from '@core/models/renter-booking';
import { RenterBookingsService } from '../../services/renter-bookings.service';

/**
 * "لديّ مشكلة" — the one route out of a problem with a booking.
 *
 * This screen replaced the cancellation screen, and the replacement is the
 * product rule, not a redesign. Nobody cancels a booking on this platform:
 * not the renter, not the lessor. Wanting to cancel, wanting a refund, a space
 * that is not as described — all of it is a complaint against the booking, and
 * an administrator decides what happens, which is the only path to CANCELLED
 * (see `booking-transitions.ts`).
 *
 * So this form does not ask what the renter wants to happen. It asks what is
 * wrong. A form offering "cancel my booking" as an outcome would be promising
 * a decision it cannot make.
 */
@Component({
  selector: 'app-raise-complaint-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [BookingService, RenterBookingsService],
  imports: [ReactiveFormsModule, RouterLink, UiButton, UiErrorNotice, UiField, UiNotice],
  templateUrl: './raise-complaint-page.html',
  styleUrl: './raise-complaint-page.scss',
})
export class RaiseComplaintPage {
  /** Bound from the route. */
  readonly bookingId = input.required<string>();

  private readonly fb = inject(FormBuilder);
  private readonly service = inject(BookingService);
  private readonly renterBookings = inject(RenterBookingsService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly i18n = inject(LanguageService);

  /**
   * Read on its own rather than found in a list: this page is reachable from a
   * notification or a bookmark, where no list has been loaded, and a header
   * that silently shows nothing would leave the writer unsure which booking
   * they are reporting.
   */
  protected readonly booking = signal<RenterBooking | null>(null);

  protected readonly submitting = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly extras = signal<readonly string[]>([]);

  protected readonly form = this.fb.group({
    subject: ['', [Validators.required, Validators.maxLength(120)]],
    body: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(2000)]],
  });

  private readonly changes = controlChanges(this.form);

  protected readonly bodyCount = computed(() => {
    this.changes();
    return `${this.form.controls.body.value?.length ?? 0} / 2000`;
  });

  constructor() {
    // Deferred a tick, like the sibling pages: a required route input has no
    // value while the component is still being constructed.
    queueMicrotask(() => {
      // Silent on failure: the form still works without the header, and a
      // renter who came here to report a problem should not meet another one.
      this.renterBookings.byId(this.bookingId()).subscribe({
        next: ({ booking }) => this.booking.set(booking),
        error: () => undefined,
      });
    });
  }

  protected submit(): void {
    clearServerErrors(this.form);

    if (this.form.invalid) {
      markFormTouched(this.form);
      return;
    }

    this.submitting.set(true);
    this.error.set(null);
    this.extras.set([]);

    const { subject, body } = this.form.getRawValue();

    this.service.raiseComplaint(this.bookingId(), { subject: subject!, body: body! }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.notifications.success(this.i18n.t('complaint.sent'));
        void this.router.navigate(['/my-bookings', this.bookingId()]);
      },
      error: (failure: unknown) => {
        this.submitting.set(false);
        if (!isApiError(failure)) return;

        this.error.set(failure);
        this.extras.set(applyFieldErrors(this.form, failure));
      },
    });
  }
}
