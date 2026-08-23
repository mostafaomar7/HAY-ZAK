import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';

/**
 * Headline figure. `filled` is the teal hero tile from the dues screen; the
 * default is a plain surface tile for secondary numbers.
 *
 * Formats the amount itself rather than delegating to UiMoney, because the tile
 * owns the type scale — nesting the component would mean fighting its font size
 * from the outside.
 */
@Component({
  selector: 'app-ui-stat-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tile" [class.tile--filled]="filled()">
      <span class="tile__label">{{ label() }}</span>
      <span class="tile__value num" [attr.dir]="money() ? 'rtl' : 'ltr'">{{ formatted() }}</span>
      @if (hint()) {
        <span class="tile__hint">{{ hint() }}</span>
      }
    </div>
  `,
  styleUrl: './ui-stat-tile.scss',
})
export class UiStatTile {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly hint = input<string>();
  /** Format as SAR rather than a bare count. */
  readonly money = input(true, { transform: booleanAttribute });
  readonly filled = input(false, { transform: booleanAttribute });

  protected readonly formatted = computed(() => {
    if (!this.money()) return new Intl.NumberFormat('en-US').format(this.value());

    const amount = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(this.value());
    return `${amount} ر.س`;
  });
}
