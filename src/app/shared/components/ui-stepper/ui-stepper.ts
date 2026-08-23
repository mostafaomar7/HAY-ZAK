import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface StepperStep {
  label: string;
  /** Shown under the label — a date, "الآن", or nothing. */
  meta?: string;
  /** Longer explanation; the renter's vertical booking timeline uses it. */
  description?: string;
  state: 'done' | 'current' | 'upcoming' | 'failed';
}

/**
 * Progress trail — "مراحل الطلب" on the lessor side and "مراحل الحجز" on the
 * renter's booking details.
 *
 * An ordered list, so assistive tech gets the sequence, with the live step
 * marked aria-current. The glyphs are decorative; each step's state is also
 * announced as text so it is never conveyed by colour alone.
 *
 * The vertical orientation is the same data with a connector drawn between the
 * markers. The alternative — a second component for the renter — would have
 * meant two places to keep the state vocabulary honest.
 */
@Component({
  selector: 'app-ui-stepper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="stepper" [class]="'stepper--' + orientation()" [attr.aria-label]="label()">
      @for (step of steps(); track step.label) {
        <li class="step" [class]="'step--' + step.state" [attr.aria-current]="isCurrent(step)">
          <span class="step__marker" aria-hidden="true">{{ glyph(step) }}</span>

          <span class="step__body">
            <span class="step__label">{{ step.label }}</span>
            <span class="sr-only">{{ stateText(step) }}</span>
            @if (step.description) {
              <span class="step__desc">{{ step.description }}</span>
            }
            @if (step.meta) {
              <span class="step__meta num">{{ step.meta }}</span>
            }
          </span>
        </li>
      }
    </ol>
  `,
  styleUrl: './ui-stepper.scss',
})
export class UiStepper {
  readonly steps = input.required<readonly StepperStep[]>();
  readonly label = input('مراحل الطلب');
  readonly orientation = input<'horizontal' | 'vertical'>('horizontal');

  protected isCurrent(step: StepperStep): 'step' | null {
    return step.state === 'current' ? 'step' : null;
  }

  protected glyph(step: StepperStep): string {
    switch (step.state) {
      case 'done':
        return '✓';
      case 'current':
        return '•';
      case 'failed':
        return '×';
      default:
        return '';
    }
  }

  protected stateText(step: StepperStep): string {
    switch (step.state) {
      case 'done':
        return '(مكتملة)';
      case 'current':
        return '(المرحلة الحالية)';
      case 'failed':
        return '(متعذّرة)';
      default:
        return '(لم تبدأ)';
    }
  }
}
