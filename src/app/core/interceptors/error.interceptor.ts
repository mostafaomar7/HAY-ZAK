import type { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { HttpContextToken } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { HttpStatus } from '../enums/http-status.enum';
import { LanguageService } from '../i18n/language.service';
import { ApiError, ERROR_CODES } from '../models/api-error.model';
import type { ApiFailure } from '../models/api-response.model';
import { LoggerService } from '../services/logger.service';
import { NotificationService } from '../services/notification.service';

/** Set on a request to suppress the automatic error toast. */
export const SKIP_ERROR_TOAST = new HttpContextToken<boolean>(() => false);

/**
 * Turns every failure into an `ApiError` and shows one toast.
 *
 * The message on that toast is the server's, verbatim: it arrives already
 * translated into the language the request asked for, and rewriting it here
 * would mean maintaining a second, worse copy of wording the server owns.
 *
 * The only two strings this file supplies are for the cases where the server
 * said nothing at all — the request never left, or the answer was not in the
 * agreed envelope (a proxy's HTML error page, a gateway timeout). There is
 * nothing to display in those cases but our own.
 *
 * 401 is deliberately *not* handled here: `authInterceptor` sits closer to the
 * network, refreshes the token and replays the request, so a 401 that reaches
 * this point is one refresh could not rescue.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notifications = inject(NotificationService);
  const logger = inject(LoggerService);
  const i18n = inject(LanguageService);

  return next(req).pipe(
    catchError((response: HttpErrorResponse) => {
      const failure = response.error as Partial<ApiFailure> | null;
      const served = failure?.error;

      const error = new ApiError({
        code: served?.code ?? fallbackCode(response.status),
        message:
          served?.message ?? i18n.t(response.status === 0 ? 'error.network' : 'error.unexpected'),
        status: response.status,
        details: served?.details,
        requestId: failure?.requestId,
        retryAfterSeconds: retryAfter(response),
      });

      logger.error(`${req.method} ${req.url} → ${error.status} ${error.code}`, response.error);

      if (!req.context.get(SKIP_ERROR_TOAST)) {
        notifications.error(error.message);
      }

      return throwError(() => error);
    }),
  );
};

/**
 * A code for a response that carried none. Client-side identifiers, so a screen
 * branching on them is branching on something this file guarantees.
 */
function fallbackCode(status: number): string {
  if (status === 0) return ERROR_CODES.NETWORK;
  if (status === HttpStatus.Unauthorized) return ERROR_CODES.UNAUTHENTICATED;
  if (status === HttpStatus.Forbidden) return ERROR_CODES.FORBIDDEN;
  if (status === HttpStatus.UnprocessableEntity) return ERROR_CODES.VALIDATION;
  if (status === HttpStatus.TooManyRequests) return ERROR_CODES.RATE_LIMITED;
  return ERROR_CODES.MALFORMED;
}

/**
 * How long a rate-limited action stays disabled.
 *
 * `RateLimit-Reset` is the agreed header; `Retry-After` is read as well because
 * proxies and gateways in front of the API send that one. Both are seconds.
 */
function retryAfter(response: HttpErrorResponse): number | undefined {
  if (response.status !== HttpStatus.TooManyRequests) return undefined;

  const raw =
    response.headers?.get('RateLimit-Reset') ??
    response.headers?.get('ratelimit-reset') ??
    response.headers?.get('Retry-After');

  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : undefined;
}
