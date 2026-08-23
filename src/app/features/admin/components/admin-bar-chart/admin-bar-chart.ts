import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';

export interface BarSeries {
  label: string;
  tone: 'primary' | 'accent';
}

export interface BarGroup {
  label: string;
  /** The Hijri equivalent, printed under the Gregorian one. */
  sublabel?: string;
  /** One value per series, in the same order. */
  values: readonly number[];
}

/**
 * The reports' column chart (FR-RPT-01, FR-RPT-02): one group per month, one or
 * two bars per group.
 *
 * Drawn with divs rather than an SVG or a charting library. The design's chart
 * is a bare bar-and-label — no axes, no gridlines, no tooltips — and pulling in
 * a chart library to render eleven rectangles would cost more in bundle size
 * than the whole reports feature. When a real chart is needed (a line, a stacked
 * area) this component is the seam to replace.
 *
 * Bars are normalised against the largest value across every series, so the two
 * series stay comparable — scaling each to its own maximum would make a 5%
 * commission bar as tall as the revenue it came from.
 */
@Component({
  selector: 'app-admin-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="chart">
      <figcaption class="chart__head">
        <span class="chart__title">{{ title() }}</span>
        @if (series().length > 1) {
          <span class="chart__legend">
            @for (item of series(); track item.label) {
              <span class="legend">
                <span class="legend__swatch" [class]="'legend__swatch--' + item.tone"></span>
                {{ item.label }}
              </span>
            }
          </span>
        }
      </figcaption>

      <div class="chart__plot">
        @for (group of groups(); track group.label) {
          <div class="group">
            @if (showValues()) {
              <span class="group__value num">{{ group.values[0] }}</span>
            }
            <div class="group__bars">
              @for (value of group.values; track $index) {
                <span
                  class="bar"
                  [class]="'bar--' + (series()[$index]?.tone ?? 'primary')"
                  [style.height.%]="height(value)"
                  [attr.aria-label]="group.label + ': ' + value"
                ></span>
              }
            </div>
          </div>
        }
      </div>

      <div class="chart__axis">
        @for (group of groups(); track group.label) {
          <div class="tick">
            <span class="tick__label">{{ group.label }}</span>
            @if (group.sublabel) {
              <span class="tick__sub num">{{ group.sublabel }}</span>
            }
          </div>
        }
      </div>
    </figure>
  `,
  styleUrl: './admin-bar-chart.scss',
})
export class AdminBarChart {
  readonly title = input.required<string>();
  readonly series = input.required<readonly BarSeries[]>();
  readonly groups = input.required<readonly BarGroup[]>();
  /** Prints the first series' figure above each group — the count chart does. */
  readonly showValues = input(false, { transform: booleanAttribute });

  private readonly peak = computed(() =>
    Math.max(1, ...this.groups().flatMap((group) => [...group.values])),
  );

  /** A floor of 4% so a zero month is still a visible tick, not a gap. */
  protected height(value: number): number {
    return Math.max(4, Math.round((value / this.peak()) * 100));
  }
}
