import type { Signal } from '@angular/core';
import { isSignal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import type { AbstractControl } from '@angular/forms';
import { EMPTY, switchMap } from 'rxjs';

/**
 * A signal that changes whenever a control does.
 *
 * Reactive forms are not signals. `form.valid`, `control.value`,
 * `control.touched` and `control.errors` are plain properties, so a
 * `computed()` that reads one of them evaluates **once** — while the form is
 * still empty and invalid — and caches that answer for the life of the
 * component. Nothing ever invalidates it, because nothing it depends on is a
 * signal.
 *
 * The failure is quiet and specific: it only shows when the property changes
 * *after* the first read, and it disappears if some other signal in the same
 * `computed()` happens to change afterwards. A "continue" button that stays
 * grey after the form is filled in, but works if you tick the checkbox last,
 * is this bug. So is a field that never shows its error message.
 *
 * Call this once and read it from the `computed()`:
 *
 * ```ts
 * private readonly changes = controlChanges(this.form);
 *
 * protected readonly canContinue = computed(() => {
 *   this.changes();
 *   return this.form.valid && this.acknowledged();
 * });
 * ```
 *
 * `events` rather than `valueChanges` or `statusChanges` on purpose: it is the
 * only stream that covers value, status **and** touched, and "touched" is what
 * decides whether an error is allowed to appear.
 *
 * Accepts a signal of a control as well as a control, because a component that
 * takes its control as an `input()` gets a new one when the input changes and
 * must resubscribe. Must be called in an injection context — a field
 * initializer or a constructor.
 */
export function controlChanges(
  source: AbstractControl | Signal<AbstractControl | null | undefined>,
): Signal<unknown> {
  if (!isSignal(source)) {
    return toSignal(source.events, { initialValue: null });
  }

  return toSignal(toObservable(source).pipe(switchMap((control) => control?.events ?? EMPTY)), {
    initialValue: null,
  });
}
