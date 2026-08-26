import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { LanguageService } from '@core/i18n/language.service';
import type { PublicUnitSummary } from '@core/models/public-unit';

interface Disc {
  id: string;
  title: string;
  price: number;
  /** Percentages inside the canvas. */
  top: string;
  end: string;
  /** Diameter, as a percentage of the canvas width. */
  size: string;
}

/**
 * The results map (FR-MKT-07).
 *
 * **Circles, not pins.** The catalogue never returns where a space is. It
 * returns a point deliberately displaced from the real one plus the radius it
 * was displaced within, and the space is somewhere inside that circle rather
 * than at its centre (FR-UNT-11). A pin drawn from that point would be wrong
 * by up to the radius while looking exact — which is worse than drawing
 * nothing, because the visitor would go there.
 *
 * So each result is a disc covering the area the API vouches for, with its
 * price in the middle. Discs are sized from the server's own `radiusMeters`
 * against the span of the current results, clamped at both ends: a single
 * result has no span to scale against, and a tight cluster would otherwise
 * fill the canvas. The size is therefore indicative, and the caption says so.
 *
 * Hover is two-way with the list: pointing at a disc highlights its card and
 * the reverse. The discs are buttons, so the same association is reachable by
 * keyboard.
 */
@Component({
  selector: 'app-results-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './results-map.html',
  styleUrl: './results-map.scss',
})
export class ResultsMap {
  protected readonly i18n = inject(LanguageService);

  readonly units = input.required<readonly PublicUnitSummary[]>();
  readonly activeId = input<string | null>(null);
  readonly cityLabel = input('');

  readonly hovered = output<string | null>();

  protected readonly discs = computed<Disc[]>(() => {
    const units = this.units().filter((unit) => !!unit.area);
    if (units.length === 0) return [];

    const lats = units.map((unit) => unit.area.latitude);
    const lngs = units.map((unit) => unit.area.longitude);
    const minLat = Math.min(...lats);
    const minLng = Math.min(...lngs);
    const spanLat = Math.max(...lats) - minLat;
    const spanLng = Math.max(...lngs) - minLng;

    // Degrees to metres, so a radius in metres can be compared with the span.
    // Longitude narrows towards the pole; at Riyadh's latitude that is a ~10%
    // difference, small but free to get right.
    const metresPerDegree = 111_320;
    const spanLngMetres = spanLng * metresPerDegree * Math.cos((minLat * Math.PI) / 180);

    return units.map((unit) => ({
      id: unit.id,
      title: unit.title,
      price: unit.dailyPriceHalalas,
      // North is up, so a higher latitude sits nearer the top.
      top: `${place(84 - (spanLat ? (unit.area.latitude - minLat) / spanLat : 0.5) * 68)}%`,
      end: `${place(16 + (spanLng ? (unit.area.longitude - minLng) / spanLng : 0.5) * 68)}%`,
      size: `${diameter(unit.area.radiusMeters, spanLngMetres)}%`,
    }));
  });

  protected readonly hoveredTitle = computed(() => {
    const id = this.activeId();
    return this.units().find((unit) => unit.id === id)?.title ?? '';
  });
}

function place(value: number): number {
  return Math.min(92, Math.max(8, Math.round(value)));
}

/**
 * The circle's diameter as a share of the canvas.
 *
 * Clamped rather than exact. Below the floor the price would not fit and the
 * disc would read as a pin — the exact impression this component exists to
 * avoid — and above the ceiling a cluster of results becomes one solid blob.
 */
function diameter(radiusMeters: number, spanMetres: number): number {
  if (!spanMetres) return 30;
  const raw = ((2 * radiusMeters) / spanMetres) * 68;
  return Math.min(46, Math.max(14, Math.round(raw)));
}
