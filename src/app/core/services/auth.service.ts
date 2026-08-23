import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs';
import { API_ENDPOINTS } from '../constants/api-endpoints';
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

  refresh(): Observable<AuthResult> {
    return this.api
      .post<AuthResult>(API_ENDPOINTS.auth.refresh, { refreshToken: this.refreshToken })
      .pipe(tap((result) => this.setSession(result)));
  }

  loadProfile(): Observable<User> {
    return this.api.get<User>(API_ENDPOINTS.auth.me).pipe(tap((user) => this.setUser(user)));
  }

  logout(redirect = true): void {
    this.clearSession();
    if (redirect) void this.router.navigate(['/auth/login']);
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
