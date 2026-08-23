import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { LanguageService } from '@core/i18n/language.service';
import { ApiService } from '@core/services/api.service';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiField } from '@shared/components/ui-field/ui-field';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { UiPasswordStrength } from '@shared/components/ui-password-strength/ui-password-strength';
import { matchFields, strongPassword } from '@shared/validators/custom.validators';

/**
 * "إعادة تعيين كلمة المرور" and its success state (PUB-11, FR-AUTH-08).
 *
 * The token arrives in the query string from the emailed link. Nothing is
 * checked locally beyond its presence — validity is the server's judgement, and
 * a client-side guess would only produce a second, contradictory error message.
 *
 * The success copy states that other sessions were closed. That is a security
 * outcome the user should be told about rather than left to discover.
 */
@Component({
  selector: 'app-reset-password-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    UiButton,
    UiEmptyState,
    UiField,
    UiNotice,
    UiPasswordStrength,
  ],
  templateUrl: './reset-password-page.html',
  styleUrl: '../auth-form.scss',
})
export class ResetPasswordPage {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);

  protected readonly i18n = inject(LanguageService);

  readonly token = input('');

  protected readonly submitting = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal('');

  protected readonly hasToken = computed(() => !!this.token());

  protected readonly form = this.fb.group(
    {
      newPassword: ['', [Validators.required, strongPassword]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: matchFields('newPassword', 'confirmPassword') },
  );

  protected readonly password = signal('');

  constructor() {
    this.form.controls.newPassword.valueChanges.subscribe((value) =>
      this.password.set(value ?? ''),
    );
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set('');

    this.api
      .post<void, { token: string; newPassword: string }>(API_ENDPOINTS.auth.resetPassword, {
        token: this.token(),
        newPassword: this.form.getRawValue().newPassword ?? '',
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.done.set(true);
        },
        error: () => {
          this.submitting.set(false);
          this.error.set(this.i18n.t('reset.invalidLinkHint'));
        },
      });
  }
}
