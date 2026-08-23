import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { APP } from '@core/constants/app.constants';
import { AuthService } from '@core/services/auth.service';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiCountdown } from '@shared/components/ui-countdown/ui-countdown';
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
  imports: [RouterLink, UiButton, UiCountdown, UiNotice, UiOtpInput],
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

  protected readonly state = signal<OtpState>('entering');
  protected readonly code = signal('');
  protected readonly submitting = signal(false);
  protected readonly error = signal('');
  protected readonly attemptsUsed = signal(0);

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
    this.error.set('');
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
    this.error.set('');

    this.auth.verifyOtp({ mobile: this.mobile(), code: this.code() }).subscribe({
      next: () => {
        this.submitting.set(false);
        // FR-AUTH-04 — the account is usable from here; land it in the right
        // portal rather than assuming the lessor one.
        void this.router.navigateByUrl(this.auth.landingUrl(this.returnUrl() || null));
      },
      error: () => {
        this.submitting.set(false);
        this.attemptsUsed.update((n) => n + 1);

        if (this.attemptsLeft() === 0) {
          // FR-AUTH-11 — lock rather than let the attempts run on.
          this.state.set('locked');
          this.lockSeconds.set(APP.login.lockMinutes * 60);
          return;
        }

        this.error.set('الرمز غير صحيح. تحقّق من الرسالة وحاول مرة أخرى.');
      },
    });
  }

  protected resend(): void {
    this.auth.requestOtp(this.mobile()).subscribe({
      next: () => {
        this.state.set('entering');
        this.code.set('');
        this.error.set('');
        this.attemptsUsed.set(0);
        // A new value restarts the countdown component.
        this.expirySeconds.set(APP.otp.validityMinutes * 60);
      },
    });
  }
}
