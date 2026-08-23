import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { LanguageService } from '@core/i18n/language.service';
import type { Unit } from '@core/models/unit.model';

interface Pin {
  id: string;
  title: string;
  price: number;
  /** Percentages inside the canvas. */
  top: string;
  end: string;
}

/**
 * The price-pin map above the results (FR-MKT-07).
 *
 * Pins are placed by normalising each unit's coordinates against the bounding
 * box of the current results. That is what a real projection does over a small
 * area, so when a tile provider is chosen the pins keep their relative
 * arrangement and only the backdrop changes — see UiLocationMap for why the
 * backdrop is drawn rather than fetched.
 *
 * Hover is two-way with the list: pointing at a pin highlights its card and the
 * reverse. The pins are buttons, so the same association is reachable by keyboard.
 *
 * It is a panel the width of the results column, shown or hidden by the toolbar
 * switch — the page owns that state, so this component has no opinion on it.
 */
@Component({
  selector: 'app-results-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './results-map.html',
  styleUrl: './results-map.scss',
})
export class ResultsMap {
  protected readonly i18n = inject(LanguageService);

  readonly units = input.required<readonly Unit[]>();
  readonly activeId = input<string | null>(null);
  readonly cityLabel = input('');

  readonly hovered = output<string | null>();

  protected readonly pins = computed<Pin[]>(() => {
    const units = this.units().filter((unit) => !!unit.location);
    if (units.length === 0) return [];

    const lats = units.map((unit) => unit.location.latitude);
    const lngs = units.map((unit) => unit.location.longitude);
    const spanLat = Math.max(...lats) - Math.min(...lats) || 1;
    const spanLng = Math.max(...lngs) - Math.min(...lngs) || 1;
    const minLat = Math.min(...lats);
    const minLng = Math.min(...lngs);

    return units.map((unit) => ({
      id: unit.id,
      title: unit.title,
      price: unit.dailyPrice,
      // North is up, so a higher latitude sits nearer the top.
      top: `${clamp(84 - ((unit.location.latitude - minLat) / spanLat) * 68)}%`,
      end: `${clamp(16 + ((unit.location.longitude - minLng) / spanLng) * 68)}%`,
    }));
  });

  protected readonly hoveredTitle = computed(() => {
    const id = this.activeId();
    return this.units().find((unit) => unit.id === id)?.title ?? '';
  });
}

function clamp(value: number): number {
  return Math.min(92, Math.max(8, Math.round(value)));
}
