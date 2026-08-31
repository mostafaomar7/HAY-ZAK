import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { signal } from '@angular/core';
import { API_ENDPOINTS } from '../constants/api-endpoints';
import type {
  TwoFactorDisableRequest,
  TwoFactorEnableRequest,
  TwoFactorEnableResult,
  TwoFactorRecoveryCodesRequest,
  TwoFactorSetup,
  TwoFactorStatus,
  WireTwoFactorEnableResponse,
  WireTwoFactorSetupResponse,
  WireTwoFactorStatusResponse,
} from '../models/two-factor';
import { twoFactorStatusFromWire } from '../models/two-factor';
import { ApiService } from './api.service';

/**
 * Enrolling in and leaving two-factor authentication (§17).
 *
 * The status is held here rather than re-fetched per screen: the account page
 * shows it, the console's gate reacts to it, and a second copy could say
 * "enabled" on one screen while the other still offered enrolment.
 *
 * Verifying a code *at login* is not here — that is `AuthService`, because it
 * mints a session. This service only ever runs against an account that is
 * already signed in.
 */
@Injectable({ providedIn: 'root' })
export class TwoFactorService {
  private readonly api = inject(ApiService);

  private readonly current = signal<TwoFactorStatus | null>(null);

  /** `null` until it has been read once — not "off". */
  readonly status = this.current.asReadonly();

  load(): Observable<TwoFactorStatus> {
    return this.api.get<WireTwoFactorStatusResponse>(API_ENDPOINTS.me.twoFactor).pipe(
      map((response) => twoFactorStatusFromWire(response.twoFactor)),
      tap((status) => this.current.set(status)),
    );
  }

  /**
   * Issues a provisional secret. **Enables nothing.**
   *
   * Calling it again replaces the secret, so a user who abandoned enrolment
   * half way is not stuck with one their app never received. That also means a
   * secret already added to an authenticator stops working the moment this is
   * called a second time — so the screen asks before re-running it.
   */
  setup(): Observable<TwoFactorSetup> {
    return this.api
      .post<WireTwoFactorSetupResponse>(API_ENDPOINTS.me.twoFactorSetup)
      .pipe(map((response) => response.setup));
  }

  /**
   * Turns it on, by proving the secret was stored.
   *
   * The recovery codes come back **once** and are stored hashed, so a screen
   * that does not put them in front of the user here has lost that set. It is
   * recoverable now — `regenerateRecoveryCodes` replaces the lot — but only
   * for somebody who is still signed in with their authenticator to hand.
   */
  enable(request: TwoFactorEnableRequest): Observable<TwoFactorEnableResult> {
    return this.api
      .post<WireTwoFactorEnableResponse, TwoFactorEnableRequest>(
        API_ENDPOINTS.me.twoFactorEnable,
        request,
      )
      .pipe(
        map((response) => this.enableResult(response, { enabled: true })),
        tap((result) => this.current.set(result.status)),
      );
  }

  /**
   * A fresh set of ten, retiring every old one.
   *
   * This is the way out of "nine of my ten are spent", and it is the only one:
   * the count never goes up on its own. Takes the password **and** a current
   * TOTP code — the same proof as switching the feature off, because handing
   * over ten new keys to an account is the same size of act.
   */
  regenerateRecoveryCodes(
    request: TwoFactorRecoveryCodesRequest,
  ): Observable<TwoFactorEnableResult> {
    return this.api
      .post<WireTwoFactorEnableResponse, TwoFactorRecoveryCodesRequest>(
        API_ENDPOINTS.me.twoFactorRecoveryCodes,
        request,
      )
      .pipe(
        map((response) => this.enableResult(response, { enabled: true })),
        tap((result) => this.current.set(result.status)),
      );
  }

  /**
   * Both responses have the same shape, and both may omit the status block.
   *
   * The fallback keeps whatever is already known rather than inventing a
   * cleared one: a response that carried codes but no status must not reset
   * `recoveryCodesRemaining` to zero on the screen that is about to print ten
   * of them.
   */
  private enableResult(
    response: WireTwoFactorEnableResponse,
    fallback: Partial<TwoFactorStatus>,
  ): TwoFactorEnableResult {
    const known = this.current();

    return {
      status: response.twoFactor
        ? twoFactorStatusFromWire(response.twoFactor)
        : {
            enabled: known?.enabled ?? false,
            enabledAt: known?.enabledAt ?? null,
            setupPending: false,
            recoveryCodesRemaining:
              response.recoveryCodes?.length ?? known?.recoveryCodesRemaining ?? 0,
            required: known?.required ?? false,
            ...fallback,
          },
      // Null rather than `[]`: "the response carried no codes" is not the
      // same claim as "this account has none", and only one of them is a
      // sentence to put on a screen.
      recoveryCodes: response.recoveryCodes ?? null,
      shownOnce: response.recoveryCodesShownOnce ?? true,
    };
  }

  /**
   * Turns it off. Needs **the password and a code together** — either alone is
   * exactly the case two-factor exists to survive.
   */
  disable(request: TwoFactorDisableRequest): Observable<TwoFactorStatus> {
    return this.api
      .post<WireTwoFactorStatusResponse, TwoFactorDisableRequest>(
        API_ENDPOINTS.me.twoFactorDisable,
        request,
      )
      .pipe(
        map((response) => twoFactorStatusFromWire(response.twoFactor)),
        tap((status) => this.current.set(status)),
      );
  }
}
