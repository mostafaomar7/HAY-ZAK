import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

export interface MeterRow {
  label: string;
  /** 0–100. */
  percent: number;
  /** What to print at the end of the row — "72%", "10,982 من 12,480". */
  display: string;
}

/**
 * The reports' horizontal ratio bars (FR-RPT-03, FR-RPT-04): how much of each
 * lessor's dues have gone out, and occupancy per category.
 *
 * A `<progress>` element would be the semantic fit, but it cannot be styled to
 * the design's flat track on every browser. So the bar is a div and the value is
 * carried by `role="meter"` with the aria attributes — announced correctly, and
 * printed as text beside it either way.
 */
@Component({
  selector: 'app-admin-meter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="meter">
      <header class="meter__head">
        <h3 class="meter__title">{{ title() }}</h3>
        @if (legend().length > 0) {
          <span class="meter__legend">
            @for (item of legend(); track item; let index = $index) {
              <span class="legend">
                <span class="legend__swatch" [class.legend__swatch--rest]="index > 0"></span>
                {{ item }}
              </span>
            }
          </span>
        }
      </header>

      @for (row of rows(); track row.label) {
        <div class="row" [class.row--inline]="inline()">
          <span class="row__label">{{ row.label }}</span>
          <span
            class="row__track"
            role="meter"
            [attr.aria-label]="row.label"
            [attr.aria-valuenow]="row.percent"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <span class="row__fill" [style.width.%]="row.percent"></span>
          </span>
          <span class="row__value num">{{ row.display }}</span>
        </div>
      }
    </section>
  `,
  styleUrl: './admin-meter.scss',
})
export class AdminMeter {
  readonly title = input.required<string>();
  readonly rows = input.required<readonly MeterRow[]>();
  /** Two labels — the filled part and the remainder. Omit for no legend. */
  readonly legend = input<readonly string[]>([]);
  /** Label, bar and figure on one line (occupancy) rather than stacked. */
  readonly inline = input(false, { transform: booleanAttribute });
}
