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
import type { PublicUnitSummary } from '@core/models/public-unit';
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
 * Hovering reports upward so the map can highlight the matching circle; the two
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

  readonly unit = input.required<PublicUnitSummary>();
  /** Highlighted because its circle is under the pointer. */
  readonly active = input(false, { transform: booleanAttribute });
  /** How many days the current search asked for, for the "10 أيام = …" line. */
  readonly days = input(0);
  readonly layout = input<'row' | 'tile'>('row');

  readonly hovered = output<string | null>();

  protected readonly periodTotal = computed(() => this.unit().dailyPriceHalalas * this.days());

  /** FR-MKT-10 — a fully-booked unit stays listed but cannot be booked now. */
  protected readonly isBooked = computed(() => this.unit().isFullyBooked);

  /**
   * "١٫٧ كم" or "٤٠٠ م", and nothing at all without a search origin.
   *
   * The server rounds this to the nearest hundred metres, so the display is
   * rounded further rather than printing a figure to a precision it does not
   * have: under a kilometre it stays in hundreds of metres, above it goes to
   * one decimal place. `null` means the query carried no `lat`/`lng` — not
   * that the space is nearby.
   */
  protected readonly distance = computed(() => {
    const metres = this.unit().distanceMeters;
    if (metres === null) return null;
    return metres < 1000
      ? { value: String(metres), unit: this.i18n.t('common.metres') }
      : { value: (metres / 1000).toFixed(1), unit: this.i18n.t('results.km') };
  });

  protected readonly place = computed(() => {
    const unit = this.unit();
    const district = this.i18n.pick(unit.district ?? undefined);
    const city = this.i18n.pick(unit.city ?? undefined);
    return [district, city].filter(Boolean).join('، ');
  });
}
