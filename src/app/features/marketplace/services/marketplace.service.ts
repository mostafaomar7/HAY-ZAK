import { HttpContext } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import type { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { APP } from '@core/constants/app.constants';
import { SKIP_AUTH } from '@core/interceptors/auth.interceptor';
import type { PaginatedResponse } from '@core/models/api-response.model';
import type {
  PublicUnit,
  PublicUnitQuery,
  PublicUnitSummary,
  WirePublicUnit,
  WirePublicUnitDetail,
} from '@core/models/public-unit';
import { publicUnitFromWire, publicUnitSummaryFromWire } from '@core/models/public-unit';
import { ApiService } from '@core/services/api.service';

/**
 * The public catalogue (FR-MKT).
 *
 * Every call opts out of the auth header. Browsing and search must work for a
 * signed-out visitor (FR-MKT-02, design rule 1), and the stronger reason is
 * that a guest and a signed-in visitor have to receive the same answer — a
 * bearer on a public route is how that quietly stops being true.
 *
 * Results accumulate rather than replace when `loadMore` is used, because the
 * design pages the list with "اعرض 12 مساحة إضافية" rather than page numbers.
 */
@Injectable()
export class MarketplaceService {
  private readonly api = inject(ApiService);

  private readonly context = new HttpContext().set(SKIP_AUTH, true);

  private readonly items = signal<PublicUnitSummary[]>([]);
  private readonly loading = signal(false);
  private readonly totalCount = signal(0);
  private readonly page = signal(1);
  private readonly more = signal(false);

  readonly units = this.items.asReadonly();
  readonly isLoading = this.loading.asReadonly();
  readonly total = this.totalCount.asReadonly();

  /**
   * The server's own flag, not `loaded < total`.
   *
   * A total that moves between pages — a unit published or unpublished while
   * someone is scrolling — makes a length comparison either hide a page that
   * exists or offer one that does not. `hasNextPage` cannot.
   */
  readonly hasMore = this.more.asReadonly();
  readonly remaining = computed(() =>
    Math.min(APP.pageSize, Math.max(0, this.totalCount() - this.items().length)),
  );

  /** Runs a fresh query and replaces the list. */
  search(query: PublicUnitQuery): Observable<PaginatedResponse<PublicUnitSummary>> {
    this.page.set(1);
    return this.fetch(query, 1, false);
  }

  /** Appends the next page — the list keeps everything already on screen. */
  loadMore(query: PublicUnitQuery): Observable<PaginatedResponse<PublicUnitSummary>> {
    const next = this.page() + 1;
    this.page.set(next);
    return this.fetch(query, next, true);
  }

  byId(id: string): Observable<PublicUnit> {
    return this.api
      .get<WirePublicUnitDetail>(API_ENDPOINTS.public.unitById(id), { context: this.context })
      .pipe(map((payload) => publicUnitFromWire(payload.unit)));
  }

  private fetch(
    query: PublicUnitQuery,
    page: number,
    append: boolean,
  ): Observable<PaginatedResponse<PublicUnitSummary>> {
    this.loading.set(true);

    return this.api
      .list<WirePublicUnit>(API_ENDPOINTS.public.units, {
        context: this.context,
        params: {
          // Spread first, then pin the paging: `query` is built from a URL and
          // an unknown key on this endpoint is a 422 rather than a silent drop.
          ...toParams(query),
          page,
          pageSize: query.pageSize ?? APP.pageSize,
        },
      })
      .pipe(
        map((result) => ({
          items: result.items.map(publicUnitSummaryFromWire),
          pagination: result.pagination,
        })),
        tap({
          next: (result) => {
            this.items.update((current) => (append ? [...current, ...result.items] : result.items));
            this.totalCount.set(result.pagination.total);
            this.more.set(result.pagination.hasNextPage);
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        }),
      );
  }
}

/**
 * The query, reduced to what the endpoint accepts and to combinations it will
 * take. Three rules the server enforces with a 422, applied here so a visitor
 * fiddling with filters never sees one:
 *
 *  - `sort=nearest` without a point is meaningless, so it falls back to newest.
 *  - `lat`/`lng` travel together, and `radiusKm` is dropped without them.
 *  - `startDate`/`endDate` travel together; one end of a range excludes nothing.
 *
 * `q` is held back below two characters for the same reason. The remaining
 * 422s — swapped coordinates, a minimum above a maximum — are real mistakes in
 * what was asked for, and belong in front of the person who asked.
 */
function toParams(query: PublicUnitQuery): Record<string, string | number | undefined> {
  const hasPoint = query.lat !== undefined && query.lng !== undefined;
  const hasRange = !!query.startDate && !!query.endDate;
  const q = query.q?.trim();

  return {
    cityId: query.cityId || undefined,
    districtId: query.districtId || undefined,
    categoryId: query.categoryId || undefined,
    q: q && q.length >= 2 ? q.slice(0, 80) : undefined,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    minArea: query.minArea,
    maxArea: query.maxArea,
    lat: hasPoint ? query.lat : undefined,
    lng: hasPoint ? query.lng : undefined,
    radiusKm: hasPoint ? query.radiusKm : undefined,
    startDate: hasRange ? query.startDate : undefined,
    endDate: hasRange ? query.endDate : undefined,
    sort: query.sort === 'nearest' && !hasPoint ? 'newest' : query.sort,
  };
}
