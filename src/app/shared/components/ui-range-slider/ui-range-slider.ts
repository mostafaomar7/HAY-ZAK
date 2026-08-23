import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * The distance filter on the results page (FR-MKT-05).
 *
 * A styled native `<input type="range">`, not a custom drag surface: the native
 * control is already keyboard-operable with the arrow keys, announces its value,
 * and honours the pointer conventions of every platform. Everything the design
 * adds — the gold value read-out and the two end labels — is decoration around
 * it.
 */
@Component({
  selector: 'app-ui-range-slider',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="slider">
      <div class="slider__head">
        <label class="slider__label" [attr.for]="inputId()">{{ label() }}</label>
        <span class="slider__value num" dir="ltr">{{ valueLabel() }}</span>
      </div>

      <input
        class="slider__input"
        type="range"
        [id]="inputId()"
        [min]="min()"
        [max]="max()"
        [step]="step()"
        [value]="value()"
        [attr.aria-valuetext]="valueLabel()"
        (input)="onInput($event)"
      />

      <div class="slider__scale" aria-hidden="true">
        <span class="num" dir="ltr">{{ minLabel() }}</span>
        <span class="num" dir="ltr">{{ maxLabel() }}</span>
      </div>
    </div>
  `,
  styleUrl: './ui-range-slider.scss',
})
export class UiRangeSlider {
  readonly inputId = input.required<string>();
  readonly label = input.required<string>();
  /** Pre-formatted so the caller owns the unit ("حتى 10 كم"). */
  readonly valueLabel = input.required<string>();
  readonly minLabel = input('');
  readonly maxLabel = input('');
  readonly min = input(1);
  readonly max = input(25);
  readonly step = input(1);
  readonly value = input.required<number>();

  readonly valueChange = output<number>();

  protected onInput(event: Event): void {
    this.valueChange.emit(Number((event.target as HTMLInputElement).value));
  }
}
