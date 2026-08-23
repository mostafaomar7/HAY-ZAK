import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Empty and error placeholder. FR-MKT-12 requires an empty state to explain how
 * to widen the search rather than just saying "no results", so `hint` is part of
 * the contract and the action slot is there to offer the way out.
 */
@Component({
  selector: 'app-ui-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty" [class.empty--error]="tone() === 'error'" role="status">
      <p class="empty__title">{{ title() }}</p>
      @if (hint()) {
        <p class="empty__hint">{{ hint() }}</p>
      }
      <div class="empty__action"><ng-content /></div>
    </div>
  `,
  styleUrl: './ui-empty-state.scss',
})
export class UiEmptyState {
  readonly title = input.required<string>();
  readonly hint = input<string>();
  readonly tone = input<'empty' | 'error'>('empty');
}
