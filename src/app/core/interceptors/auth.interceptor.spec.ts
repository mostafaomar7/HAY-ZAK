import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import type { HttpTestingController } from '@angular/common/http/testing';
import {
  provideHttpClientTesting,
  HttpTestingController as Ctrl,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../constants/api-endpoints';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

/**
 * The refresh queue, which is the one piece of this layer that can lose a
 * user's session if it is wrong.
 *
 * Refresh tokens rotate: each call invalidates the token it was given, and the
 * server treats a second presentation of a spent token as theft and revokes
 * everything. So two requests that expire together must produce **one** refresh
 * between them, not two.
 */
describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let auth: AuthService;

  const url = (path: string) => `${environment.apiUrl}${path}`;
  const refreshUrl = url(API_ENDPOINTS.auth.refresh);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(Ctrl);
    auth = TestBed.inject(AuthService);

    localStorage.clear();
    auth.setSession({
      user: { id: 'u-1', fullName: 'x', mobile: '0500000000' } as never,
      tokens: {
        accessToken: 'stale-access',
        refreshToken: 'refresh-1',
        expiresIn: 1800,
        tokenType: 'Bearer',
      },
    });
  });

  afterEach(() => {
    controller.verify();
    localStorage.clear();
  });

  it('sends the access token', () => {
    http.get(url('/units')).subscribe({ error: () => undefined });

    const request = controller.expectOne(url('/units'));
    expect(request.request.headers.get('Authorization')).toBe('Bearer stale-access');
    request.flush(null);
  });

  it('refreshes once for two requests that expire together, and replays both', () => {
    const seen: string[] = [];
    http.get(url('/a')).subscribe({ next: () => seen.push('a'), error: () => undefined });
    http.get(url('/b')).subscribe({ next: () => seen.push('b'), error: () => undefined });

    for (const path of ['/a', '/b']) {
      controller.expectOne(url(path)).flush(null, { status: 401, statusText: 'Unauthorized' });
    }

    // One refresh, not two: the second request waited on the first.
    const refresh = controller.expectOne(refreshUrl);
    expect(refresh.request.body).toEqual({ refreshToken: 'refresh-1' });
    // It goes without the dead access token — the refresh token is the only
    // credential this endpoint takes.
    expect(refresh.request.headers.has('Authorization')).toBeFalse();

    refresh.flush({
      success: true,
      data: {
        user: auth.user(),
        tokens: {
          accessToken: 'fresh-access',
          refreshToken: 'refresh-2',
          expiresIn: 1800,
          tokenType: 'Bearer',
        },
      },
    });

    // Both original requests are replayed, now carrying the new token.
    for (const path of ['/a', '/b']) {
      const replay = controller.expectOne(url(path));
      expect(replay.request.headers.get('Authorization')).toBe('Bearer fresh-access');
      replay.flush(null);
    }

    expect(seen.sort()).toEqual(['a', 'b']);
    // The rotated token is stored the moment it arrives; the old one is dead.
    expect(auth.refreshToken).toBe('refresh-2');
  });

  it('ends the session when the refresh itself is refused, and does not retry', () => {
    http.get(url('/a')).subscribe({ error: () => undefined });
    controller.expectOne(url('/a')).flush(null, { status: 401, statusText: 'Unauthorized' });

    controller.expectOne(refreshUrl).flush(null, { status: 401, statusText: 'Unauthorized' });

    // No second refresh, no replay: presenting a spent token again is the
    // theft signal the server revokes sessions for.
    expect(auth.isAuthenticated()).toBeFalse();
    expect(auth.token).toBeNull();
  });

  it('leaves a 401 alone when there is no refresh token to spend', () => {
    auth.clearSession();
    http.get(url('/a')).subscribe({ error: () => undefined });

    controller.expectOne(url('/a')).flush(null, { status: 401, statusText: 'Unauthorized' });
    controller.expectNone(refreshUrl);
  });
});
