import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';

export interface ChoiceOption {
  value: string;
  label: string;
}

/**
 * Pill-shaped option group, single or multi select.
 *
 * The native radio/checkbox stays in the DOM — only its default rendering is
 * hidden — so focus, keyboard operation and screen-reader semantics come free.
 * A div-with-click version of this would have to reimplement all three.
 */
@Component({
  selector: 'app-ui-choice-chips',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset class="group">
      <legend class="group__legend">
        {{ legend() }}
        @if (optional()) {
          <span class="group__optional">(اختياري)</span>
        }
      </legend>

      <div class="group__options">
        @for (option of options(); track option.value) {
          <label class="chip" [class.chip--on]="isSelected(option.value)">
            <input
              [type]="multiple() ? 'checkbox' : 'radio'"
              [name]="name()"
              [value]="option.value"
              [checked]="isSelected(option.value)"
              (change)="toggle(option.value)"
            />
            <span>{{ option.label }}</span>
          </label>
        }
      </div>

      @if (error()) {
        <p class="group__error" role="alert">{{ error() }}</p>
      }
    </fieldset>
  `,
  styleUrl: './ui-choice-chips.scss',
})
export class UiChoiceChips {
  readonly legend = input.required<string>();
  readonly options = input.required<readonly ChoiceOption[]>();
  /** Radio group name — must be unique on the page. */
  readonly name = input.required<string>();
  readonly selected = input<string | readonly string[]>('');
  readonly multiple = input(false, { transform: booleanAttribute });
  readonly optional = input(false, { transform: booleanAttribute });
  readonly error = input<string>();

  readonly selectionChange = output<string>();

  protected isSelected(value: string): boolean {
    const current = this.selected();
    return Array.isArray(current) ? current.includes(value) : current === value;
  }

  protected toggle(value: string): void {
    this.selectionChange.emit(value);
  }
}
