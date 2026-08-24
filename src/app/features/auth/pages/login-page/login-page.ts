import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import type { ApiError } from '@core/models/api-error.model';
import { isApiError } from '@core/models/api-error.model';
import { AuthService } from '@core/services/auth.service';
import { applyFieldErrors, clearServerErrors } from '@core/utils/api-form';
import { countdown, deadlineIn, formatCountdown } from '@core/utils/countdown';
import { markFormTouched } from '@core/utils/form.utils';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiErrorNotice } from '@shared/components/ui-error-notice/ui-error-notice';
import { UiField } from '@shared/components/ui-field/ui-field';

/**
 * LSR-00ج — "تسجيل دخول المؤجر".
 *
 * FR-AUTH-07 allows either a mobile number or an email address in one field, so
 * there is a single identifier input rather than a mode switch.
 */
@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, UiButton, UiErrorNotice, UiField],
  templateUrl: './login-page.html',
  styleUrl: '../auth-form.scss',
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly i18n = inject(LanguageService);

  protected readonly submitting = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  /** Field messages for controls this form does not have. */
  protected readonly extras = signal<readonly string[]>([]);

  /**
   * FR-AUTH-11 — five attempts per identifier per fifteen minutes.
   *
   * The button stays disabled until the server's own reset elapses, and
   * nothing retries on its own: an automatic retry against a limiter turns a
   * fifteen-minute lockout into an hour.
   */
  private readonly lockedUntil = signal<string | null>(null);
  protected readonly lockSeconds = countdown(this.lockedUntil);
  protected readonly locked = computed(() => this.lockSeconds() > 0);
  protected readonly lockLabel = computed(() =>
    this.i18n.t('error.retryIn', { seconds: formatCountdown(this.lockSeconds()) }),
  );

  protected readonly form = this.fb.group({
    identifier: ['', [Validators.required]],
    password: ['', [Validators.required]],
    rememberMe: [true],
  });

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

    const { identifier, password, rememberMe } = this.form.getRawValue();

    this.auth
      .login({ identifier: identifier ?? '', password: password ?? '', rememberMe: !!rememberMe })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          void this.router.navigateByUrl(this.returnUrl());
        },
        error: (failure: unknown) => {
          this.submitting.set(false);
          if (!isApiError(failure)) return;

          // The server's message, verbatim — including its decision not to say
          // which half was wrong, which is what stops an attacker enumerating
          // registered accounts. That judgement is the server's to make.
          this.error.set(failure);
          this.extras.set(applyFieldErrors(this.form, failure));

          if (failure.retryAfterSeconds) {
            this.lockedUntil.set(deadlineIn(failure.retryAfterSeconds));
          }
        },
      });
  }

  /**
   * Where to go next: the route authGuard recorded when it bounced the user
   * here, or the portal their role belongs to.
   */
  private returnUrl(): string {
    const params = new URLSearchParams(location.search);
    return this.auth.landingUrl(params.get('returnUrl'));
  }
}
