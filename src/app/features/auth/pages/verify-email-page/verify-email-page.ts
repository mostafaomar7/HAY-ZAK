import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import type { ApiError } from '@core/models/api-error.model';
import { isApiError } from '@core/models/api-error.model';
import { EmailVerificationService } from '@core/services/email-verification.service';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';

/**
 * Where the link in the confirmation email lands (§18).
 *
 * The link points **here, at the web application** — not at the API — and this
 * page posts the token. A `GET` verification link on the API would be spent by
 * the corporate mail scanner that opens every link in a message before the
 * recipient sees it, and the user would then follow one that had already been
 * used without ever having used it.
 *
 * Open to everybody. Whoever follows the link may not be signed in on the
 * device they opened it on, and a login wall here would strand them holding a
 * token that is timing out.
 */
@Component({
  selector: 'app-verify-email-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiButton, UiNotice, UiSkeleton],
  templateUrl: './verify-email-page.html',
  styleUrl: '../auth-form.scss',
})
export class VerifyEmailPage {
  private readonly emails = inject(EmailVerificationService);

  protected readonly i18n = inject(LanguageService);

  /** From `?token=` — bound by the router. */
  readonly token = input('');

  protected readonly isVerifying = signal(true);
  protected readonly verified = signal(false);
  /** The link had already been used. A success, and worded as one. */
  protected readonly alreadyVerified = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  constructor() {
    this.verify();
  }

  protected verify(): void {
    const token = this.token();

    // No token at all is a malformed link rather than a rejected one — say so
    // without a round trip that can only answer the same thing.
    if (!token) {
      this.isVerifying.set(false);
      this.error.set(null);
      return;
    }

    this.isVerifying.set(true);
    this.error.set(null);

    this.emails.verify(token).subscribe({
      next: (result) => {
        this.isVerifying.set(false);
        this.verified.set(result.verified);
        this.alreadyVerified.set(!!result.alreadyVerified);
      },
      error: (failure: unknown) => {
        this.isVerifying.set(false);
        if (isApiError(failure)) this.error.set(failure);
      },
    });
  }
}
