import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Shows that data exists but is withheld — the blurred "بيانات المستأجر" panel.
 *
 * Its job is to make the rule legible: the renter's details are real and appear
 * once administration approves (FR-LSR-09), rather than the section looking
 * broken or empty.
 *
 * The obscured content is `aria-hidden` and `inert`, so neither a screen reader
 * nor the keyboard reaches the placeholder shapes behind the veil.
 *
 * Never pass genuinely withheld data through here. The blur is cosmetic and
 * trivially readable in DevTools — the API must not send the renter's details
 * before approval in the first place. Feed this placeholder shapes only.
 */
@Component({
  selector: 'app-ui-locked-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="locked">
      <div class="locked__content" aria-hidden="true" inert>
        <ng-content />
      </div>
      <div class="locked__veil">
        <span class="locked__icon" aria-hidden="true">&#9127;</span>
        <p class="locked__message">{{ message() }}</p>
      </div>
    </div>
  `,
  styleUrl: './ui-locked-panel.scss',
})
export class UiLockedPanel {
  readonly message = input.required<string>();
}
