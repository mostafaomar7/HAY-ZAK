import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import type { TranslationKey } from '@core/i18n/translations';
import type { ContactSubject } from '@core/models/content.model';
import { AuthService } from '@core/services/auth.service';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiField } from '@shared/components/ui-field/ui-field';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { saudiMobile } from '@shared/validators/saudi.validators';
import { ContentService } from '../../services/content.service';

const MAX_MESSAGE = 800;

const SUBJECTS: { value: ContactSubject; labelKey: TranslationKey }[] = [
  { value: 'existingBooking', labelKey: 'contact.subjectExistingBooking' },
  { value: 'listing', labelKey: 'contact.subjectListing' },
  { value: 'paymentOrInvoice', labelKey: 'contact.subjectPayment' },
  { value: 'complaint', labelKey: 'contact.subjectComplaint' },
  { value: 'other', labelKey: 'contact.subjectOther' },
];

/**
 * The enquiry form on "التواصل معنا" (FR-CMS).
 *
 * Pre-filled for a signed-in user, since asking someone the platform already
 * knows to retype their name and number is friction with no purpose.
 *
 * This is the only place in the renter portal that sends a message, and it goes
 * to platform support — never to a space's owner. Design rule 5 keeps the two
 * parties from contacting each other before a booking is approved.
 */
@Component({
  selector: 'app-contact-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, UiButton, UiField, UiNotice],
  templateUrl: './contact-form.html',
  styleUrl: './contact-form.scss',
})
export class ContactForm {
  private readonly fb = inject(FormBuilder);
  private readonly content = inject(ContentService);
  private readonly auth = inject(AuthService);

  protected readonly i18n = inject(LanguageService);

  protected readonly subjects = SUBJECTS;
  protected readonly maxMessage = MAX_MESSAGE;

  protected readonly submitting = signal(false);
  protected readonly ticketNo = signal('');
  protected readonly used = signal(0);

  protected readonly form = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    mobile: ['', [Validators.required, saudiMobile]],
    subject: ['existingBooking' as ContactSubject, [Validators.required]],
    message: [
      '',
      [Validators.required, Validators.minLength(10), Validators.maxLength(MAX_MESSAGE)],
    ],
  });

  protected readonly counter = computed(() =>
    this.i18n.t('booking.goodsCounter', { used: this.used(), max: MAX_MESSAGE }),
  );

  constructor() {
    const user = this.auth.user();
    if (user) {
      this.form.patchValue({
        fullName: user.fullName,
        email: user.email,
        mobile: user.mobile,
      });
    }

    this.form.controls.message.valueChanges.subscribe((value) =>
      this.used.set((value ?? '').length),
    );
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const value = this.form.getRawValue();

    this.content
      .submitContact({
        fullName: value.fullName ?? '',
        email: value.email ?? '',
        mobile: value.mobile ?? '',
        subject: value.subject ?? 'other',
        message: value.message ?? '',
      })
      .subscribe({
        next: (result) => {
          this.ticketNo.set(result.ticketNo);
          this.submitting.set(false);
          this.form.controls.message.reset('');
          this.used.set(0);
        },
        error: () => this.submitting.set(false),
      });
  }
}
