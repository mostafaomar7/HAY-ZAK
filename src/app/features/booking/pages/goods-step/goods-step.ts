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
import { BookingService } from '../../services/booking.service';
import { BookingWizardService } from '../../services/booking-wizard.service';

/** FR-BKG-03 — enough text to be reviewable, capped so it stays a description. */
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
  private readonly bookings = inject(BookingService);
  private readonly wizard = inject(BookingWizardService);
  private readonly reference = inject(ReferenceDataService);
  private readonly router = inject(Router);

  protected readonly i18n = inject(LanguageService);

  readonly bookingId = input.required<string>();

  protected readonly draft = this.wizard.draft;
  protected readonly unit = this.wizard.unit;
  protected readonly hasDates = this.wizard.hasDates;

  protected readonly minLength = MIN_DESCRIPTION;
  protected readonly maxLength = MAX_DESCRIPTION;

  protected readonly submitting = signal(false);
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

  protected readonly canContinue = computed(
    () => this.form.valid && this.acknowledged() && !this.submitting(),
  );

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

  protected goNext(): void {
    if (!this.canContinue()) {
      this.form.markAllAsTouched();
      return;
    }

    const description = this.form.getRawValue().goodsDescription ?? '';
    this.wizard.setGoods(description, true);
    this.submitting.set(true);

    this.bookings
      .confirm(this.bookingId(), { goodsDescription: description, prohibitedAck: true })
      .subscribe({
        next: (booking) => {
          this.wizard.setHold(booking.holdExpiresAt);
          this.submitting.set(false);
          void this.router.navigate(['/booking', this.bookingId(), 'identity']);
        },
        error: () => this.submitting.set(false),
      });
  }
}
