import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

/**
 * The prohibited-items list (FR-BKG-04).
 *
 * Shown on the space details, at the goods step where it must be acknowledged,
 * and on "how the platform works". One component so the wording is identical in
 * all three — the acknowledgement is a contractual undertaking, and a renter who
 * agreed to a list that read differently on the page they agreed from would have
 * a fair complaint.
 *
 * The items themselves are reference data (FR-ADM-05), passed in rather than
 * written here, so administration can amend the list without a release.
 */
@Component({
  selector: 'app-ui-prohibited-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="banned" [class.banned--single]="singleColumn()">
      <ul class="banned__list">
        @for (item of items(); track item) {
          <li class="banned__item">
            <span class="banned__mark" aria-hidden="true">✕</span>
            <span class="banned__text">{{ item }}</span>
          </li>
        }
      </ul>

      @if (note()) {
        <p class="banned__note">{{ note() }}</p>
      }

      <ng-content />
    </div>
  `,
  styleUrl: './ui-prohibited-list.scss',
})
export class UiProhibitedList {
  readonly items = input.required<readonly string[]>();
  readonly note = input<string>();
  /** The sidebar and mobile layouts stack instead of pairing. */
  readonly singleColumn = input(false, { transform: booleanAttribute });
}
