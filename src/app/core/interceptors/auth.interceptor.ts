import type { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { HttpContextToken } from '@angular/common/http';
import { inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { throwError } from 'rxjs';
import { catchError, finalize, map, shareReplay, switchMap } from 'rxjs/operators';
import { API_ENDPOINTS } from '../constants/api-endpoints';
import { HttpStatus } from '../enums/http-status.enum';
import { AuthService } from '../services/auth.service';

/** Set on a request to send it without the Authorization header. */
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

/**
 * One refresh at a time, shared by everyone waiting on it.
 *
 * Module-level rather than injected because the queue has to be one queue for
 * the whole application, and a functional interceptor is invoked afresh per
 * request. Refresh tokens rotate: each call invalidates the one it was given,
 * and presenting an already-used token is treated by the server as theft and
 * revokes the entire session. So two parallel refreshes do not merely waste a
 * request — the second one logs the user out.
 */
let inFlightRefresh: Observable<string> | null = null;

/**
 * Attaches the access token, and replays a request once through a refresh if
 * the token had expired underneath it.
 *
 * It sits closer to the network than `errorInterceptor` on purpose: a 401 that
 * a refresh rescues should never reach the error mapper, and never raise a
 * toast the user has no reason to see.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  if (req.context.get(SKIP_AUTH)) return next(req);

  const token = auth.token;
  const sent = token ? withToken(req, token) : req;

  return next(sent).pipe(
    catchError((response: HttpErrorResponse) => {
      const recoverable =
        response.status === HttpStatus.Unauthorized && !!auth.refreshToken && !isRefreshCall(req);

      if (!recoverable) return throwError(() => response);

      return refreshOnce(auth).pipe(switchMap((fresh) => next(withToken(req, fresh))));
    }),
  );
};

function withToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

/** The refresh endpoint answering 401 means the session is gone, not stale. */
function isRefreshCall(req: HttpRequest<unknown>): boolean {
  return req.url.includes(API_ENDPOINTS.auth.refresh);
}

/**
 * The single in-flight refresh. Everyone who arrives while it is running gets
 * the same observable and the same new token; the next 401 after it settles
 * starts a fresh one.
 *
 * A failed refresh ends the session then and there — cleared storage and back
 * to sign-in, with no retry loop. Retrying a rotated token is exactly the theft
 * signal the server revokes sessions for.
 */
function refreshOnce(auth: AuthService): Observable<string> {
  inFlightRefresh ??= auth.refresh().pipe(
    map((result) => result.accessToken),
    catchError((error: unknown) => {
      auth.endSession();
      return throwError(() => error);
    }),
    finalize(() => {
      inFlightRefresh = null;
    }),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  return inFlightRefresh;
}
