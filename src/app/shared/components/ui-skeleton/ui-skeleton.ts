import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Loading placeholder. Renders `count` card-shaped blocks matching the list
 * layout, so the page does not reflow when real data arrives.
 *
 * aria-busy plus a visually hidden label means a screen reader announces
 * "جارٍ التحميل" instead of reading empty boxes.
 */
@Component({
  selector: 'app-ui-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="skeleton" aria-busy="true" [attr.aria-label]="label()">
      <span class="sr-only">{{ label() }}</span>
      @for (i of blocks(); track i) {
        <div class="skeleton__card" aria-hidden="true">
          <div class="skeleton__thumb"></div>
          <div class="skeleton__lines">
            <div class="skeleton__line skeleton__line--short"></div>
            <div class="skeleton__line"></div>
            <div class="skeleton__line skeleton__line--medium"></div>
          </div>
        </div>
      }
    </div>
  `,
  styleUrl: './ui-skeleton.scss',
})
export class UiSkeleton {
  readonly count = input(3);
  readonly label = input('جارٍ التحميل...');

  protected blocks(): number[] {
    return Array.from({ length: this.count() }, (_, i) => i);
  }
}
