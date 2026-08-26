import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import type { ReferenceItem } from '@core/models/unit.model';
import { ReferenceDataService } from '@core/services/reference-data.service';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiField } from '@shared/components/ui-field/ui-field';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { UiProhibitedList } from '@shared/components/ui-prohibited-list/ui-prohibited-list';
import { BookingSummary } from '../../components/booking-summary/booking-summary';
import { ApiError } from '@core/models/api-error.model';
import { controlChanges } from '@core/utils/form-signals';
import { RenterBookingsService } from '../../services/renter-bookings.service';
import { BookingWizardService } from '../../services/booking-wizard.service';

/** FR-BKG-03 — enough text to be reviewable, capped so it stays a description. */
/**
 * The server refuses under roughly ten characters. Twenty is this screen's own
 * floor and deliberately stricter: the description is read by a human before
 * money is transferred, and "أثاث" passes a length check while telling that
 * person nothing.
 */
const MIN_DESCRIPTION = 20;
const MAX_DESCRIPTION = 500;

/**
 * Step two — what is being stored, and the prohibited-items acknowledgement
 * (RNT-04, FR-BKG-03, FR-BKG-04).
 *
 * The acknowledgement gates the continue button. That is a requirement rather
 * than a nicety: FR-BKG-04 makes it mandatory before payment, and the design
 * spells out on screen why the button is disabled instead of letting the renter
 * press a dead control and wonder.
 */
@Component({
  selector: 'app-goods-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    BookingSummary,
    UiButton,
    UiField,
    UiNotice,
    UiProhibitedList,
  ],
  templateUrl: './goods-step.html',
  styleUrl: './goods-step.scss',
})
export class GoodsStep {
  private readonly fb = inject(FormBuilder);
  private readonly bookings = inject(RenterBookingsService);
  private readonly wizard = inject(BookingWizardService);
  private readonly reference = inject(ReferenceDataService);
  private readonly router = inject(Router);

  protected readonly i18n = inject(LanguageService);

  /** The unit, not a booking: nothing exists on the server until this submits. */
  readonly unitId = input.required<string>();

  protected readonly draft = this.wizard.draft;
  protected readonly unit = this.wizard.unit;
  protected readonly hasDates = this.wizard.hasDates;

  protected readonly minLength = MIN_DESCRIPTION;
  protected readonly maxLength = MAX_DESCRIPTION;

  protected readonly submitting = signal(false);
  /** The server's own sentence when it refuses — see `fail`. */
  protected readonly errorText = signal('');
  protected readonly acknowledged = signal(false);
  private readonly prohibited = signal<ReferenceItem[]>([]);

  protected readonly form = this.fb.group({
    goodsDescription: [
      '',
      [
        Validators.required,
        Validators.minLength(MIN_DESCRIPTION),
        Validators.maxLength(MAX_DESCRIPTION),
      ],
    ],
  });

  protected readonly used = signal(0);

  protected readonly prohibitedLabels = computed(() =>
    this.prohibited().map((item) => this.i18n.pick(item)),
  );

  private readonly changes = controlChanges(this.form);

  /**
   * `changes()` is read first and its value discarded — it is the dependency
   * that makes this recompute. `form.valid` is a plain property, so without it
   * this evaluated once on an empty form and cached `false`: filling the
   * description in *after* ticking the box left the button grey forever.
   */
  protected readonly canContinue = computed(() => {
    this.changes();
    return this.form.valid && this.acknowledged() && !this.submitting();
  });

  constructor() {
    this.reference.prohibitedItems().subscribe({
      next: (items) => this.prohibited.set(items),
      error: () => this.prohibited.set([]),
    });

    const draft = this.wizard.draft();
    if (draft) {
      this.form.patchValue({ goodsDescription: draft.goodsDescription });
      this.used.set(draft.goodsDescription.length);
      this.acknowledged.set(draft.prohibitedAck);
    }

    this.form.controls.goodsDescription.valueChanges.subscribe((value) =>
      this.used.set((value ?? '').length),
    );
  }

  protected toggleAck(event: Event): void {
    this.acknowledged.set((event.target as HTMLInputElement).checked);
  }

  /**
   * Creates the booking — the one write in the journey before payment.
   *
   * The dates, the description and the acknowledgement go together because the
   * API takes them together, and it answers holding the dates. So this button
   * is the moment the fifteen minutes start, and the next screen counts down
   * the deadline the server sent rather than a timer of its own.
   */
  protected goNext(): void {
    if (!this.canContinue()) {
      this.form.markAllAsTouched();
      return;
    }

    const draft = this.wizard.draft();
    if (!draft || !this.hasDates()) return;

    const description = this.form.getRawValue().goodsDescription ?? '';
    this.wizard.setGoods(description, true);
    this.submitting.set(true);
    this.errorText.set('');

    this.bookings
      .create({
        unitId: draft.unitId,
        startDate: draft.startDate,
        endDate: draft.endDate,
        goodsDescription: description,
        prohibitedAck: true,
      })
      .subscribe({
        next: ({ booking, holdExpiresAt }) => {
          this.wizard.setBookingId(booking.id);
          this.wizard.setHold(holdExpiresAt ?? undefined);
          this.submitting.set(false);
          void this.router.navigate(['/booking', booking.id, 'pay']);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.fail(error);
        },
      });
  }

  /**
   * Why the booking was refused, in the visitor's language.
   *
   * Every one of these is something they can act on, and the server already
   * says it in Arabic — including the two that carry the owner's own limits in
   * `meta`. The important one is `BOOKING_DATES_UNAVAILABLE`: somebody took
   * the dates between the calendar and this button. That is not a fault, it is
   * what happens to the best space in the best week, so it sends them back to
   * the calendar rather than showing an error and leaving them there.
   */
  private fail(error: unknown): void {
    if (!(error instanceof ApiError)) {
      this.errorText.set(this.i18n.t('booking.createFailed'));
      return;
    }

    if (error.code === 'BOOKING_DATES_UNAVAILABLE') {
      void this.router.navigate(['/booking', 'new', this.unitId()], {
        queryParams: { taken: 1 },
      });
      return;
    }

    this.errorText.set(
      error.details?.[0]?.message || error.message || this.i18n.t('booking.createFailed'),
    );
  }
}
