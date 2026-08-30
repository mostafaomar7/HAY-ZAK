import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LanguageService } from '@core/i18n/language.service';
import type { ApiError } from '@core/models/api-error.model';
import { isApiError } from '@core/models/api-error.model';
import type { TwoFactorSetup, TwoFactorStatus } from '@core/models/two-factor';
import { NotificationService } from '@core/services/notification.service';
import { TwoFactorService } from '@core/services/two-factor.service';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiErrorNotice } from '@shared/components/ui-error-notice/ui-error-notice';
import { UiField } from '@shared/components/ui-field/ui-field';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { UiOtpInput } from '@shared/components/ui-otp-input/ui-otp-input';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';

/** Where the enrolment has got to. */
type Step = 'idle' | 'scanning' | 'codes' | 'disabling';

/**
 * Two-factor authentication for the signed-in account (§17).
 *
 * Its own screen rather than a panel on "حسابي": enrolment is a sequence with a
 * point of no return in the middle — the recovery codes are shown once and
 * never again — and a multi-step flow inside an accordion of unrelated settings
 * is how somebody navigates away from them by accident.
 *
 * **TOTP, not SMS.** The account's phone number is what a SIM-swap takes over,
 * so a code sent to it protects the account from everyone except the attacker
 * this is here to stop.
 */
@Component({
  selector: 'app-security-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    UiButton,
    UiErrorNotice,
    UiField,
    UiNotice,
    UiOtpInput,
    UiSkeleton,
  ],
  templateUrl: './security-page.html',
  styleUrl: './security-page.scss',
})
export class SecurityPage {
  private readonly fb = inject(FormBuilder);
  private readonly twoFactor = inject(TwoFactorService);
  private readonly notifications = inject(NotificationService);

  protected readonly i18n = inject(LanguageService);

  protected readonly status = signal<TwoFactorStatus | null>(null);
  protected readonly setup = signal<TwoFactorSetup | null>(null);
  protected readonly recoveryCodes = signal<string[] | null>(null);
  protected readonly step = signal<Step>('idle');

  protected readonly isLoading = signal(true);
  protected readonly failed = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  /** Password *and* a code — the endpoint refuses either one alone. */
  protected readonly disableForm = this.fb.nonNullable.group({
    password: ['', [Validators.required]],
    code: ['', [Validators.required, Validators.minLength(6)]],
  });

  /**
   * The secret in groups of four.
   *
   * Somebody enrolling on the phone that is showing this page cannot scan the
   * screen it is on, so typing thirty-two unbroken characters is the real path
   * rather than the fallback.
   */
  protected readonly groupedSecret = computed(() => {
    const secret = this.setup()?.secret ?? '';
    return (secret.match(/.{1,4}/g) ?? []).join(' ');
  });

  /** Fewer than three left is worth saying out loud, not just counting. */
  protected readonly recoveryLow = computed(() => {
    const status = this.status();
    return (
      !!status?.enabled && status.recoveryCodesRemaining > 0 && status.recoveryCodesRemaining < 3
    );
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.failed.set(false);

    this.twoFactor.load().subscribe({
      next: (status) => {
        this.status.set(status);
        this.isLoading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Issues a provisional secret and shows it. Nothing is enabled yet.
   *
   * Running it again replaces the secret, which silently breaks an entry the
   * user may already have added to their authenticator — so the template asks
   * before offering it a second time.
   */
  protected beginSetup(): void {
    this.busy.set(true);
    this.error.set(null);

    this.twoFactor.setup().subscribe({
      next: (setup) => {
        this.busy.set(false);
        this.setup.set(setup);
        this.step.set('scanning');
      },
      error: (failure: unknown) => {
        this.busy.set(false);
        if (isApiError(failure)) this.error.set(failure);
      },
    });
  }

  /** The code proves the secret was stored. This is what turns it on. */
  protected confirmSetup(code: string): void {
    if (this.busy()) return;

    this.busy.set(true);
    this.error.set(null);

    this.twoFactor.enable({ code }).subscribe({
      next: (result) => {
        this.busy.set(false);
        this.status.set(result.status);
        this.setup.set(null);
        this.recoveryCodes.set(result.recoveryCodes);
        // Straight to the codes, even when the server sent none: the screen has
        // to say which of those happened rather than closing on both.
        this.step.set('codes');
      },
      error: (failure: unknown) => {
        this.busy.set(false);
        if (isApiError(failure)) this.error.set(failure);
      },
    });
  }

  protected disable(): void {
    if (this.disableForm.invalid || this.busy()) {
      this.disableForm.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    this.error.set(null);

    this.twoFactor.disable(this.disableForm.getRawValue()).subscribe({
      next: (status) => {
        this.busy.set(false);
        this.status.set(status);
        this.disableForm.reset();
        this.step.set('idle');
        this.notifications.success(this.i18n.t('security.disabled'));
      },
      error: (failure: unknown) => {
        this.busy.set(false);
        if (isApiError(failure)) this.error.set(failure);
      },
    });
  }

  /** Leaves the codes screen. They are gone from here on. */
  protected acknowledgeCodes(): void {
    this.recoveryCodes.set(null);
    this.step.set('idle');
  }

  protected cancel(): void {
    this.setup.set(null);
    this.error.set(null);
    this.disableForm.reset();
    this.step.set('idle');
  }

  protected startDisabling(): void {
    this.error.set(null);
    this.step.set('disabling');
  }
}
