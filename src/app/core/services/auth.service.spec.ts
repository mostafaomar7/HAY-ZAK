import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AccountStatus, UserRole } from '../enums/user-role.enum';
import type { User } from '../models/user.model';
import { AuthService } from './auth.service';

function user(roles: UserRole[]): User {
  return {
    id: 'u-1',
    fullName: 'فهد الدوسري',
    mobile: '0552104478',
    email: 'f@example.com',
    roles,
    status: AccountStatus.Active,
    createdAt: '2026-08-01T09:00:00Z',
  };
}

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
    auth.setSession({ accessToken: 't', user: user([UserRole.Lessor]) });

    expect(auth.landingUrl()).toBe('/lessor');
  });

  it('sends a renter to the storefront', () => {
    auth.setSession({ accessToken: 't', user: user([UserRole.Renter]) });

    expect(auth.landingUrl()).toBe('/');
  });

  it('sends an account with no known role to the storefront', () => {
    // Never the lessor portal by default: a renter landing there is a broken
    // journey, while a lessor landing on the storefront is merely one click out.
    auth.setSession({ accessToken: 't', user: user([]) });

    expect(auth.landingUrl()).toBe('/');
  });

  it('prefers the route a guard recorded', () => {
    auth.setSession({ accessToken: 't', user: user([UserRole.Lessor]) });

    expect(auth.landingUrl('/booking/new/m-1?start=2026-08-12')).toBe(
      '/booking/new/m-1?start=2026-08-12',
    );
  });

  it('ignores an empty return url rather than navigating nowhere', () => {
    auth.setSession({ accessToken: 't', user: user([UserRole.Renter]) });

    expect(auth.landingUrl('')).toBe('/');
    expect(auth.landingUrl(null)).toBe('/');
  });
});
