import { HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../constants/api-endpoints';
import { SKIP_AUTH } from '../interceptors/auth.interceptor';
import { ApiService } from './api.service';

/** What the send call answers with. */
export interface EmailVerificationSent {
  sent: boolean;
  expiresInHours: number;
  /**
   * **Local development only.** The server strips it by configuration outside
   * development, exactly as OTP responses strip `devCode` — so nothing may
   * branch on it, display it, or assume it exists.
   */
  devLink?: string;
}

export interface EmailVerificationResult {
  verified: boolean;
  /**
   * The link had already been used.
   *
   * A **success**, not an error: clicking a link twice is an ordinary thing to
   * do, and mail scanners open every link in a message before the recipient
   * does. An error screen here reads as "my account broke".
   */
  alreadyVerified?: boolean;
}

/**
 * Confirming an email address (§18).
 *
 * The emailed link points at **the web application, not the API**, and the page
 * it opens posts the token. A `GET` verification link would be spent by the
 * corporate mail scanner that opened it before the recipient ever clicked, and
 * the user would then follow a link that had already expired without having
 * used it.
 *
 * That is why `verify` is unauthenticated: whoever follows the link may not be
 * signed in on the device they opened it on, and requiring a session would
 * strand them on a login screen holding a token that is timing out.
 */
@Injectable({ providedIn: 'root' })
export class EmailVerificationService {
  private readonly api = inject(ApiService);

  /** Sixty-second cooldown, server-side. Asking early is a 429. */
  send(): Observable<EmailVerificationSent> {
    return this.api.post<EmailVerificationSent>(API_ENDPOINTS.me.sendEmailVerification);
  }

  /** The token out of the link. Valid 24 hours. */
  verify(token: string): Observable<EmailVerificationResult> {
    return this.api.post<EmailVerificationResult, { token: string }>(
      API_ENDPOINTS.auth.verifyEmail,
      { token },
      { context: new HttpContext().set(SKIP_AUTH, true) },
    );
  }
}
