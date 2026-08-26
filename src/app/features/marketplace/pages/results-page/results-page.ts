import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { sarToHalalas } from '@core/utils/money.utils';
import type { TranslationKey } from '@core/i18n/translations';
import type { PublicUnitQuery, PublicUnitSort } from '@core/models/public-unit';
import type { ReferenceItem } from '@core/models/unit.model';
import { ReferenceDataService } from '@core/services/reference-data.service';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';
import { ResultsMap } from '../../components/results-map/results-map';
import type { Facet, ResultFilters } from '../../components/unit-filters/unit-filters';
import {
  DEFAULT_FILTERS,
  UnitFilters,
  countActiveFilters,
} from '../../components/unit-filters/unit-filters';
import { UnitResultCard } from '../../components/unit-result-card/unit-result-card';
import { MarketplaceService } from '../../services/marketplace.service';

/** How the browser answered when we asked where the visitor is. */
type LocationState = 'off' | 'asking' | 'on' | 'refused';

/**
 * Search results (PUB-02, FR-MKT-03 → FR-MKT-08, FR-MKT-11).
 *
 * The URL is the state. Every filter, the sort and the date window live in the
 * query string, so a result set can be shared, bookmarked and reached again with
 * the back button — and the page has exactly one place to read its inputs from
 * rather than a signal tree that has to be kept in step with the address bar.
 *
 * The query string uses the API's own parameter names. It used to use its own,
 * and the translation between the two was a layer that could disagree with
 * itself; since an unrecognised parameter on this endpoint is a 422 rather than
 * something quietly ignored, one vocabulary is worth more than a tidier URL.
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

  protected readonly filters = signal<ResultFilters>({ ...DEFAULT_FILTERS });
  protected readonly cityId = signal('');
  protected readonly q = signal('');
  /**
   * Newest, not nearest.
   *
   * "الأقرب" needs a point and the API answers 422 without one, so it cannot be
   * the default a first-time visitor lands on — the opening screen has to
   * return results before anybody has chosen anything.
   */
  protected readonly sort = signal<PublicUnitSort>('newest');
  protected readonly point = signal<{ lat: number; lng: number } | null>(null);
  protected readonly locationState = signal<LocationState>('off');

  protected readonly units = this.marketplace.units;
  protected readonly isLoading = this.marketplace.isLoading;
  protected readonly total = this.marketplace.total;
  protected readonly hasMore = this.marketplace.hasMore;
  protected readonly remaining = this.marketplace.remaining;

  protected readonly failed = signal(false);
  protected readonly errorText = signal('');
  protected readonly hoveredId = signal<string | null>(null);
  protected readonly sheetOpen = signal(false);
  /** The map is a panel above the list, not a second column — see the template. */
  protected readonly mapOpen = signal(false);

  private readonly cities = signal<CityWithDistricts[]>([]);
  private readonly categories = signal<ReferenceItem[]>([]);

  /** How many days the chosen window covers, for the "10 أيام = …" line. */
  protected readonly days = computed(() => {
    const { startDate, endDate } = this.filters();
    if (!startDate || !endDate) return 0;
    const span = Date.parse(endDate) - Date.parse(startDate);
    return span > 0 ? Math.round(span / 86_400_000) : 0;
  });

  protected readonly sortOptions: readonly { value: PublicUnitSort; labelKey: TranslationKey }[] = [
    { value: 'newest', labelKey: 'results.sortNewest' },
    { value: 'priceAsc', labelKey: 'results.sortPriceAsc' },
    { value: 'priceDesc', labelKey: 'results.sortPriceDesc' },
    { value: 'nearest', labelKey: 'results.sortNearest' },
  ];

  protected readonly categoryFacets = computed<Facet[]>(() =>
    this.categories().map((item) => ({ id: item.id, label: this.i18n.pick(item) })),
  );

  /** Districts live inside their city, so there is nothing to offer without one. */
  protected readonly districtFacets = computed<Facet[]>(() => {
    const city = this.cities().find((item) => item.id === this.cityId());
    return (city?.districts ?? []).map((item) => ({ id: item.id, label: this.i18n.pick(item) }));
  });

  protected readonly cityLabel = computed(() => {
    const id = this.cityId();
    if (!id) return this.i18n.t('results.anyCity');
    return this.i18n.pick(this.cities().find((city) => city.id === id)) || id;
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
      'results.sortNewest',
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
    this.q.set('');
    this.pushQueryString();
  }

  protected setSort(value: PublicUnitSort): void {
    // "الأقرب" is offered only once there is somewhere to be near to; pressing
    // it without one asks for the location instead of running a doomed query.
    if (value === 'nearest' && !this.point()) {
      this.useMyLocation();
      return;
    }
    this.sort.set(value);
    this.pushQueryString();
  }

  protected setSearch(event: Event): void {
    this.q.set((event.target as HTMLInputElement).value);
  }

  protected submitSearch(event: Event): void {
    event.preventDefault();
    this.pushQueryString();
  }

  /**
   * Asks the browser where the visitor is, and only then offers "الأقرب" and
   * the radius.
   *
   * Nothing on this page needs it — the catalogue answers a query with no point
   * at all — so it is asked for at the moment it buys something, rather than on
   * arrival, where the prompt would be the first thing a visitor met.
   */
  protected useMyLocation(): void {
    if (!navigator.geolocation) {
      this.locationState.set('refused');
      return;
    }

    this.locationState.set('asking');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.point.set({
          // Six decimals is roughly a tenth of a metre and is all the API keeps.
          lat: round6(position.coords.latitude),
          lng: round6(position.coords.longitude),
        });
        this.locationState.set('on');
        this.sort.set('nearest');
        this.pushQueryString();
      },
      // Refused, unavailable and timed out are one case here: there is no
      // point, and the page carries on without one.
      () => this.locationState.set('refused'),
      { timeout: 10_000, maximumAge: 300_000 },
    );
  }

  protected forgetMyLocation(): void {
    this.point.set(null);
    this.locationState.set('off');
    if (this.sort() === 'nearest') this.sort.set('newest');
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
    this.marketplace.loadMore(this.query()).subscribe({ error: (error) => this.fail(error) });
  }

  protected fetch(): void {
    this.failed.set(false);
    this.marketplace.search(this.query()).subscribe({ error: (error) => this.fail(error) });
  }

  /**
   * The server's own message when it has one.
   *
   * Two of its rejections are about what was asked for rather than about the
   * request — a minimum above a maximum, coordinates the wrong way round — and
   * it explains both in Arabic. Replacing that with "حدث خطأ" would throw away
   * the only sentence that tells the visitor what to change.
   */
  private fail(error: unknown): void {
    const detail = (error as { details?: { message?: string }[] })?.details?.[0]?.message;
    const message = (error as { message?: string })?.message;
    this.errorText.set(detail ?? message ?? '');
    this.failed.set(true);
  }

  /** The filters as the endpoint's own parameters. */
  private query(): PublicUnitQuery {
    const filters = this.filters();
    const point = this.point();

    return {
      cityId: this.cityId() || undefined,
      districtId: filters.districtId || undefined,
      categoryId: filters.categoryId || undefined,
      q: this.q().trim() || undefined,
      // The one conversion: the panel holds riyals, the API takes halalas.
      minPrice: toHalalas(filters.minPriceSar),
      maxPrice: toHalalas(filters.maxPriceSar),
      minArea: filters.minArea ?? undefined,
      maxArea: filters.maxArea ?? undefined,
      lat: point?.lat,
      lng: point?.lng,
      radiusKm: point ? filters.radiusKm : undefined,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      sort: this.sort(),
    };
  }

  /**
   * Writes the state back to the URL, which re-enters this component through the
   * router and triggers the fetch. `replaceUrl` keeps a filter fiddle out of the
   * history stack — otherwise Back would walk through every slider position.
   */
  private pushQueryString(): void {
    const filters = this.filters();
    const point = this.point();

    void this.router
      .navigate([], {
        queryParams: {
          cityId: this.cityId() || null,
          districtId: filters.districtId || null,
          categoryId: filters.categoryId || null,
          q: this.q().trim() || null,
          minPrice: filters.minPriceSar,
          maxPrice: filters.maxPriceSar,
          minArea: filters.minArea,
          maxArea: filters.maxArea,
          lat: point?.lat ?? null,
          lng: point?.lng ?? null,
          radiusKm: point ? filters.radiusKm : null,
          startDate: filters.startDate || null,
          endDate: filters.endDate || null,
          sort: this.sort(),
        },
        replaceUrl: true,
      })
      .then(() => this.fetch());
  }

  private readQueryString(): void {
    const params = new URLSearchParams(this.router.url.split('?')[1] ?? '');

    this.cityId.set(params.get('cityId') ?? '');
    this.q.set(params.get('q') ?? '');

    const lat = numberOrNull(params.get('lat'));
    const lng = numberOrNull(params.get('lng'));
    if (lat !== null && lng !== null) {
      this.point.set({ lat, lng });
      this.locationState.set('on');
    }

    const sort = params.get('sort');
    if (isSort(sort)) {
      // A shared link asking for "الأقرب" with no point in it would 422; the
      // service falls back anyway, and this keeps the button honest too.
      this.sort.set(sort === 'nearest' && !this.point() ? 'newest' : sort);
    }

    this.filters.set({
      categoryId: params.get('categoryId') ?? '',
      districtId: params.get('districtId') ?? '',
      minPriceSar: numberOrNull(params.get('minPrice')),
      maxPriceSar: numberOrNull(params.get('maxPrice')),
      minArea: numberOrNull(params.get('minArea')),
      maxArea: numberOrNull(params.get('maxArea')),
      startDate: params.get('startDate') ?? '',
      endDate: params.get('endDate') ?? '',
      radiusKm: numberOrNull(params.get('radiusKm')) ?? DEFAULT_FILTERS.radiusKm,
    });
  }
}

/** `/public/cities` nests its districts, so there is no second request. */
interface CityWithDistricts extends ReferenceItem {
  districts?: ReferenceItem[];
}

function isSort(value: string | null): value is PublicUnitSort {
  return value === 'newest' || value === 'nearest' || value === 'priceAsc' || value === 'priceDesc';
}

function numberOrNull(raw: string | null): number | null {
  if (raw === null || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** A riyal figure from the filter panel, as the halalas the API expects. */
function toHalalas(sar: number | null): number | undefined {
  return sar === null ? undefined : sarToHalalas(sar);
}
