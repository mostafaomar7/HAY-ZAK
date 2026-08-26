import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { COMPLAINT_CATEGORY_DISPLAY, statusText } from '@core/constants/status-display';
import { ComplaintCategory } from '@core/enums/complaint.enum';
import { LanguageService } from '@core/i18n/language.service';
import type { ApiError } from '@core/models/api-error.model';
import { isApiError } from '@core/models/api-error.model';
import type { ComplaintAlreadyOpenMeta } from '@core/models/complaint';
import {
  MAX_COMPLAINT_ATTACHMENTS,
  MIN_COMPLAINT_DESCRIPTION,
  MIN_COMPLAINT_SUBJECT,
} from '@core/models/complaint';
import type { RenterBooking } from '@core/models/renter-booking';
import { ComplaintsService, alreadyOpenComplaint } from '@core/services/complaints.service';
import { NotificationService } from '@core/services/notification.service';
import { applyFieldErrors, clearServerErrors } from '@core/utils/api-form';
import { controlChanges } from '@core/utils/form-signals';
import { markFormTouched } from '@core/utils/form.utils';
import type { ChoiceOption } from '@shared/components/ui-choice-chips/ui-choice-chips';
import { UiChoiceChips } from '@shared/components/ui-choice-chips/ui-choice-chips';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiErrorNotice } from '@shared/components/ui-error-notice/ui-error-notice';
import { UiField } from '@shared/components/ui-field/ui-field';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { RenterBookingsService } from '../../services/renter-bookings.service';

/**
 * "لديّ مشكلة" — the one exception path in the product.
 *
 * This screen replaced the cancellation screen, and the replacement is the
 * product rule rather than a redesign. Nobody cancels a booking here: not the
 * renter, not the lessor. There is no self-service refund and no editing a
 * booking after payment. Wanting to cancel, wanting money back, a space that
 * was locked, a space that was nothing like the listing — all of it arrives on
 * this form, and an administrator decides what follows.
 *
 * So the form asks what is wrong and what kind of problem it is. It does not
 * ask what the writer wants to happen: "طلب إلغاء" is a *category*, not an
 * outcome, and a form offering "cancel my booking" as a result would be
 * promising a decision it cannot make.
 *
 * The description floor is twenty characters and is not arbitrary. A person
 * has to read this and decide something with money attached; "مش عاجبني" is
 * not a case anybody can act on.
 */
@Component({
  selector: 'app-raise-complaint-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [RenterBookingsService],
  imports: [
    ReactiveFormsModule,
    RouterLink,
    UiButton,
    UiChoiceChips,
    UiErrorNotice,
    UiField,
    UiNotice,
  ],
  templateUrl: './raise-complaint-page.html',
  styleUrl: './raise-complaint-page.scss',
})
export class RaiseComplaintPage {
  /** Bound from the route. */
  readonly bookingId = input.required<string>();

  private readonly fb = inject(FormBuilder);
  private readonly complaints = inject(ComplaintsService);
  private readonly renterBookings = inject(RenterBookingsService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly i18n = inject(LanguageService);
  protected readonly maxFiles = MAX_COMPLAINT_ATTACHMENTS;

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
  protected readonly files = signal<readonly File[]>([]);

  /**
   * The complaint that already exists on this booking, when the server says
   * there is one.
   *
   * The 409 carries its id, so the answer is a link to the conversation rather
   * than a message telling somebody to go and find it themselves.
   */
  protected readonly existing = signal<ComplaintAlreadyOpenMeta | null>(null);

  protected readonly form = this.fb.group({
    category: ['' as ComplaintCategory | '', Validators.required],
    subject: [
      '',
      [Validators.required, Validators.minLength(MIN_COMPLAINT_SUBJECT), Validators.maxLength(120)],
    ],
    description: [
      '',
      [
        Validators.required,
        Validators.minLength(MIN_COMPLAINT_DESCRIPTION),
        Validators.maxLength(2000),
      ],
    ],
  });

  private readonly changes = controlChanges(this.form);

  protected readonly categoryOptions = computed<ChoiceOption[]>(() =>
    Object.values(ComplaintCategory).map((category) => ({
      value: category,
      label: statusText(COMPLAINT_CATEGORY_DISPLAY[category], this.i18n.language()),
    })),
  );

  protected readonly categoryError = computed(() => {
    this.changes();
    const control = this.form.controls.category;
    return control.touched && control.invalid ? this.i18n.t('complaint.categoryRequired') : '';
  });

  protected readonly descriptionCount = computed(() => {
    this.changes();
    return `${this.form.controls.description.value?.length ?? 0} / 2000`;
  });

  protected readonly canSubmit = computed(() => {
    this.changes();
    return this.form.valid && !this.submitting();
  });

  constructor() {
    // Deferred a tick, like the sibling pages: a required route input has no
    // value while the component is still being constructed.
    queueMicrotask(() => {
      // Silent on failure: the form still works without the header, and
      // somebody who came here to report a problem should not meet another one.
      this.renterBookings.byId(this.bookingId()).subscribe({
        next: ({ booking }) => this.booking.set(booking),
        error: () => undefined,
      });
    });
  }

  protected pickCategory(value: string): void {
    this.form.controls.category.setValue(value as ComplaintCategory);
    this.form.controls.category.markAsTouched();
  }

  /** Capped at five here as well as on the server, so the count on screen is true. */
  protected onFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.files.set(Array.from(input.files ?? []).slice(0, MAX_COMPLAINT_ATTACHMENTS));
  }

  protected removeFile(index: number): void {
    this.files.update((list) => list.filter((_, i) => i !== index));
  }

  protected openExisting(): void {
    const existing = this.existing();
    if (existing) void this.router.navigate(['/my-complaints', existing.complaintId]);
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
    this.existing.set(null);

    const { category, subject, description } = this.form.getRawValue();

    this.complaints
      .create({
        bookingId: this.bookingId(),
        category: category as ComplaintCategory,
        subject: subject!.trim(),
        description: description!.trim(),
        attachments: this.files(),
      })
      .subscribe({
        next: (complaint) => {
          this.submitting.set(false);
          this.notifications.success(this.i18n.t('complaint.sent'));
          void this.router.navigate(['/my-complaints', complaint.id]);
        },
        error: (failure: unknown) => {
          this.submitting.set(false);
          if (!isApiError(failure)) return;

          // Not an error the writer caused: they already have this conversation
          // open, and the response says exactly which one.
          const existing = alreadyOpenComplaint(failure);
          if (existing) {
            this.existing.set(existing);
            return;
          }

          this.error.set(failure);
          this.extras.set(applyFieldErrors(this.form, failure));
        },
      });
  }
}
