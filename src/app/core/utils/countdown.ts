import type { Signal } from '@angular/core';
import { computed } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of, timer } from 'rxjs';
import { map, switchMap, takeWhile } from 'rxjs/operators';
import { secondsUntil } from './date.utils';

/**
 * Seconds left until a deadline the *server* set, ticking once a second.
 *
 * Four screens count down and all four count down to something the server
 * owns: a rate-limit reset, an OTP's five minutes, the fifteen-minute hold on
 * a booking's dates, and an idle admin session. None of them may run a timer
 * the client started — a tab that slept, a clock that is wrong, or a page
 * opened two minutes after the hold began would each show time the booking
 * does not have, and the request would then fail against a deadline the user
 * was told they still had.
 *
 * The ticker only runs while there is something to count: no deadline, no
 * interval. It stops itself at zero rather than counting into negatives.
 *
 * Must be called in an injection context — the subscription is torn down with
 * the component that created it.
 */
export function countdown(deadline: Signal<string | null>): Signal<number> {
  return toSignal(
    toObservable(deadline).pipe(
      switchMap((at) =>
        at
          ? timer(0, 1000).pipe(
              map(() => secondsUntil(at)),
              takeWhile((seconds) => seconds > 0, true),
            )
          : of(0),
      ),
    ),
    { initialValue: 0 },
  );
}

/** A deadline that many seconds from now, for a server that sent a duration. */
export function deadlineIn(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

/** `2:05` — the shape a countdown is read in, whatever the language. */
export function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * The rate-limit lockout a 429 puts a form into.
 *
 * `ApiError.retryAfterSeconds` comes from the server's `RateLimit-Reset`. The
 * action stays disabled until it elapses and the client never retries on its
 * own: an automatic retry against a limiter is how one impatient user turns a
 * fifteen-minute lockout into an hour.
 */
export function lockoutSignal(remaining: Signal<number>): Signal<boolean> {
  return computed(() => remaining() > 0);
}
