import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { APP } from '@core/constants/app.constants';
import { LanguageService } from '@core/i18n/language.service';
import type { ApiError } from '@core/models/api-error.model';
import { ERROR_CODES, isApiError } from '@core/models/api-error.model';
import { AuthService } from '@core/services/auth.service';
import { countdown, deadlineIn } from '@core/utils/countdown';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiCountdown } from '@shared/components/ui-countdown/ui-countdown';
import { UiErrorNotice } from '@shared/components/ui-error-notice/ui-error-notice';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { UiOtpInput } from '@shared/components/ui-otp-input/ui-otp-input';

/** Which of the design's four OTP states is on screen. */
type OtpState = 'entering' | 'expired' | 'locked';

/**
 * LSR-00ب — "التحقق برمز OTP" (FR-AUTH-04).
 *
 * Four states from the design: entering, wrong code, code expired, and attempts
 * exhausted. The limits come from APP.otp / APP.login rather than being typed in
 * here, so they track the spec in one place.
 *
 * The client-side counters are a courtesy — NFR-SEC-05 requires the server to
 * enforce the real rate limit, since anything here can be bypassed.
 */
@Component({
  selector: 'app-otp-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiButton, UiCountdown, UiErrorNotice, UiNotice, UiOtpInput],
  templateUrl: './otp-page.html',
  styleUrl: '../auth-form.scss',
})
export class OtpPage {
  /** Bound from the ?mobile= query param. */
  readonly mobile = input('');
  /**
   * Where to go once the number is verified. Carried from registration so a
   * renter who signed up mid-booking returns to the step they left.
   */
  readonly returnUrl = input('');

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly i18n = inject(LanguageService);

  protected readonly state = signal<OtpState>('entering');
  protected readonly code = signal('');
  protected readonly submitting = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly attemptsUsed = signal(0);

  /**
   * A rate limit on the resend, counted against the server's own reset.
   *
   * Separate from the attempt lock below: one is "you guessed wrong three
   * times", the other is "you asked for codes too often", and the server
   * distinguishes them even though both end in a disabled button.
   */
  private readonly throttledUntil = signal<string | null>(null);
  protected readonly throttleSeconds = countdown(this.throttledUntil);
  protected readonly throttled = computed(() => this.throttleSeconds() > 0);

  /** Bumped on each resend so UiCountdown restarts. */
  protected readonly expirySeconds = signal(APP.otp.validityMinutes * 60);
  protected readonly lockSeconds = signal(APP.login.lockMinutes * 60);

  protected readonly maxAttempts = APP.otp.maxAttempts;
  protected readonly validityMinutes = APP.otp.validityMinutes;

  protected readonly attemptsLeft = computed(() =>
    Math.max(0, this.maxAttempts - this.attemptsUsed()),
  );

  protected readonly canSubmit = computed(
    () => this.code().length === 6 && !this.submitting() && this.state() === 'entering',
  );

  /** Shown in LTR with the country code, as in the design. */
  protected readonly displayMobile = computed(() => {
    const digits = this.mobile().replace(/\D/g, '').replace(/^966/, '').replace(/^0/, '');
    return digits ? `+966 ${digits}` : '';
  });

  protected onCode(value: string): void {
    this.code.set(value);
    this.error.set(null);
  }

  protected onExpired(): void {
    this.state.set('expired');
  }

  protected onUnlocked(): void {
    this.state.set('entering');
    this.attemptsUsed.set(0);
    this.expirySeconds.set(APP.otp.validityMinutes * 60);
  }

  protected verify(): void {
    if (!this.canSubmit()) return;

    this.submitting.set(true);
    this.error.set(null);

    this.auth.verifyMobile(this.mobile(), this.code()).subscribe({
      next: () => {
        this.submitting.set(false);
        // FR-AUTH-04 — the account is usable from here; land it in the right
        // portal rather than assuming the lessor one.
        void this.router.navigateByUrl(this.auth.landingUrl(this.returnUrl() || null));
      },
      error: (failure: unknown) => {
        this.submitting.set(false);
        if (!isApiError(failure)) return;

        // The server decides which of the four states this is; the counters
        // below only keep the screen honest between answers. NFR-SEC-05 puts
        // the real limit server-side, because anything here can be bypassed.
        if (failure.code === ERROR_CODES.OTP_EXPIRED) {
          this.state.set('expired');
          return;
        }

        if (failure.code === ERROR_CODES.OTP_ATTEMPTS_EXCEEDED || failure.retryAfterSeconds) {
          // FR-AUTH-11 — lock rather than let the attempts run on.
          this.state.set('locked');
          this.lockSeconds.set(failure.retryAfterSeconds ?? APP.login.lockMinutes * 60);
          return;
        }

        this.attemptsUsed.update((n) => n + 1);
        if (this.attemptsLeft() === 0) {
          this.state.set('locked');
          this.lockSeconds.set(APP.login.lockMinutes * 60);
          return;
        }

        this.error.set(failure);
      },
    });
  }

  protected resend(): void {
    if (this.throttled()) return;

    this.auth.resendOtp(this.mobile()).subscribe({
      next: () => {
        this.state.set('entering');
        this.code.set('');
        this.error.set(null);
        this.attemptsUsed.set(0);
        // A new value restarts the countdown component.
        this.expirySeconds.set(APP.otp.validityMinutes * 60);
      },
      error: (failure: unknown) => {
        if (!isApiError(failure)) return;

        this.error.set(failure);
        // Never resend on our own behind a 429 — see countdown.ts.
        if (failure.retryAfterSeconds) {
          this.throttledUntil.set(deadlineIn(failure.retryAfterSeconds));
        }
      },
    });
  }
}
