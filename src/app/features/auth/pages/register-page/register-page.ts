import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IdType, UserRole } from '@core/enums/user-role.enum';
import { LanguageService } from '@core/i18n/language.service';
import type { ApiError } from '@core/models/api-error.model';
import type { SignupTerms } from '@core/models/user.model';
import { isApiError } from '@core/models/api-error.model';
import { AuthService } from '@core/services/auth.service';
import { applyFieldErrors, clearServerErrors } from '@core/utils/api-form';
import { countdown, deadlineIn, formatCountdown } from '@core/utils/countdown';
import { markFormTouched } from '@core/utils/form.utils';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiField } from '@shared/components/ui-field/ui-field';
import { UiErrorNotice } from '@shared/components/ui-error-notice/ui-error-notice';
import { UiPasswordStrength } from '@shared/components/ui-password-strength/ui-password-strength';
import { matchFields, strongPassword } from '@shared/validators/custom.validators';
import { saudiNationalId } from '@shared/validators/saudi.validators';

/** Which of the two accounts is being created (FR-AUTH-12: one role each). */
export type RegistrationRole = 'renter' | 'lessor';

/**
 * Registration for both roles (PUB-07 for the renter, LSR-00أ for the lessor;
 * FR-AUTH-01/02/03/06).
 *
 * One component, parameterised by the `role` route segment. The two designs are
 * the same form save for the heading and one extra field — the renter supplies
 * an address (FR-AUTH-03) and the lessor does not — so a second copy would have
 * meant maintaining the ID validation, the password rules and the terms consent
 * twice.
 *
 * The role is never a control the user can change after arriving here: it comes
 * from the URL, chosen on the account-type screen, because FR-AUTH-12 bars one
 * account from holding both roles in Phase 1.
 */
@Component({
  selector: 'app-register-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, UiButton, UiField, UiErrorNotice, UiPasswordStrength],
  templateUrl: './register-page.html',
  styleUrl: '../auth-form.scss',
})
export class RegisterPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Bound from the `:role` segment; defaults to the lessor portal's own flow. */
  readonly role = input<RegistrationRole>('lessor');
  /** Where to return after the mobile is verified — set by the booking journey. */
  readonly returnUrl = input('');

  protected readonly submitting = signal(false);
  protected readonly i18n = inject(LanguageService);

  /**
   * The legal version this signup consents to.
   *
   * Fetched, never assumed: consent is recorded against this exact id, and a
   * stale one comes back as TERMS_ACCEPTANCE_REQUIRED. Submit stays disabled
   * until it arrives — registering without it cannot succeed.
   */
  protected readonly terms = signal<SignupTerms | null>(null);

  protected readonly error = signal<ApiError | null>(null);
  /** Field messages for controls this form does not have. */
  protected readonly extras = signal<readonly string[]>([]);

  /** FR-AUTH-11 — five attempts per identifier per fifteen minutes. */
  private readonly lockedUntil = signal<string | null>(null);
  protected readonly lockSeconds = countdown(this.lockedUntil);
  protected readonly locked = computed(() => this.lockSeconds() > 0);
  protected readonly lockLabel = computed(() =>
    this.i18n.t('error.retryIn', { seconds: formatCountdown(this.lockSeconds()) }),
  );

  protected readonly isRenter = computed(() => this.role() === 'renter');

  protected readonly form = this.fb.group(
    {
      fullName: ['', [Validators.required, Validators.minLength(6)]],
      idNumber: ['', [Validators.required, saudiNationalId]],
      address: [''],
      email: ['', [Validators.required, Validators.email]],
      // Required, and nothing more. The server accepts 05…, +9665…, Arabic
      // digits, spaces and dashes, and normalises them — a shape check here
      // would only reject numbers the API would have taken.
      mobile: ['', [Validators.required]],
      password: ['', [Validators.required, strongPassword]],
      confirmPassword: ['', [Validators.required]],
      acceptedTerms: [false, [Validators.requiredTrue]],
    },
    { validators: matchFields('password', 'confirmPassword') },
  );

  protected readonly password = signal('');

  /** National ID starts with 1, Iqama with 2 — inferred, not asked. */
  protected readonly idType = computed<IdType>(() =>
    (this.form.controls.idNumber.value ?? '').startsWith('2') ? IdType.Iqama : IdType.NationalId,
  );

  constructor() {
    this.auth.terms().subscribe({
      next: (terms) => this.terms.set(terms),
      error: () => undefined,
    });

    this.form.controls.password.valueChanges.subscribe((value) => this.password.set(value ?? ''));

    // FR-AUTH-03 makes the address mandatory for renters and irrelevant for
    // lessors; applying it once here keeps the template free of the condition.
    queueMicrotask(() => {
      if (this.isRenter()) {
        this.form.controls.address.addValidators(Validators.required);
        this.form.controls.address.updateValueAndValidity();
      }
    });
  }

  protected submit(): void {
    if (this.locked()) return;

    clearServerErrors(this.form);

    if (this.form.invalid) {
      markFormTouched(this.form);
      return;
    }

    this.submitting.set(true);
    this.error.set(null);
    this.extras.set([]);

    const value = this.form.getRawValue();

    this.auth
      .register({
        role: this.isRenter() ? UserRole.Renter : UserRole.Lessor,
        fullName: value.fullName ?? '',
        idNumber: value.idNumber ?? '',
        idType: this.idType(),
        addressLine: this.isRenter() ? (value.address ?? '') : undefined,
        email: value.email ?? '',
        mobile: value.mobile ?? '',
        password: value.password ?? '',
        // TODO: replace with the active version from /content/terms/active once
        // the CMS endpoint is live (FR-ADM-07).
        termsVersionId: this.terms()?.id ?? '',
        acceptedTerms: true,
      })
      .subscribe({
        next: (created) => {
          this.submitting.set(false);
          // No tokens here: the account is PENDING_VERIFICATION and the OTP
          // screen is what makes it usable. The masked destination travels with
          // it so the user can confirm the number the code went to.
          void this.router.navigate(['/auth/verify'], {
            queryParams: {
              mobile: value.mobile,
              destination: created.verification.destination,
              devCode: created.verification.devCode ?? null,
              returnUrl: this.returnUrl() || null,
            },
          });
        },
        error: (failure: unknown) => {
          this.submitting.set(false);
          if (!isApiError(failure)) return;

          // A 422 names the fields; the general message covers the rest. No
          // hand-picking of `email` over `mobile` — the server said which.
          this.error.set(failure);
          this.extras.set(applyFieldErrors(this.form, failure));

          if (failure.retryAfterSeconds) {
            this.lockedUntil.set(deadlineIn(failure.retryAfterSeconds));
          }
        },
      });
  }
}
