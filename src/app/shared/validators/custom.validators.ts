import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { REGEX } from '../../core/constants/app.constants';

/** Rejects a value that is only whitespace. */
export const notBlank: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value;
  return typeof value === 'string' && value.trim().length === 0 ? { notBlank: true } : null;
};

export const strongPassword: ValidatorFn = (control): ValidationErrors | null => {
  if (!control.value) return null;
  return REGEX.password.test(control.value) ? null : { strongPassword: true };
};

/** Attach to the FormGroup, not the control: `{ validators: matchFields('password', 'confirm') }`. */
export function matchFields(source: string, target: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const a = group.get(source)?.value;
    const b = group.get(target)?.value;
    if (a === b) return null;
    group.get(target)?.setErrors({ fieldsMismatch: true });
    return { fieldsMismatch: true };
  };
}

export function maxFileSize(megabytes: number): ValidatorFn {
  return (control): ValidationErrors | null => {
    const file: File | null = control.value;
    if (!file) return null;
    return file.size <= megabytes * 1024 * 1024 ? null : { maxFileSize: { megabytes } };
  };
}

export function allowedFileTypes(types: readonly string[]): ValidatorFn {
  return (control): ValidationErrors | null => {
    const file: File | null = control.value;
    if (!file) return null;
    return types.includes(file.type) ? null : { allowedFileTypes: { types } };
  };
}
