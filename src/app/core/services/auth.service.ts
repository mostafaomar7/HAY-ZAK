import { HttpContext } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Observable } from 'rxjs';
import { map, tap } from 'rxjs';
import { API_ENDPOINTS } from '../constants/api-endpoints';
import type { TwoFactorChallenge, TwoFactorVerifyRequest } from '../models/two-factor';
import { isTwoFactorChallenge } from '../models/two-factor';
import { SKIP_AUTH } from '../interceptors/auth.interceptor';
import { STORAGE_KEYS } from '../constants/storage-keys';
import { UserRole, isAdminRole } from '../enums/user-role.enum';
import type {
  AuthResult,
  LoginRequest,
  OtpChallenge,
  OtpPurpose,
  PasswordResetResult,
  RegisterRequest,
  RegisterResult,
  SignupTerms,
  User,
} from '../models/user.model';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';

/**
 * Owns the session: token storage, the current user signal, and the role
 * checks the guards read. Wire the endpoints to the real backend once it exists.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly storage = inject(StorageService);
  private readonly router = inject(Router);

  private readonly currentUser = signal<User | null>(this.storage.get<User>(STORAGE_KEYS.user));

  readonly user = this.currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUser() !== null && !!this.token);
  /** One role per account. Guest when nobody is signed in. */
  readonly role = computed(() => this.currentUser()?.role ?? UserRole.Guest);
  /**
   * Which kind of administrator, for the console's header and the user list.
   * Null for everybody else — and never a permission check.
   */
  readonly adminRole = computed(() => this.currentUser()?.adminRole ?? null);

  get token(): string | null {
    return this.storage.get<string>(STORAGE_KEYS.accessToken);
  }

  get refreshToken(): string | null {
    return this.storage.get<string>(STORAGE_KEYS.refreshToken);
  }

  /**
   * The legal version the registration must record consent against.
   *
   * Fetched rather than hard-coded, and its `id` goes back with the form: the
   * server records consent against that exact version and refuses a stale one
   * with `TERMS_ACCEPTANCE_REQUIRED`. Public - no token.
   */
  terms(): Observable<SignupTerms> {
    return this.api.get<SignupTerms>(API_ENDPOINTS.auth.terms, {
      context: new HttpContext().set(SKIP_AUTH, true),
    });
  }

  /**
   * Signs in, **or** stops one step short.
   *
   * An account with two-factor authentication on answers
   * `{ twoFactorRequired: true, challengeToken }` and no tokens at all, so the
   * return type is the union and every caller has to say which one it got.
   * `isTwoFactorChallenge` is the test — not "did `tokens` come back", which
   * reads `undefined` on the challenge and signs nobody in without failing.
   *
   * Nothing is stored for a challenge: the token it carries opens nothing, and
   * putting it where an access token lives would have the interceptor sending
   * it as a bearer on every request until the API refused them all.
   */
  login(credentials: LoginRequest): Observable<AuthResult | TwoFactorChallenge> {
    return this.api
      .post<AuthResult | TwoFactorChallenge, LoginRequest>(API_ENDPOINTS.auth.login, credentials)
      .pipe(tap((result) => this.setSessionUnlessChallenged(result)));
  }

  /**
   * The second step. Answers with the session the login withheld.
   *
   * A code is accepted **once**: a failed request must wait for the next
   * thirty-second window rather than re-sending the same digits, which the
   * server refuses as a replay even while they are still valid.
   */
  verifyTwoFactor(request: TwoFactorVerifyRequest): Observable<AuthResult> {
    return this.api
      .post<AuthResult, TwoFactorVerifyRequest>(API_ENDPOINTS.auth.twoFactorVerify, request, {
        context: new HttpContext().set(SKIP_AUTH, true),
      })
      .pipe(tap((result) => this.setSession(result)));
  }

  private setSessionUnlessChallenged(result: AuthResult | TwoFactorChallenge): void {
    if (!isTwoFactorChallenge(result)) this.setSession(result);
  }

  /**
   * Creates the account. Returns **no tokens** - the user is
   * PENDING_VERIFICATION until the OTP is verified, and nothing is stored here.
   */
  register(payload: RegisterRequest): Observable<RegisterResult> {
    return this.api.post<RegisterResult, RegisterRequest>(API_ENDPOINTS.auth.register, payload);
  }

  /**
   * The only endpoint that mints the first pair of tokens.
   *
   * The code is a string throughout: it is six digits and may start with a
   * zero, which a number would silently eat.
   */
  verifyMobile(mobile: string, code: string): Observable<AuthResult> {
    return this.api
      .post<AuthResult, { mobile: string; code: string }>(API_ENDPOINTS.auth.verifyMobile, {
        mobile,
        code,
      })
      .pipe(tap((result) => this.setSession(result)));
  }

  /**
   * Sends a fresh code. Sixty-second cooldown, enforced server-side and counted
   * down on screen; asking early is OTP_RESEND_TOO_SOON.
   *
   * Always answers 200, even for a number nobody registered - so nothing on
   * screen may infer from it whether an account exists.
   */
  resendOtp(mobile: string, purpose: OtpPurpose = 'REGISTRATION'): Observable<OtpChallenge> {
    return this.api.post<OtpChallenge, { mobile: string; purpose: OtpPurpose }>(
      API_ENDPOINTS.auth.resendOtp,
      { mobile, purpose },
      { context: new HttpContext().set(SKIP_AUTH, true) },
    );
  }

  /** Always 200, identical for an unknown number - say "if it is registered...". */
  forgotPassword(mobile: string): Observable<OtpChallenge> {
    return this.api.post<OtpChallenge, { mobile: string }>(
      API_ENDPOINTS.auth.forgotPassword,
      { mobile },
      { context: new HttpContext().set(SKIP_AUTH, true) },
    );
  }

  /**
   * Sets the new password. Returns no tokens: every session on the account is
   * revoked, including this device, so the user signs in again.
   */
  resetPassword(mobile: string, code: string, password: string): Observable<PasswordResetResult> {
    return this.api
      .post<PasswordResetResult, { mobile: string; code: string; password: string }>(
        API_ENDPOINTS.auth.resetPassword,
        { mobile, code, password },
        { context: new HttpContext().set(SKIP_AUTH, true) },
      )
      .pipe(tap(() => this.clearSession()));
  }

  /**
   * Trades the refresh token for a new pair.
   *
   * Sent without the Authorization header: the access token is expired — that
   * is why we are here — and the refresh token is the only credential this
   * endpoint accepts. It is also the only endpoint the refresh token is ever
   * sent to.
   *
   * The new pair is stored the moment it arrives. The token just spent is dead
   * on the server, so a crash between the response and the write would leave
   * the session holding a credential that can never be used again.
   *
   * `authInterceptor` owns the queue that keeps one of these in flight at a
   * time — see the note there on why two would end the session.
   */
  refresh(): Observable<AuthResult> {
    return this.api
      .post<AuthResult>(
        API_ENDPOINTS.auth.refresh,
        { refreshToken: this.refreshToken },
        { context: new HttpContext().set(SKIP_AUTH, true) },
      )
      .pipe(tap((result) => this.setSession(result)));
  }

  /** `GET /auth/me` answers `{ user }`, not a bare user. */
  loadProfile(): Observable<User> {
    return this.api.get<{ user: User }>(API_ENDPOINTS.auth.me).pipe(
      map((result) => result.user),
      tap((user) => this.setUser(user)),
    );
  }

  /**
   * The user asked to sign out.
   *
   * The server is told first, with the **refresh** token - that endpoint takes
   * no bearer, because by the time somebody signs out the access token is
   * usually expired. Storage is cleared either way: a signed-out user must not
   * stay signed in because the network was down.
   */
  logout(redirect = true): void {
    const refreshToken = this.refreshToken;

    if (refreshToken) {
      this.api
        .post<void, { refreshToken: string }>(
          API_ENDPOINTS.auth.logout,
          { refreshToken },
          { context: new HttpContext().set(SKIP_AUTH, true) },
        )
        .subscribe({ error: () => undefined });
    }

    this.clearSession();
    if (redirect) void this.router.navigate(['/auth/login']);
  }

  /** Ends every session on the account. Needs the bearer, unlike `logout`. */
  logoutEverywhere(): Observable<{ sessionsEnded: number }> {
    return this.api
      .post<{ sessionsEnded: number }>(API_ENDPOINTS.auth.logoutAll)
      .pipe(tap(() => this.clearSession()));
  }

  /**
   * The session ended without the user asking — a refresh the server refused.
   *
   * Same clearing, different reason, and a separate method so the call site
   * reads as what happened. `returnUrl` is recorded so the interrupted screen
   * is where they land after signing in again.
   */
  endSession(): void {
    const returnUrl = this.router.url;
    this.clearSession();

    void this.router.navigate(['/auth/login'], {
      queryParams: returnUrl.startsWith('/auth') ? {} : { returnUrl },
    });
  }

  /** FR-AUTH-04 — several journeys are gated on a verified mobile number. */
  readonly isMobileVerified = computed(() => !!this.currentUser()?.mobileVerifiedAt);

  /**
   * Where to send someone once they are authenticated.
   *
   * One definition, because three screens need it — login, OTP verification and
   * the guards' redirect target — and a renter who verified their mobile must
   * not be dropped into the lessor portal. `returnUrl` wins when the guard
   * recorded one, so a booking interrupted by sign-up resumes at its own step.
   */
  landingUrl(returnUrl?: string | null): string {
    if (returnUrl) return returnUrl;
    // The console outranks the portal: an administration account belongs at
    // /admin whatever else is true of it.
    // An unverified mobile outranks the portal: every transactional endpoint
    // refuses the account until it is verified, so a dashboard whose every
    // button fails is a worse landing than the one screen that fixes it.
    if (!this.isMobileVerified()) return '/auth/verify';

    if (isAdminRole(this.role())) return '/admin';
    // A lessor account belongs in the portal; everyone else belongs on the
    // storefront, which is also the right home for a role we do not know.
    return this.hasRole(UserRole.Lessor) ? '/lessor' : '/';
  }

  hasRole(role: UserRole): boolean {
    return this.role() === role;
  }

  hasAnyRole(roles: UserRole[]): boolean {
    return roles.includes(this.role());
  }

  setSession(result: AuthResult): void {
    this.storage.set(STORAGE_KEYS.accessToken, result.tokens.accessToken);
    // Written the moment it arrives: the token just spent is already dead on
    // the server, so a crash between here and the next line would leave the
    // session holding a credential that can never be used again.
    this.storage.set(STORAGE_KEYS.refreshToken, result.tokens.refreshToken);
    this.setUser(result.user);
  }

  clearSession(): void {
    this.storage.remove(STORAGE_KEYS.accessToken);
    this.storage.remove(STORAGE_KEYS.refreshToken);
    this.storage.remove(STORAGE_KEYS.user);
    this.currentUser.set(null);
  }

  /**
   * Replaces the stored user.
   *
   * Public because `/me` can change it — a saved profile has to reach the
   * topbar and the guards, and a session holding a stale name is a session
   * showing the wrong person.
   */
  setUser(user: User): void {
    this.storage.set(STORAGE_KEYS.user, user);
    this.currentUser.set(user);
  }
}
