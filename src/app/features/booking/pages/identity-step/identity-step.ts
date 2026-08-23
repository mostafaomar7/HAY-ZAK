import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  NgZone,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { VerificationStatus } from '@core/enums/user-role.enum';
import { LanguageService } from '@core/i18n/language.service';
import type { NafathSession, NafathState } from '@core/models/identity.model';
import { AuthService } from '@core/services/auth.service';
import { IdentityService } from '@core/services/identity.service';
import { maskNationalId } from '@core/utils/money.utils';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiCountdown } from '@shared/components/ui-countdown/ui-countdown';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { UiPriceBreakdown } from '@shared/components/ui-price-breakdown/ui-price-breakdown';
import { calculatePrice } from '@core/utils/money.utils';
import { BookingWizardService } from '../../services/booking-wizard.service';

/** How often the Nafath session is re-read while the user is in the app. */
const POLL_MS = 3000;

/**
 * Step three — identity verification through Nafath (RNT-09).
 *
 * All five states the design specifies live here: not started, awaiting
 * confirmation, success, failure or timeout, and a name mismatch. They are one
 * component rather than five because they are one session moving through its
 * lifecycle, and the confirmation number, the countdown and the retry action are
 * shared by more than one of them.
 *
 * Already-verified renters never see this screen — the route guard sends them
 * straight to payment, matching the design's "تُتخطّى الشاشة" case.
 *
 * Polling runs outside the Angular zone. A zone-patched interval would re-run
 * change detection across the whole tree every three seconds and leave the
 * application permanently unstable.
 */
@Component({
  selector: 'app-identity-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiButton, UiCountdown, UiNotice, UiPriceBreakdown],
  templateUrl: './identity-step.html',
  styleUrl: './identity-step.scss',
})
export class IdentityStep {
  private readonly identity = inject(IdentityService);
  private readonly auth = inject(AuthService);
  private readonly wizard = inject(BookingWizardService);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);

  protected readonly i18n = inject(LanguageService);

  readonly bookingId = input.required<string>();

  protected readonly state = signal<NafathState>('idle');
  protected readonly session = signal<NafathSession | null>(null);
  protected readonly starting = signal(false);

  protected readonly draft = this.wizard.draft;
  protected readonly unit = this.wizard.unit;

  private timer?: ReturnType<typeof setInterval>;

  protected readonly maskedId = computed(() => {
    const id = this.auth.user()?.id ?? '';
    return id ? maskNationalId(id) : '';
  });

  protected readonly price = computed(() =>
    calculatePrice(this.unit()?.dailyPrice ?? 0, this.draft()?.daysCount ?? 0),
  );

  /** Seconds left on the Nafath session — separate from the booking hold. */
  protected readonly sessionSeconds = computed(() => {
    const expiry = this.session()?.expiresAt;
    if (!expiry) return 0;
    return Math.max(0, Math.floor((new Date(expiry).getTime() - Date.now()) / 1000));
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopPolling());

    // The design skips this screen entirely for a verified renter.
    if (this.auth.user()?.mobileVerifiedAt && this.isAlreadyVerified()) {
      queueMicrotask(() => this.goToPayment(true));
    }
  }

  protected start(): void {
    if (this.starting()) return;
    this.starting.set(true);

    this.identity.start().subscribe({
      next: (session) => {
        this.session.set(session);
        this.state.set(session.state === 'idle' ? 'awaiting' : session.state);
        this.starting.set(false);
        this.startPolling(session.requestId);
      },
      error: () => {
        this.starting.set(false);
        this.state.set('failed');
      },
    });
  }

  protected retry(): void {
    this.stopPolling();
    this.session.set(null);
    this.state.set('idle');
    this.start();
  }

  protected onSessionExpired(): void {
    if (this.state() === 'awaiting') {
      this.stopPolling();
      this.state.set('failed');
    }
  }

  protected goToPayment(replaceUrl = false): void {
    void this.router.navigate(['/booking', this.bookingId(), 'pay'], { replaceUrl });
  }

  private isAlreadyVerified(): boolean {
    // The session user carries the verification flag once the profile is loaded;
    // absent it, the screen is shown and the server decides.
    const status = (this.auth.user() as { verificationStatus?: VerificationStatus } | null)
      ?.verificationStatus;
    return status === VerificationStatus.Verified;
  }

  private startPolling(requestId: string): void {
    this.stopPolling();

    this.zone.runOutsideAngular(() => {
      this.timer = setInterval(() => {
        this.identity.status(requestId).subscribe({
          next: (session) => {
            this.zone.run(() => {
              this.session.set(session);
              this.state.set(session.state);

              if (session.state === 'success') {
                this.stopPolling();
                // A beat on the success card, then straight on — the design
                // shows "جارٍ الانتقال إلى خطوة الدفع…" rather than a button.
                setTimeout(() => this.goToPayment(), 1200);
              } else if (session.state === 'failed' || session.state === 'mismatch') {
                this.stopPolling();
              }
            });
          },
          error: () => undefined,
        });
      }, POLL_MS);
    });
  }

  private stopPolling(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}
