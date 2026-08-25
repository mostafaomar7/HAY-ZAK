import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import type { Unit } from '@core/models/unit.model';
import { UnitStatus } from '@core/enums/unit-status.enum';
import { indicativeMonthlyPrice } from '@core/utils/money.utils';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiThumbnail } from '@shared/components/ui-thumbnail/ui-thumbnail';

/**
 * One space in the search results (FR-MKT-08).
 *
 * The whole card is a link to the details page and the visible button is the
 * same link — a card that only responds to a small button is a known complaint
 * on a phone, and SRS §2.2 puts a low-confidence user class at the centre of
 * this journey. The button is `tabindex="-1"` so the pair produces one stop in
 * the tab order rather than two.
 *
 * Hovering reports upward so the map can highlight the matching pin; the two
 * are the same list seen twice, and the design ties them together.
 */
@Component({
  selector: 'app-unit-result-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiButton, UiThumbnail],
  host: {
    '(mouseenter)': 'hovered.emit(unit().id)',
    '(mouseleave)': 'hovered.emit(null)',
  },
  templateUrl: './unit-result-card.html',
  styleUrl: './unit-result-card.scss',
})
export class UnitResultCard {
  protected readonly i18n = inject(LanguageService);

  readonly unit = input.required<Unit>();
  /** Highlighted because its pin is under the pointer. */
  readonly active = input(false, { transform: booleanAttribute });
  /** How many days the current search asked for, for the "10 أيام = …" line. */
  readonly days = input(0);
  readonly layout = input<'row' | 'tile'>('row');

  readonly hovered = output<string | null>();

  protected readonly monthly = computed(() =>
    Math.round(indicativeMonthlyPrice(this.unit().dailyPriceHalalas)),
  );

  protected readonly periodTotal = computed(() => this.unit().dailyPriceHalalas * this.days());

  /** FR-MKT-10 — a fully-booked unit stays listed but cannot be booked now. */
  protected readonly isBooked = computed(() => this.unit().status === UnitStatus.FullyBooked);

  protected readonly cover = computed(() => this.unit().images[0]?.url);

  protected readonly place = computed(() => {
    const unit = this.unit();
    const district = this.i18n.pick(unit.district);
    const city = this.i18n.pick(unit.city);
    return [district, city].filter(Boolean).join('، ');
  });
}
