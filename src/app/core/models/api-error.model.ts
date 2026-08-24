import type { FieldError } from './api-response.model';

/**
 * The one error type the application throws for a failed request.
 *
 * Two fields matter and they are not interchangeable:
 *
 * - `code` is a stable machine identifier. **Branch on this.**
 * - `message` is already translated by the server. **Display it as-is.**
 *
 * Never write Arabic error copy in the client and never branch on message text:
 * the server owns the wording, changes it without telling us, and serves it in
 * whichever language the request asked for.
 */
export class ApiError extends Error {
  /** Stable machine identifier, e.g. `BOOKING_DATES_UNAVAILABLE`. */
  readonly code: string;
  /** HTTP status. 0 means the request never reached the server. */
  readonly status: number;
  /** Per-field messages on a 422, ready to map onto form controls. */
  readonly details: readonly FieldError[];
  /** Shown small in the generic error UI; support finds the request by it. */
  readonly requestId?: string;
  /** Seconds until a rate-limited action may be tried again (429 only). */
  readonly retryAfterSeconds?: number;

  constructor(init: {
    code: string;
    message: string;
    status: number;
    details?: readonly FieldError[];
    requestId?: string;
    retryAfterSeconds?: number;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.code = init.code;
    this.status = init.status;
    this.details = init.details ?? [];
    this.requestId = init.requestId;
    this.retryAfterSeconds = init.retryAfterSeconds;
  }

  /** True when the server sent per-field messages worth mapping onto a form. */
  get hasFieldErrors(): boolean {
    return this.details.length > 0;
  }

  /** The message for one control, if the server flagged it. */
  fieldError(field: string): string | undefined {
    return this.details.find((detail) => detail.field === field)?.message;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

/**
 * The codes this client actually branches on.
 *
 * Deliberately not an exhaustive list of everything the server can send — an
 * unknown code is handled by showing `error.message`, which is the whole point
 * of the server owning the wording. Add an entry only when a screen needs to
 * *do* something specific, and say what it does.
 */
export const ERROR_CODES = {
  /** The transport failed; nothing reached the server. Client-side only. */
  NETWORK: 'NETWORK_UNAVAILABLE',
  /** The server answered, but not in the agreed envelope. Client-side only. */
  MALFORMED: 'MALFORMED_RESPONSE',

  /** 422 — `details[]` carries the per-field messages. */
  VALIDATION: 'VALIDATION_ERROR',
  /** 401 — the access token is expired or absent; the client refreshes. */
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  /** 401 on refresh — the session is gone for good; sign in again. */
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  /** 403 — signed in, but not allowed. */
  FORBIDDEN: 'FORBIDDEN',
  /** 429 — the action is disabled until `retryAfterSeconds` elapses. */
  RATE_LIMITED: 'RATE_LIMITED',

  /** The dates were taken between opening the form and submitting it. */
  BOOKING_DATES_UNAVAILABLE: 'BOOKING_DATES_UNAVAILABLE',
  /** The 15-minute payment hold lapsed; the dates are released. */
  BOOKING_HOLD_EXPIRED: 'BOOKING_HOLD_EXPIRED',
  /** The OTP was wrong once too often; the code has to be resent. */
  OTP_ATTEMPTS_EXCEEDED: 'OTP_ATTEMPTS_EXCEEDED',
  /** The OTP's five minutes are up. */
  OTP_EXPIRED: 'OTP_EXPIRED',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
