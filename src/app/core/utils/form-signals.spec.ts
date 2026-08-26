import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormBuilder, Validators } from '@angular/forms';
import { controlChanges } from './form-signals';

/**
 * The bug this exists to prevent, written as the shape it actually took.
 *
 * `computed(() => this.form.valid && this.acknowledged())` looks correct and
 * is not. `form.valid` is a plain property, so the only signal in that
 * expression is `acknowledged` — the computed recomputes when the checkbox is
 * ticked and at no other time. Tick the box first and then type, and it holds
 * the answer it worked out on an empty form: the continue button stays grey
 * with a filled-in, valid form in front of it.
 *
 * That order matters is what makes it so hard to report. Fill the form then
 * tick, and it works.
 */
describe('controlChanges', () => {
  function build() {
    return TestBed.runInInjectionContext(() => {
      const form = new FormBuilder().group({
        note: ['', [Validators.required, Validators.minLength(5)]],
      });
      const acknowledged = signal(false);
      const changes = controlChanges(form);

      return {
        form,
        acknowledged,
        // With the dependency.
        canContinue: computed(() => {
          changes();
          return form.valid && acknowledged();
        }),
        // Without it — kept so the test states what it is protecting against.
        naive: computed(() => form.valid && acknowledged()),
      };
    });
  }

  it('enables when the form is filled in after the checkbox is ticked', () => {
    const { form, acknowledged, canContinue } = build();

    acknowledged.set(true);
    expect(canContinue()).withContext('still empty').toBeFalse();

    form.controls.note.setValue('أثاث منزلي مفكّك');

    expect(canContinue()).withContext('valid form, box ticked').toBeTrue();
  });

  it('is the case the naive computed gets wrong', () => {
    const { form, acknowledged, naive } = build();

    // The first read is what makes this bite, and a template always does one:
    // the button renders on load, the computed caches "invalid", and nothing
    // it depends on ever tells it otherwise.
    expect(naive()).withContext('first render, empty form').toBeFalse();

    acknowledged.set(true);
    form.controls.note.setValue('أثاث منزلي مفكّك');

    // Same inputs, same order, wrong answer — nothing in the expression told
    // the computed that the form had moved. This is the button staying grey.
    expect(naive()).withContext('the bug controlChanges exists to prevent').toBeFalse();
  });

  it('enables when the checkbox is ticked after the form is filled in', () => {
    const { form, acknowledged, canContinue } = build();

    form.controls.note.setValue('أثاث منزلي مفكّك');
    acknowledged.set(true);

    expect(canContinue()).toBeTrue();
  });

  it('goes back to false when the value stops being valid', () => {
    const { form, acknowledged, canContinue } = build();

    acknowledged.set(true);
    form.controls.note.setValue('أثاث منزلي');
    expect(canContinue()).toBeTrue();

    form.controls.note.setValue('لا');
    expect(canContinue()).withContext('below the minimum length').toBeFalse();
  });

  /** `touched` is what decides whether an error may be shown — see UiField. */
  it('notices touched, which valueChanges alone would miss', () => {
    const { form, canContinue } = build();
    const touched = TestBed.runInInjectionContext(() => {
      const changes = controlChanges(form);
      return computed(() => {
        changes();
        return form.controls.note.touched;
      });
    });

    expect(touched()).toBeFalse();
    form.controls.note.markAsTouched();

    expect(touched()).withContext('the field was touched, nothing changed value').toBeTrue();
    expect(canContinue()).toBeFalse();
  });

  it('follows a control that arrives through a signal', () => {
    const { held, valid } = TestBed.runInInjectionContext(() => {
      const fb = new FormBuilder();
      const first = fb.control('', Validators.required);
      const held = signal(first);
      const changes = controlChanges(held);
      return {
        held,
        valid: computed(() => {
          changes();
          return held().valid;
        }),
      };
    });

    expect(valid()).toBeFalse();

    // A component whose control is an `input()` gets a new one; the signal
    // form of this helper resubscribes rather than watching the old control.
    const second = new FormBuilder().control('مكتوب', Validators.required);
    held.set(second);

    expect(valid()).toBeTrue();
  });
});
