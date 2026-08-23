import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';

/**
 * Renders a SAR amount, a date range, a count or a reference number.
 *
 * This exists because Latin digits inside an RTL run get reordered by the bidi
 * algorithm — "1,800.00 ر.س" comes out scrambled and "12 – 20 أغسطس" splits
 * apart. The design isolates every numeric span; putting that in one component
 * means no template can forget it.
 */
@Component({
  selector: 'app-ui-money',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="money" [class.money--strong]="strong()" dir="rtl">{{
    formatted()
  }}</span>`,
  styleUrl: './ui-money.scss',
})
export class UiMoney {
  readonly amount = input.required<number>();
  readonly strong = input(false, { transform: booleanAttribute });
  /** Set false for a bare figure with no currency suffix. */
  readonly showCurrency = input(true, { transform: booleanAttribute });

  protected readonly formatted = computed(() => {
    const value = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(this.amount());
    return this.showCurrency() ? `${value} ر.س` : value;
  });
}
