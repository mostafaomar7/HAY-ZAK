import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { IconName } from '@shared/components/ui-icon/ui-icon';
import { UiIcon } from '@shared/components/ui-icon/ui-icon';

/**
 * "بطاقة المؤشر" — the first of the design's six unified components.
 *
 * Label, one large figure, a line icon, and a comparison with the previous
 * period beneath a rule. It differs from `UiStatTile` (the lessor's) in
 * carrying the icon and the comparison line, which is why it lives here rather
 * than being bent into the shared one.
 *
 * `value` is a string, not a number: some indicators are counts, some are money
 * and some are percentages, and the caller already knows which — formatting
 * here would mean guessing.
 */
@Component({
  selector: 'app-admin-kpi-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiIcon],
  template: `
    <article class="kpi">
      <header class="kpi__head">
        <span class="kpi__label">{{ label() }}</span>
        <span class="kpi__icon" aria-hidden="true">
          <app-ui-icon [name]="icon()" [size]="20" />
        </span>
      </header>

      <p class="kpi__figure">
        <span class="kpi__value num">{{ value() }}</span>
        @if (unit()) {
          <span class="kpi__unit">{{ unit() }}</span>
        }
      </p>

      @if (delta()) {
        <p class="kpi__delta">{{ delta() }}</p>
      }
    </article>
  `,
  styleUrl: './admin-kpi-card.scss',
})
export class AdminKpiCard {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly unit = input('');
  /** Comparison with the previous period, already worded by the caller. */
  readonly delta = input('');
  readonly icon = input<IconName>('grid');
}
