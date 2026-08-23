import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface TabItem<T = string> {
  value: T;
  label: string;
  count?: number;
}

/**
 * Underlined tab bar — the desktop pattern in the design
 * ("الطلبات الجديدة · النشطة · المنتهية").
 *
 * Uses the ARIA tablist pattern so arrow keys move focus; the panel itself is
 * whatever the parent renders next, marked with role="tabpanel".
 */
@Component({
  selector: 'app-ui-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tabs" role="tablist" [attr.aria-label]="label()">
      @for (tab of tabs(); track tab.value) {
        <button
          type="button"
          class="tab"
          role="tab"
          [class.tab--active]="tab.value === selected()"
          [attr.aria-selected]="tab.value === selected()"
          [attr.tabindex]="tab.value === selected() ? 0 : -1"
          (click)="selectionChange.emit(tab.value)"
        >
          {{ tab.label }}
          @if (tab.count !== undefined) {
            <span class="tab__count" dir="ltr">{{ tab.count }}</span>
          }
        </button>
      }
    </div>
  `,
  styleUrl: './ui-tabs.scss',
})
export class UiTabs<T extends string> {
  readonly tabs = input.required<readonly TabItem<T>[]>();
  readonly selected = input.required<T>();
  readonly label = input('أقسام');

  readonly selectionChange = output<T>();
}
