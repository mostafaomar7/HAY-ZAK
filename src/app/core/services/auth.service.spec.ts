import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AccountStatus, UserRole } from '../enums/user-role.enum';
import type { User } from '../models/user.model';
import { AuthService } from './auth.service';

function user(role: UserRole, mobileVerifiedAt: string | null = '2026-08-01T09:00:00Z'): User {
  return {
    id: 'u-1',
    fullName: 'فهد الدوسري',
    mobile: '0552104478',
    email: 'f@example.com',
    role,
    status: AccountStatus.Active,
    mobileVerifiedAt,
    createdAt: '2026-08-01T09:00:00Z',
  };
}

const TOKENS = {
  accessToken: 't',
  refreshToken: 'r',
  expiresIn: 1800,
  tokenType: 'Bearer',
} as const;

/**
 * `landingUrl` decides where every authenticated journey resumes — login, OTP
 * verification and the guest guard all read it. It is one function precisely so
 * a renter cannot be dropped into the lessor portal by one of the three.
 */
describe('AuthService.landingUrl', () => {
  let auth: AuthService;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => localStorage.clear());

  it('sends a lessor to their portal', () => {
    auth.setSession({ user: user(UserRole.Lessor), tokens: TOKENS });

    expect(auth.landingUrl()).toBe('/lessor');
  });

  it('sends a renter to the storefront', () => {
    auth.setSession({ user: user(UserRole.Renter), tokens: TOKENS });

    expect(auth.landingUrl()).toBe('/');
  });

  /**
   * An unverified mobile outranks the portal: every transactional endpoint
   * refuses the account until it is verified, so the one screen that fixes it
   * is a better landing than a dashboard whose every button fails.
   */
  it('sends an unverified account to the OTP screen, whatever its role', () => {
    auth.setSession({ user: user(UserRole.Lessor, null), tokens: TOKENS });

    expect(auth.landingUrl()).toBe('/auth/verify');
  });

  it('sends an account with no known role to the storefront', () => {
    // Never the lessor portal by default: a renter landing there is a broken
    // journey, while a lessor landing on the storefront is merely one click out.
    auth.setSession({ user: user(UserRole.Guest), tokens: TOKENS });

    expect(auth.landingUrl()).toBe('/');
  });

  it('prefers the route a guard recorded', () => {
    auth.setSession({ user: user(UserRole.Lessor), tokens: TOKENS });

    expect(auth.landingUrl('/booking/new/m-1?start=2026-08-12')).toBe(
      '/booking/new/m-1?start=2026-08-12',
    );
  });

  it('ignores an empty return url rather than navigating nowhere', () => {
    auth.setSession({ user: user(UserRole.Renter), tokens: TOKENS });

    expect(auth.landingUrl('')).toBe('/');
    expect(auth.landingUrl(null)).toBe('/');
  });
});
