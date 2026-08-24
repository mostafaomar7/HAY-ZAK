import { FormBuilder } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../models/api-error.model';
import { applyFieldErrors, clearServerErrors } from './api-form';

describe('api-form', () => {
  const fb = () => TestBed.inject(FormBuilder);

  function validation(details: { field: string; message: string }[]): ApiError {
    return new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'تحقّق من البيانات.',
      status: 422,
      details,
      requestId: 'req-1',
    });
  }

  it('puts the server message on the control it names', () => {
    const form = fb().group({ email: [''], mobile: [''] });

    applyFieldErrors(form, validation([{ field: 'email', message: 'هذا البريد مسجّل بالفعل.' }]));

    expect(form.controls.email.errors?.['server']).toBe('هذا البريد مسجّل بالفعل.');
    expect(form.controls.email.touched).withContext('so the message shows').toBeTrue();
    expect(form.controls.mobile.errors).toBeNull();
  });

  /**
   * A refused form with nothing marked on it is the worst outcome: the user is
   * told to fix something and shown nowhere to look.
   */
  it('returns messages for fields the form does not have, rather than dropping them', () => {
    const form = fb().group({ email: [''] });

    const unmatched = applyFieldErrors(
      form,
      validation([
        { field: 'email', message: 'مسجّل بالفعل.' },
        { field: 'termsVersionId', message: 'نسخة الشروط غير صالحة.' },
      ]),
    );

    expect(unmatched).toEqual(['نسخة الشروط غير صالحة.']);
  });

  it('keeps the local validators alongside the server message', () => {
    const form = fb().group({ email: [''] });
    form.controls.email.setErrors({ email: true });

    applyFieldErrors(form, validation([{ field: 'email', message: 'مسجّل بالفعل.' }]));

    expect(form.controls.email.errors).toEqual({ email: true, server: 'مسجّل بالفعل.' });
  });

  it('clears only the server errors before a resubmit', () => {
    const form = fb().group({ email: [''], mobile: [''] });
    form.controls.email.setErrors({ email: true, server: 'مسجّل بالفعل.' });
    form.controls.mobile.setErrors({ server: 'رقم غير صالح.' });

    clearServerErrors(form);

    // The local failure is still true; the server's may not be any more.
    expect(form.controls.email.errors).toEqual({ email: true });
    expect(form.controls.mobile.errors).toBeNull();
  });
});
