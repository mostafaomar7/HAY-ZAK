import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { sarToHalalas } from '@core/utils/money.utils';
import type { TranslationKey } from '@core/i18n/translations';
import type { ReferenceItem, UnitSearchParams, UnitSortOption } from '@core/models/unit.model';
import { ReferenceDataService } from '@core/services/reference-data.service';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';
import { ResultsMap } from '../../components/results-map/results-map';
import type { CategoryFacet, ResultFilters } from '../../components/unit-filters/unit-filters';
import {
  DEFAULT_FILTERS,
  UnitFilters,
  countActiveFilters,
} from '../../components/unit-filters/unit-filters';
import { UnitResultCard } from '../../components/unit-result-card/unit-result-card';
import { MarketplaceService } from '../../services/marketplace.service';

/**
 * Search results (PUB-02, FR-MKT-03 → FR-MKT-08, FR-MKT-11).
 *
 * The URL is the state. Every filter, the sort and the date window live in the
 * query string, so a result set can be shared, bookmarked and reached again with
 * the back button — and the page has exactly one place to read its inputs from
 * rather than a signal tree that has to be kept in step with the address bar.
 *
 * Open to guests: nothing here is guarded (FR-MKT-02, design rule 1).
 */
@Component({
  selector: 'app-results-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MarketplaceService],
  imports: [
    RouterLink,
    ResultsMap,
    UiButton,
    UiEmptyState,
    UiSkeleton,
    UnitFilters,
    UnitResultCard,
  ],
  templateUrl: './results-page.html',
  styleUrl: './results-page.scss',
})
export class ResultsPage {
  private readonly marketplace = inject(MarketplaceService);
  private readonly reference = inject(ReferenceDataService);
  private readonly router = inject(Router);

  protected readonly i18n = inject(LanguageService);

  // Bound from the query string by withComponentInputBinding.
  protected readonly filters = signal<ResultFilters>({ ...DEFAULT_FILTERS });
  protected readonly cityId = signal('');
  protected readonly sort = signal<UnitSortOption>('nearest');

  protected readonly units = this.marketplace.units;
  protected readonly isLoading = this.marketplace.isLoading;
  protected readonly total = this.marketplace.total;
  protected readonly hasMore = this.marketplace.hasMore;
  protected readonly remaining = this.marketplace.remaining;

  protected readonly failed = signal(false);
  protected readonly hoveredId = signal<string | null>(null);
  protected readonly sheetOpen = signal(false);
  /** The map is a panel above the list, not a second column — see the template. */
  protected readonly mapOpen = signal(false);
  protected readonly days = signal(0);

  private readonly cities = signal<ReferenceItem[]>([]);
  private readonly categories = signal<ReferenceItem[]>([]);

  protected readonly sortOptions: readonly { value: UnitSortOption; labelKey: TranslationKey }[] = [
    { value: 'nearest', labelKey: 'results.sortNearest' },
    { value: 'priceAsc', labelKey: 'results.sortPriceAsc' },
    { value: 'newest', labelKey: 'results.sortNewest' },
  ];

  protected readonly categoryFacets = computed<CategoryFacet[]>(() =>
    this.categories().map((item) => ({
      id: item.id,
      label: item.name,
      // Counted from what is on screen. Real facet counts need the server to
      // send them — until then, showing a wrong number would be worse than none.
      count: undefined,
    })),
  );

  protected readonly cityLabel = computed(() => {
    const id = this.cityId();
    if (!id) return this.i18n.t('results.anyCity');
    return this.cities().find((city) => city.id === id)?.name ?? id;
  });

  protected readonly heading = computed(() =>
    this.cityId()
      ? this.i18n.t('results.countIn', { count: this.total(), city: this.cityLabel() })
      : this.i18n.t('results.count', { count: this.total() }),
  );

  protected readonly activeFilterCount = computed(() => countActiveFilters(this.filters()));

  protected readonly sortLabel = computed(
    () =>
      this.sortOptions.find((option) => option.value === this.sort())?.labelKey ??
      'results.sortNearest',
  );

  constructor() {
    this.reference.cities().subscribe({
      next: (list) => this.cities.set(list),
      error: () => this.cities.set([]),
    });
    this.reference.categories().subscribe({
      next: (list) => this.categories.set(list),
      error: () => this.categories.set([]),
    });

    this.readQueryString();
    this.fetch();
  }

  protected onFilters(filters: ResultFilters): void {
    this.filters.set(filters);
    this.pushQueryString();
  }

  protected clearFilters(): void {
    this.filters.set({ ...DEFAULT_FILTERS });
    this.pushQueryString();
  }

  protected setSort(value: UnitSortOption): void {
    this.sort.set(value);
    this.pushQueryString();
  }

  protected applySheet(): void {
    this.sheetOpen.set(false);
    this.pushQueryString();
  }

  protected toggleSheet(): void {
    this.sheetOpen.update((open) => !open);
  }

  protected showMap(open: boolean): void {
    this.mapOpen.set(open);
  }

  protected setHovered(id: string | null): void {
    this.hoveredId.set(id);
  }

  protected loadMore(): void {
    this.marketplace
      .loadMore(this.searchParams())
      .subscribe({ error: () => this.failed.set(true) });
  }

  protected fetch(): void {
    this.failed.set(false);
    this.marketplace.search(this.searchParams()).subscribe({ error: () => this.failed.set(true) });
  }

  private searchParams(): UnitSearchParams {
    const filters = this.filters();
    return {
      cityId: this.cityId() || undefined,
      categoryIds: filters.categoryIds.length ? filters.categoryIds : undefined,
      radiusKm: filters.maxDistanceKm,
      // The one conversion: the panel holds riyals, the API takes halalas.
      minPriceHalalas: toHalalas(filters.minPriceSar),
      maxPriceHalalas: toHalalas(filters.maxPriceSar),
      minArea: filters.minArea ?? undefined,
      maxArea: filters.maxArea ?? undefined,
      availableFrom: filters.availableFrom || undefined,
      availableTo: filters.availableTo || undefined,
      sortBy: this.sort(),
    };
  }

  /**
   * Writes the state back to the URL, which re-enters this component through the
   * router and triggers the fetch. `replaceUrl` keeps a filter fiddle out of the
   * history stack — otherwise Back would walk through every slider position.
   */
  private pushQueryString(): void {
    const filters = this.filters();

    void this.router
      .navigate([], {
        queryParams: {
          cityId: this.cityId() || null,
          categoryId: filters.categoryIds.length ? filters.categoryIds : null,
          radiusKm: filters.maxDistanceKm,
          minPrice: filters.minPriceSar,
          maxPrice: filters.maxPriceSar,
          minArea: filters.minArea,
          maxArea: filters.maxArea,
          availableFrom: filters.availableFrom || null,
          availableTo: filters.availableTo || null,
          days: this.days() || null,
          sortBy: this.sort(),
        },
        replaceUrl: true,
      })
      .then(() => this.fetch());
  }

  private readQueryString(): void {
    const params = new URLSearchParams(this.router.url.split('?')[1] ?? '');

    this.cityId.set(params.get('cityId') ?? '');
    this.days.set(Number(params.get('days') ?? 0) || 0);

    const sort = params.get('sortBy');
    if (sort === 'nearest' || sort === 'priceAsc' || sort === 'newest') this.sort.set(sort);

    this.filters.set({
      maxDistanceKm: Number(params.get('radiusKm') ?? DEFAULT_FILTERS.maxDistanceKm),
      minPriceSar: numberOrNull(params.get('minPrice')),
      maxPriceSar: numberOrNull(params.get('maxPrice')),
      minArea: numberOrNull(params.get('minArea')),
      maxArea: numberOrNull(params.get('maxArea')),
      categoryIds: params.getAll('categoryId'),
      availableFrom: params.get('availableFrom') ?? '',
      availableTo: params.get('availableTo') ?? '',
    });
  }
}

function numberOrNull(raw: string | null): number | null {
  if (raw === null || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** A riyal figure from the filter panel, as the halalas the API expects. */
function toHalalas(sar: number | null): number | undefined {
  return sar === null ? undefined : sarToHalalas(sar);
}
