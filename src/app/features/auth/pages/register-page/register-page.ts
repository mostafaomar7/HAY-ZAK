import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IdType, UserRole } from '@core/enums/user-role.enum';
import { AuthService } from '@core/services/auth.service';
import { markFormTouched } from '@core/utils/form.utils';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiField } from '@shared/components/ui-field/ui-field';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { UiPasswordStrength } from '@shared/components/ui-password-strength/ui-password-strength';
import { matchFields, strongPassword } from '@shared/validators/custom.validators';
import { saudiMobile, saudiNationalId } from '@shared/validators/saudi.validators';

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
  imports: [ReactiveFormsModule, RouterLink, UiButton, UiField, UiNotice, UiPasswordStrength],
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
  protected readonly error = signal('');

  protected readonly isRenter = computed(() => this.role() === 'renter');

  protected readonly form = this.fb.group(
    {
      fullName: ['', [Validators.required, Validators.minLength(6)]],
      idNumber: ['', [Validators.required, saudiNationalId]],
      address: [''],
      email: ['', [Validators.required, Validators.email]],
      mobile: ['', [Validators.required, saudiMobile]],
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
    if (this.form.invalid) {
      markFormTouched(this.form);
      return;
    }

    this.submitting.set(true);
    this.error.set('');

    const value = this.form.getRawValue();

    this.auth
      .register({
        role: this.isRenter() ? UserRole.Renter : UserRole.Lessor,
        fullName: value.fullName ?? '',
        idNumber: value.idNumber ?? '',
        idType: this.idType(),
        address: this.isRenter() ? (value.address ?? '') : undefined,
        email: value.email ?? '',
        mobile: value.mobile ?? '',
        password: value.password ?? '',
        // TODO: replace with the active version from /content/terms/active once
        // the CMS endpoint is live (FR-ADM-07).
        termsVersionId: 'current',
        acceptedTerms: true,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          // FR-AUTH-04 — the account is not usable until the mobile is verified.
          void this.router.navigate(['/auth/verify'], {
            queryParams: { mobile: value.mobile, returnUrl: this.returnUrl() || null },
          });
        },
        error: (err: { errors?: Record<string, string[]> }) => {
          this.submitting.set(false);
          this.error.set(
            err.errors?.['email']?.[0] ??
              err.errors?.['mobile']?.[0] ??
              'تعذّر إنشاء الحساب. تحقّق من البيانات وحاول مرة أخرى.',
          );
        },
      });
  }
}
