import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { signal } from '@angular/core';
import { API_ENDPOINTS } from '../constants/api-endpoints';
import type {
  TwoFactorDisableRequest,
  TwoFactorEnableRequest,
  TwoFactorEnableResult,
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
   * The recovery codes come back **once**. There is no endpoint that re-issues
   * them, so a screen that does not put them in front of the user here has
   * lost them for that account permanently.
   */
  enable(request: TwoFactorEnableRequest): Observable<TwoFactorEnableResult> {
    return this.api
      .post<WireTwoFactorEnableResponse, TwoFactorEnableRequest>(
        API_ENDPOINTS.me.twoFactorEnable,
        request,
      )
      .pipe(
        map((response) => ({
          status: response.twoFactor
            ? twoFactorStatusFromWire(response.twoFactor)
            : {
                enabled: true,
                enabledAt: null,
                setupPending: false,
                recoveryCodesRemaining: 0,
                required: false,
              },
          // Null rather than `[]`: "the response carried no codes" is not the
          // same claim as "this account has none", and only one of them is a
          // sentence to put on a screen.
          recoveryCodes: response.recoveryCodes ?? null,
        })),
        tap((result) => this.current.set(result.status)),
      );
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
