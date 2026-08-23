import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { markFormTouched } from '@core/utils/form.utils';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiField } from '@shared/components/ui-field/ui-field';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';

/**
 * LSR-00ج — "تسجيل دخول المؤجر".
 *
 * FR-AUTH-07 allows either a mobile number or an email address in one field, so
 * there is a single identifier input rather than a mode switch.
 */
@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, UiButton, UiField, UiNotice],
  templateUrl: './login-page.html',
  styleUrl: '../auth-form.scss',
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly submitting = signal(false);
  protected readonly error = signal('');

  protected readonly form = this.fb.group({
    identifier: ['', [Validators.required]],
    password: ['', [Validators.required]],
    rememberMe: [true],
  });

  protected submit(): void {
    if (this.form.invalid) {
      markFormTouched(this.form);
      return;
    }

    this.submitting.set(true);
    this.error.set('');

    const { identifier, password, rememberMe } = this.form.getRawValue();

    this.auth
      .login({ identifier: identifier ?? '', password: password ?? '', rememberMe: !!rememberMe })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          void this.router.navigateByUrl(this.returnUrl());
        },
        error: () => {
          this.submitting.set(false);
          // Deliberately does not say which half was wrong — naming the field
          // would let an attacker enumerate registered accounts.
          this.error.set('بيانات الدخول غير صحيحة. تحقّق من الرقم أو البريد وكلمة المرور.');
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
