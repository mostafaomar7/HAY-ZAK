import type { AbstractControl, FormGroup } from '@angular/forms';
import type { ApiError } from '../models/api-error.model';

/**
 * Puts a 422's per-field messages onto the controls they name.
 *
 * The server sends `details: [{ field, message }]` and the message is already
 * in the right language, so it goes on the control verbatim under the `server`
 * key — `ui-field` prints that ahead of any local validator text.
 *
 * A field the form does not have is not silently dropped: it comes back in the
 * return value so the caller can show it with the general message instead of
 * leaving the user with a refused form and nothing marked.
 */
export function applyFieldErrors(form: FormGroup, error: ApiError): string[] {
  const unmatched: string[] = [];

  for (const detail of error.details) {
    const control: AbstractControl | null = form.get(detail.field);
    if (!control) {
      unmatched.push(detail.message);
      continue;
    }

    control.setErrors({ ...(control.errors ?? {}), server: detail.message });
    control.markAsTouched();
  }

  return unmatched;
}

/**
 * Clears server-set errors before a resubmit.
 *
 * Without this a field the user has since corrected keeps the message from the
 * last attempt, and the form stays invalid for a reason that is no longer true.
 */
export function clearServerErrors(form: FormGroup): void {
  for (const control of Object.values(form.controls)) {
    if (!control.errors?.['server']) continue;

    const { server: _server, ...rest } = control.errors;
    control.setErrors(Object.keys(rest).length > 0 ? rest : null);
  }
}
