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
  maxDistanceKm: number;
  /**
   * Riyals, not halalas: this is what somebody typed into a box, and a filter
   * panel holding 7500 for "75" would be a trap for the next person to touch
   * it. `results-page` converts once, where the filters become a query.
   */
  minPriceSar: number | null;
  maxPriceSar: number | null;
  minArea: number | null;
  maxArea: number | null;
  categoryIds: string[];
  availableFrom: string;
  availableTo: string;
}

export interface CategoryFacet {
  id: string;
  label: string;
  /** How many results carry this category; omitted when the API sends no facets. */
  count?: number;
}

export const DEFAULT_FILTERS: ResultFilters = {
  maxDistanceKm: 10,
  minPriceSar: null,
  maxPriceSar: null,
  minArea: null,
  maxArea: null,
  categoryIds: [],
  availableFrom: '',
  availableTo: '',
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
  readonly categories = input.required<readonly CategoryFacet[]>();
  /** Shown on the sheet's apply button. */
  readonly resultCount = input(0);
  /** The sheet adds a heading, a close control and an apply button. */
  readonly asSheet = input(false, { transform: booleanAttribute });

  readonly filtersChange = output<ResultFilters>();
  readonly cleared = output<void>();
  readonly applied = output<void>();

  protected setDistance(maxDistanceKm: number): void {
    this.emit({ maxDistanceKm });
  }

  protected setNumber(
    key: 'minPriceSar' | 'maxPriceSar' | 'minArea' | 'maxArea',
    event: Event,
  ): void {
    const raw = (event.target as HTMLInputElement).value.trim();
    // An empty box means "no bound", not zero — zero would exclude every result.
    this.emit({ [key]: raw === '' ? null : Number(raw) } as Partial<ResultFilters>);
  }

  protected toggleCategory(id: string): void {
    const current = this.filters().categoryIds;
    this.emit({
      categoryIds: current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    });
  }

  protected isPicked(id: string): boolean {
    return this.filters().categoryIds.includes(id);
  }

  protected setRange(range: DateRange): void {
    this.emit({ availableFrom: range.start, availableTo: range.end });
  }

  private emit(changes: Partial<ResultFilters>): void {
    this.filtersChange.emit({ ...this.filters(), ...changes });
  }
}

/** True when anything differs from the defaults — drives the "N" filter badge. */
export function countActiveFilters(filters: ResultFilters): number {
  let count = 0;
  if (filters.maxDistanceKm !== DEFAULT_FILTERS.maxDistanceKm) count++;
  if (filters.minPriceSar !== null || filters.maxPriceSar !== null) count++;
  if (filters.minArea !== null || filters.maxArea !== null) count++;
  if (filters.categoryIds.length > 0) count++;
  if (filters.availableFrom) count++;
  return count;
}
