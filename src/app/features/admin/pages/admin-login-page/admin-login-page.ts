import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { REGEX } from '@core/constants/app.constants';
import { LanguageService } from '@core/i18n/language.service';
import { AuthService } from '@core/services/auth.service';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiField } from '@shared/components/ui-field/ui-field';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';

/**
 * The console's own entrance (design: "تسجيل دخول الإدارة").
 *
 * Separate from `/auth/login` because it is a different door with different
 * rules: email rather than mobile, two-factor from an authenticator app rather
 * than an SMS code, and every attempt written to the audit trail. Sharing one
 * form would mean the renter's login carrying admin-only copy about session
 * length and MFA that means nothing to them.
 *
 * The password step ends at the shared OTP screen, which already handles the
 * six-box code, the countdown and the resend.
 */
@Component({
  selector: 'app-admin-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, UiButton, UiField, UiNotice],
  templateUrl: './admin-login-page.html',
  styleUrl: './admin-login-page.scss',
})
export class AdminLoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly i18n = inject(LanguageService);

  protected readonly submitting = signal(false);
  protected readonly failed = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.pattern(REGEX.email)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    rememberDevice: [false],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.failed.set(false);

    const { email, password, rememberDevice } = this.form.getRawValue();
    this.auth.login({ identifier: email, password, rememberMe: rememberDevice }).subscribe({
      next: () => {
        this.submitting.set(false);
        // Password alone is never enough here — the second factor is mandatory
        // (design: "مصادقة ثنائية إلزامية"), so this always continues to OTP.
        void this.router.navigate(['/auth/verify'], {
          queryParams: { returnUrl: '/admin', channel: 'authenticator' },
        });
      },
      error: () => {
        this.submitting.set(false);
        this.failed.set(true);
      },
    });
  }
}
