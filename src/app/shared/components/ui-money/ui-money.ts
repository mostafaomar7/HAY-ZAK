import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';

/**
 * Renders an amount held in halalas.
 *
 * Two jobs, and both belong in one place. It is the only division by 100 the
 * templates perform: money travels as integer halalas everywhere else, and a
 * template that divided by hand would be one rounding decision away from
 * disagreeing with the total beside it.
 *
 * And it isolates the digits. Latin numerals inside an RTL run get reordered by
 * the bidi algorithm — "1,800.00 ر.س" comes out scrambled and "12 – 20 أغسطس"
 * splits apart. The design isolates every numeric span; putting that here means
 * no template can forget it.
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
  /** Integer halalas: 86250 renders as 862.50. */
  readonly halalas = input.required<number>();
  readonly strong = input(false, { transform: booleanAttribute });
  /** Set false for a bare figure with no currency suffix. */
  readonly showCurrency = input(true, { transform: booleanAttribute });

  protected readonly formatted = computed(() => {
    const value = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(this.halalas() / 100);
    return this.showCurrency() ? `${value} ر.س` : value;
  });
}
