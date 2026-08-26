import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { UiField } from './ui-field';

// OnPush deliberately: it is the strategy every real screen uses, and it is
// what made the original bug survive — a projected input's events mark the
// host dirty, not the field, so only a signal dependency brings it back.
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, UiField],
  template: `
    <app-ui-field
      label="البريد الإلكتروني"
      for="f-email"
      hint="نرسل إليه الإيصالات."
      [control]="control"
    >
      <input id="f-email" type="email" [formControl]="control" />
    </app-ui-field>
  `,
})
class Host {
  readonly control = new FormControl('', [Validators.required, Validators.email]);
}

/**
 * Written after a bug that was invisible precisely because it was everywhere.
 *
 * `showError` and `errorText` were `computed()` over an `AbstractControl` whose
 * `invalid`, `touched` and `errors` are plain properties rather than signals.
 * `control()` never changes, so both evaluated once — while the form was still
 * pristine and valid — and cached "no error" for the life of the field. Every
 * form in the application went red from the stylesheet and never said why.
 *
 * These tests assert the recomputation, not the wording: the failure mode is a
 * stale value, so each one changes the control's state *after* first render and
 * checks that the field noticed.
 */
describe('UiField', () => {
  let fixture: ComponentFixture<Host>;
  let el: HTMLElement;
  let host: Host;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();

    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  it('shows the hint and no error while the field is untouched', () => {
    expect(el.querySelector('.field__error')).toBeNull();
    expect(el.querySelector('.field__hint')?.textContent).toContain('نرسل إليه الإيصالات');
  });

  /** The case that was broken: the state changes after the first render. */
  it('reports an error once the control is touched, not only on first render', () => {
    host.control.markAsTouched();
    fixture.detectChanges();

    const error = el.querySelector('.field__error');
    expect(error).withContext('the message never appeared').not.toBeNull();
    expect(error?.textContent?.trim().length).toBeGreaterThan(0);
  });

  it('changes the message when the reason for the failure changes', () => {
    host.control.markAsTouched();
    fixture.detectChanges();
    const whenEmpty = el.querySelector('.field__error')?.textContent?.trim();

    host.control.setValue('not-an-email');
    fixture.detectChanges();
    const whenMalformed = el.querySelector('.field__error')?.textContent?.trim();

    expect(whenEmpty).toBeTruthy();
    expect(whenMalformed).toBeTruthy();
    expect(whenMalformed).not.toBe(whenEmpty);
  });

  it('drops the error and restores the hint once the value is valid', () => {
    host.control.markAsTouched();
    host.control.setValue('bad');
    fixture.detectChanges();
    expect(el.querySelector('.field__error')).not.toBeNull();

    host.control.setValue('renter@example.com');
    fixture.detectChanges();

    expect(el.querySelector('.field__error')).toBeNull();
    expect(el.querySelector('.field__hint')).not.toBeNull();
  });
});
