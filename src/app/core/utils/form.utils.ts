import type { AbstractControl } from '@angular/forms';
import { FormGroup } from '@angular/forms';

/** Marks every control dirty+touched so validation messages appear on submit. */
export function markFormTouched(group: FormGroup): void {
  Object.values(group.controls).forEach((control: AbstractControl) => {
    control.markAsTouched();
    control.markAsDirty();
    if (control instanceof FormGroup) markFormTouched(control);
  });
}

/** Maps backend `{ field: [messages] }` onto the matching controls. */
export function applyServerErrors(group: FormGroup, errors: Record<string, string[]> = {}): void {
  for (const [field, messages] of Object.entries(errors)) {
    const control = group.get(field);
    if (control && messages.length) {
      control.setErrors({ ...control.errors, server: messages[0] });
      control.markAsTouched();
    }
  }
}

/** Strips null/undefined/'' before sending a form value to the backend. */
export function cleanFormValue<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== null && v !== undefined && v !== ''),
  ) as Partial<T>;
}
