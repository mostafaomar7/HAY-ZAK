import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface WizardStep {
  index: number;
  label: string;
}

/**
 * Numbered step header for the add-a-space wizard and the renter's four-step
 * booking journey.
 *
 * SRS §2.2 caps the add-a-space journey at three steps for the least digitally
 * experienced user class, so that count is a requirement, not a layout choice.
 *
 * Completed steps are clickable to go back; steps ahead are disabled, since
 * jumping forward would skip validation. A completed step shows a tick instead
 * of its number — the number is decorative once the step is behind you, and the
 * label carries the meaning either way.
 */
@Component({
  selector: 'app-ui-wizard-steps',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="wizard" [attr.aria-label]="label()">
      @for (step of steps(); track step.index) {
        <li class="wizard__item">
          <button
            type="button"
            class="wizard__step"
            [class.wizard__step--active]="step.index === current()"
            [class.wizard__step--done]="step.index < current()"
            [disabled]="step.index > current()"
            [attr.aria-current]="step.index === current() ? 'step' : null"
            (click)="goTo.emit(step.index)"
          >
            <span class="wizard__num num" dir="ltr" aria-hidden="true">{{
              step.index < current() ? '✓' : step.index
            }}</span>
            {{ step.label }}
          </button>
        </li>
      }
    </ol>
  `,
  styleUrl: './ui-wizard-steps.scss',
})
export class UiWizardSteps {
  readonly steps = input.required<readonly WizardStep[]>();
  readonly current = input.required<number>();
  readonly label = input('خطوات الإضافة');

  readonly goTo = output<number>();
}
