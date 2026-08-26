import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  inject,
  input,
  output,
} from '@angular/core';
import { LanguageService } from '@core/i18n/language.service';
import { UiRangeCalendar } from '@shared/components/ui-range-calendar/ui-range-calendar';
import type { DateRange } from '@shared/components/ui-range-calendar/ui-range-calendar';
import { UiRangeSlider } from '@shared/components/ui-range-slider/ui-range-slider';

/** Everything the filter panel controls (FR-MKT-04, FR-MKT-05, FR-MKT-06). */
export interface ResultFilters {
  /**
   * One category, not several.
   *
   * The panel used to tick as many as you liked. `GET /public/units` takes a
   * single `categoryId` and answers 422 to a repeated one, so a multi-select
   * here could only have been implemented by filtering on the client — which
   * would have filtered the current page rather than the catalogue, and shown
   * "٤ نتائج" out of a set of fifty-one.
   */
  categoryId: string;
  districtId: string;
  /**
   * Riyals, not halalas: this is what somebody typed into a box, and a filter
   * panel holding 7500 for "75" would be a trap for the next person to touch
   * it. `results-page` converts once, where the filters become a query.
   */
  minPriceSar: number | null;
  maxPriceSar: number | null;
  minArea: number | null;
  maxArea: number | null;
  startDate: string;
  endDate: string;
  /** Shown always; only *sent* once the visitor has shared a point (0.5–200). */
  radiusKm: number;
}

export interface Facet {
  id: string;
  label: string;
  /** How many results carry this entry; omitted when the API sends no facets. */
  count?: number;
}

export const DEFAULT_FILTERS: ResultFilters = {
  categoryId: '',
  districtId: '',
  minPriceSar: null,
  maxPriceSar: null,
  minArea: null,
  maxArea: null,
  startDate: '',
  endDate: '',
  // The server's own default when a point arrives without a radius, so the
  // slider starts where an unfiltered search already is.
  radiusKm: 25,
};

/**
 * The filter rail (desktop) and bottom sheet (phone).
 *
 * Emits a whole `ResultFilters` on every change rather than one event per
 * control. The results page turns filters into a URL and a query; giving it a
 * complete object means it never has to merge partial updates, and the browser's
 * back button lands on a coherent set every time.
 */
@Component({
  selector: 'app-unit-filters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiRangeCalendar, UiRangeSlider],
  templateUrl: './unit-filters.html',
  styleUrl: './unit-filters.scss',
})
export class UnitFilters {
  protected readonly i18n = inject(LanguageService);

  readonly filters = input.required<ResultFilters>();
  readonly categories = input.required<readonly Facet[]>();
  /** Empty until a city is chosen — districts live inside their city. */
  readonly districts = input<readonly Facet[]>([]);
  /**
   * Whether the visitor has shared a location.
   *
   * The slider shows either way and moving it without one asks for the
   * location instead. It used to be hidden, because the API accepted a radius
   * with no point and silently ignored it — a control that appeared to work
   * and changed nothing. It answers 422 now, so the honest move is to show the
   * control and get it what it needs.
   */
  readonly hasLocation = input(false, { transform: booleanAttribute });
  /** Shown on the sheet's apply button. */
  readonly resultCount = input(0);
  /** The sheet adds a heading, a close control and an apply button. */
  readonly asSheet = input(false, { transform: booleanAttribute });

  readonly filtersChange = output<ResultFilters>();
  readonly cleared = output<void>();
  readonly applied = output<void>();
  /** Raised when the radius is moved with no point to measure from. */
  readonly locationNeeded = output<void>();

  protected setRadius(radiusKm: number): void {
    this.emit({ radiusKm });
    if (!this.hasLocation()) this.locationNeeded.emit();
  }

  protected setNumber(
    key: 'minPriceSar' | 'maxPriceSar' | 'minArea' | 'maxArea',
    event: Event,
  ): void {
    const raw = (event.target as HTMLInputElement).value.trim();
    // An empty box means "no bound", not zero — zero would exclude every result.
    this.emit({ [key]: raw === '' ? null : Number(raw) } as Partial<ResultFilters>);
  }

  /** Ticking the one already on turns it off, so "any category" stays reachable. */
  protected pickCategory(id: string): void {
    this.emit({ categoryId: this.filters().categoryId === id ? '' : id });
  }

  protected isPicked(id: string): boolean {
    return this.filters().categoryId === id;
  }

  protected pickDistrict(event: Event): void {
    this.emit({ districtId: (event.target as HTMLSelectElement).value });
  }

  /**
   * Both ends together or neither.
   *
   * A half-open range excludes nothing — the API answers 422 to one end on its
   * own for exactly that reason — so a half-picked range is cleared rather
   * than sent.
   */
  protected setRange(range: DateRange): void {
    const both = !!range.start && !!range.end;
    this.emit({ startDate: both ? range.start : '', endDate: both ? range.end : '' });
  }

  private emit(changes: Partial<ResultFilters>): void {
    this.filtersChange.emit({ ...this.filters(), ...changes });
  }
}

/** True when anything differs from the defaults — drives the "N" filter badge. */
export function countActiveFilters(filters: ResultFilters): number {
  let count = 0;
  if (filters.categoryId) count++;
  if (filters.districtId) count++;
  if (filters.minPriceSar !== null || filters.maxPriceSar !== null) count++;
  if (filters.minArea !== null || filters.maxArea !== null) count++;
  if (filters.startDate) count++;
  if (filters.radiusKm !== DEFAULT_FILTERS.radiusKm) count++;
  return count;
}
