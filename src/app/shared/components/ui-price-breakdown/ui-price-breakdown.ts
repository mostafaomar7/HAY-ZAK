import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
} from '@angular/core';
import { FINANCIAL_DEFAULTS } from '@core/constants/app.constants';
import { LanguageService } from '@core/i18n/language.service';
import { bpsToPercent, halalasToSar, type PriceBreakdown } from '@core/utils/money.utils';
import { UiMoney } from '../ui-money/ui-money';

/**
 * The price table FR-BKG-02 requires before payment.
 *
 * One component for five screens — details, payment, booking details, invoice
 * and cancellation — because the arithmetic on screen has to agree everywhere,
 * and five hand-built tables are five chances for the total to be assembled
 * differently.
 *
 * A line whose amount does not fall on the renter renders as an em dash rather
 * than being dropped: the design shows the commission line even when it comes
 * out of the owner's share, so the renter can see it was accounted for and not
 * added to their bill.
 */
@Component({
  selector: 'app-ui-price-breakdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiMoney],
  templateUrl: './ui-price-breakdown.html',
  styleUrl: './ui-price-breakdown.scss',
})
export class UiPriceBreakdown {
  protected readonly i18n = inject(LanguageService);

  readonly price = input.required<PriceBreakdown>();
  /** Overrides the default total label — "الإجمالي المدفوع" on an invoice. */
  readonly totalLabel = input<string>();
  readonly note = input<string>();
  readonly compact = input(false, { transform: booleanAttribute });

  /**
   * Read from configuration, not written into the copy: the rate is an
   * administrator setting (FR-ADM-06) and the design's "5%" is one possible
   * value of it.
   */
  protected readonly commissionRate = computed(() =>
    formatRate(FINANCIAL_DEFAULTS.commissionRateBps),
  );
  protected readonly vatRate = computed(() => formatRate(FINANCIAL_DEFAULTS.vatRateBps));

  /** True when the renter bears none of it — the line shows a dash. */
  protected readonly commissionOnLessor = computed(
    () => FINANCIAL_DEFAULTS.commissionBearer === 'lessor',
  );

  protected readonly rentLine = computed(() => {
    const { dailyPriceHalalas, days } = this.price();
    return this.i18n.t('details.rentValueLine', {
      price: `${halalasToSar(dailyPriceHalalas)} ${this.i18n.t('common.currency')}`,
      days: this.i18n.t('booking.days', { count: days }),
    });
  });

  protected readonly total = computed(() => this.totalLabel() ?? this.i18n.t('details.totalDue'));
}

function formatRate(rateBps: number): string {
  return `${bpsToPercent(rateBps)}%`;
}
