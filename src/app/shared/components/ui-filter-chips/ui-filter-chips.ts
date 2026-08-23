import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface FilterChip<T = string> {
  value: T;
  label: string;
  /** Rendered after the label when present. */
  count?: number;
}

/**
 * Horizontally scrollable pill filters — the mobile pattern in the design
 * ("الكل · منشورة · قيد المراجعة · مسودة · مرفوضة").
 *
 * Rendered as a radiogroup rather than buttons so arrow keys move between
 * options, which is what a single-choice filter should do.
 */
@Component({
  selector: 'app-ui-filter-chips',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chips" role="radiogroup" [attr.aria-label]="label()">
      @for (chip of chips(); track chip.value) {
        <button
          type="button"
          class="chip"
          role="radio"
          [class.chip--active]="chip.value === selected()"
          [attr.aria-checked]="chip.value === selected()"
          (click)="selectionChange.emit(chip.value)"
        >
          {{ chip.label }}
          @if (chip.count !== undefined) {
            <span class="chip__count" dir="ltr">{{ chip.count }}</span>
          }
        </button>
      }
    </div>
  `,
  styleUrl: './ui-filter-chips.scss',
})
export class UiFilterChips<T extends string> {
  readonly chips = input.required<readonly FilterChip<T>[]>();
  readonly selected = input.required<T>();
  readonly label = input('تصفية');

  readonly selectionChange = output<T>();
}
