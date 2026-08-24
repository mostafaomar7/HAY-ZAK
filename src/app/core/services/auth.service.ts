import { HttpContext } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs';
import { API_ENDPOINTS } from '../constants/api-endpoints';
import { SKIP_AUTH } from '../interceptors/auth.interceptor';
import { STORAGE_KEYS } from '../constants/storage-keys';
import { ADMIN_ROLES, UserRole } from '../enums/user-role.enum';
import type {
  AuthResult,
  LoginRequest,
  OtpRequest,
  OtpVerifyRequest,
  RegisterRequest,
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
  readonly roles = computed(() => this.currentUser()?.roles ?? []);

  get token(): string | null {
    return this.storage.get<string>(STORAGE_KEYS.accessToken);
  }

  get refreshToken(): string | null {
    return this.storage.get<string>(STORAGE_KEYS.refreshToken);
  }

  login(credentials: LoginRequest): Observable<AuthResult> {
    return this.api
      .post<AuthResult, LoginRequest>(API_ENDPOINTS.auth.login, credentials)
      .pipe(tap((result) => this.setSession(result)));
  }

  register(payload: RegisterRequest): Observable<AuthResult> {
    return this.api
      .post<AuthResult, RegisterRequest>(API_ENDPOINTS.auth.register, payload)
      .pipe(tap((result) => this.setSession(result)));
  }

  /** FR-AUTH-04 — the account stays inactive until the OTP is verified. */
  requestOtp(mobile: string): Observable<void> {
    return this.api.post<void, OtpRequest>(API_ENDPOINTS.auth.requestOtp, { mobile });
  }

  verifyOtp(payload: OtpVerifyRequest): Observable<AuthResult> {
    return this.api
      .post<AuthResult, OtpVerifyRequest>(API_ENDPOINTS.auth.verifyOtp, payload)
      .pipe(tap((result) => this.setSession(result)));
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

  loadProfile(): Observable<User> {
    return this.api.get<User>(API_ENDPOINTS.auth.me).pipe(tap((user) => this.setUser(user)));
  }

  /** The user asked to sign out. */
  logout(redirect = true): void {
    this.clearSession();
    if (redirect) void this.router.navigate(['/auth/login']);
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
    // Most privileged first: an operations account that also happens to be a
    // lessor belongs at the console, not the portal.
    if (this.roles().some((role) => ADMIN_ROLES.includes(role))) return '/admin';
    // A lessor account belongs in the portal; everyone else belongs on the
    // storefront, which is also the right home for a role we do not know.
    return this.hasRole(UserRole.Lessor) ? '/lessor' : '/';
  }

  hasRole(role: UserRole): boolean {
    return this.roles().includes(role);
  }

  hasAnyRole(roles: UserRole[]): boolean {
    return roles.some((role) => this.hasRole(role));
  }

  setSession(result: AuthResult): void {
    this.storage.set(STORAGE_KEYS.accessToken, result.accessToken);
    if (result.refreshToken) {
      this.storage.set(STORAGE_KEYS.refreshToken, result.refreshToken);
    }
    this.setUser(result.user);
  }

  clearSession(): void {
    this.storage.remove(STORAGE_KEYS.accessToken);
    this.storage.remove(STORAGE_KEYS.refreshToken);
    this.storage.remove(STORAGE_KEYS.user);
    this.currentUser.set(null);
  }

  private setUser(user: User): void {
    this.storage.set(STORAGE_KEYS.user, user);
    this.currentUser.set(user);
  }
}
