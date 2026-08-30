import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { REGEX } from '@core/constants/app.constants';
import { LanguageService } from '@core/i18n/language.service';
import { isApiError } from '@core/models/api-error.model';
import { isTwoFactorChallenge } from '@core/models/two-factor';
import { AuthService } from '@core/services/auth.service';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiField } from '@shared/components/ui-field/ui-field';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { UiOtpInput } from '@shared/components/ui-otp-input/ui-otp-input';

/**
 * The console's own entrance (design: "تسجيل دخول الإدارة").
 *
 * Separate from `/auth/login` because it is a different door with different
 * rules: email rather than mobile, two-factor from an authenticator app rather
 * than an SMS code, and every attempt written to the audit trail. Sharing one
 * form would mean the renter's login carrying admin-only copy about session
 * length and MFA that means nothing to them.
 *
 * The second factor is asked for by the **server**, when the account has one.
 * This screen used to route every successful sign-in to the mobile OTP page on
 * the principle that administrators always need one — a step the API never
 * asks for and cannot complete, which left a correct password looking broken.
 */
@Component({
  selector: 'app-admin-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, UiButton, UiField, UiNotice, UiOtpInput],
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
      next: (result) => {
        this.submitting.set(false);

        // The second factor is asked for by the *server*, when this account
        // has one — not by this screen on principle. It used to route every
        // successful sign-in to the mobile OTP page regardless, which is a
        // step the API never asks for and cannot complete.
        if (isTwoFactorChallenge(result)) {
          this.challengeToken.set(result.challengeToken);
          return;
        }

        void this.router.navigateByUrl('/admin');
      },
      error: () => {
        this.submitting.set(false);
        this.failed.set(true);
      },
    });
  }

  /**
   * The code step, shown in place of the password form.
   *
   * Not a route: the challenge is good for five minutes, and a navigation that
   * lost it would put an administrator back at a password they already typed
   * correctly — on the screen where they are most likely to conclude their
   * account is broken.
   */
  protected readonly challengeToken = signal('');
  protected readonly codeFailed = signal(false);
  protected readonly verifying = signal(false);

  protected verifyCode(code: string): void {
    if (this.verifying()) return;

    this.verifying.set(true);
    this.codeFailed.set(false);

    this.auth.verifyTwoFactor({ challengeToken: this.challengeToken(), code }).subscribe({
      next: () => {
        this.verifying.set(false);
        void this.router.navigateByUrl('/admin');
      },
      error: (failure: unknown) => {
        this.verifying.set(false);
        this.codeFailed.set(true);
        // An expired challenge cannot be fixed by retyping — go back a step.
        if (isApiError(failure) && failure.code === 'TWO_FACTOR_CHALLENGE_EXPIRED') {
          this.challengeToken.set('');
        }
      },
    });
  }
}
