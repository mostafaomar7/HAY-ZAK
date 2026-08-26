import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { LanguageService } from '@core/i18n/language.service';
import { ApiService } from '@core/services/api.service';
import { controlChanges } from '@core/utils/form-signals';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiCountdown } from '@shared/components/ui-countdown/ui-countdown';
import { UiField } from '@shared/components/ui-field/ui-field';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { saudiMobile } from '@shared/validators/saudi.validators';

/** Cooldown before the link can be sent again, in seconds. */
const RESEND_SECONDS = 60;

type Channel = 'email' | 'mobile';

/**
 * "استعادة كلمة المرور" — the request and the confirmation (PUB-10, FR-AUTH-08).
 *
 * The confirmation never says whether the address was recognised. Telling a
 * visitor "no account with that email" turns this form into a way to enumerate
 * who has an account, so the wording is the same either way and the cooldown
 * applies regardless.
 */
@Component({
  selector: 'app-forgot-password-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, UiButton, UiCountdown, UiField, UiNotice],
  templateUrl: './forgot-password-page.html',
  styleUrl: '../auth-form.scss',
})
export class ForgotPasswordPage {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);

  protected readonly i18n = inject(LanguageService);

  protected readonly channel = signal<Channel>('email');
  protected readonly submitting = signal(false);
  protected readonly sent = signal(false);
  protected readonly cooldown = signal(0);

  protected readonly form = this.fb.group({
    identifier: ['', [Validators.required]],
  });

  private readonly changes = controlChanges(this.form);

  protected readonly target = computed(() => {
    this.changes();
    return this.form.controls.identifier.value ?? '';
  });

  protected setChannel(channel: Channel): void {
    this.channel.set(channel);

    const control = this.form.controls.identifier;
    control.setValidators(
      channel === 'email'
        ? [Validators.required, Validators.email]
        : [Validators.required, saudiMobile],
    );
    control.updateValueAndValidity();
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);

    this.api
      .post<void, { identifier: string; channel: Channel }>(API_ENDPOINTS.auth.forgotPassword, {
        identifier: this.target(),
        channel: this.channel(),
      })
      .subscribe({
        // Success and failure land in the same place, deliberately — see above.
        next: () => this.onSent(),
        error: () => this.onSent(),
      });
  }

  protected onCooldownFinished(): void {
    this.cooldown.set(0);
  }

  private onSent(): void {
    this.submitting.set(false);
    this.sent.set(true);
    this.cooldown.set(RESEND_SECONDS);
  }
}
