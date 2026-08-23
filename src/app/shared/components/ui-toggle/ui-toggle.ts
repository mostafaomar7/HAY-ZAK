import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';

/**
 * Labelled on/off switch for the notification preferences (FR-NTF).
 *
 * A real checkbox underneath, so it is keyboard-operable and announced as a
 * checkbox with its state — a styled div would need role, tabindex, Space/Enter
 * handling and aria-checked all reimplemented.
 */
@Component({
  selector: 'app-ui-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="toggle">
      <span class="toggle__text">
        <span class="toggle__label">{{ label() }}</span>
        @if (hint()) {
          <span class="toggle__hint">{{ hint() }}</span>
        }
      </span>

      <input
        type="checkbox"
        class="toggle__input"
        [checked]="checked()"
        [disabled]="disabled()"
        (change)="checkedChange.emit(!checked())"
      />
      <span class="toggle__track" aria-hidden="true"><span class="toggle__knob"></span></span>
    </label>
  `,
  styleUrl: './ui-toggle.scss',
})
export class UiToggle {
  readonly label = input.required<string>();
  readonly hint = input<string>();
  readonly checked = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });

  readonly checkedChange = output<boolean>();
}
