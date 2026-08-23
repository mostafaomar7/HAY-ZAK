import { HttpContext } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { APP } from '@core/constants/app.constants';
import { SKIP_AUTH } from '@core/interceptors/auth.interceptor';
import type { PaginatedResponse } from '@core/models/api-response.model';
import type { Unit, UnitAvailabilityBlock, UnitSearchParams } from '@core/models/unit.model';
import { ApiService } from '@core/services/api.service';

/**
 * The public catalogue (FR-MKT).
 *
 * Every call opts out of the auth header: browsing and search must work for a
 * signed-out visitor (FR-MKT-02, design rule 1), and sending a stale token to a
 * public endpoint is how a guest ends up bounced to a login screen.
 *
 * Results accumulate rather than replace when `loadMore` is used, because the
 * design pages the list with "اعرض 12 مساحة إضافية" rather than page numbers.
 */
@Injectable()
export class MarketplaceService {
  private readonly api = inject(ApiService);

  private readonly context = new HttpContext().set(SKIP_AUTH, true);

  private readonly items = signal<Unit[]>([]);
  private readonly loading = signal(false);
  private readonly totalCount = signal(0);
  private readonly page = signal(1);

  readonly units = this.items.asReadonly();
  readonly isLoading = this.loading.asReadonly();
  readonly total = this.totalCount.asReadonly();

  readonly hasMore = computed(() => this.items().length < this.totalCount());
  readonly remaining = computed(() =>
    Math.min(APP.pageSize, Math.max(0, this.totalCount() - this.items().length)),
  );

  /** Runs a fresh query and replaces the list. */
  search(params: UnitSearchParams): Observable<PaginatedResponse<Unit>> {
    this.page.set(1);
    return this.fetch(params, 1, false);
  }

  /** Appends the next page — the list keeps everything already on screen. */
  loadMore(params: UnitSearchParams): Observable<PaginatedResponse<Unit>> {
    const next = this.page() + 1;
    this.page.set(next);
    return this.fetch(params, next, true);
  }

  byId(id: string): Observable<Unit> {
    return this.api.get<Unit>(API_ENDPOINTS.marketplace.unitById(id), { context: this.context });
  }

  /**
   * FR-UNT-08 — the blocked windows the booking calendar has to grey out. A unit
   * that is booked for part of the period is still listed; only the dates go.
   */
  availability(id: string): Observable<UnitAvailabilityBlock[]> {
    return this.api.get<UnitAvailabilityBlock[]>(API_ENDPOINTS.marketplace.unitAvailability(id), {
      context: this.context,
    });
  }

  similar(id: string): Observable<Unit[]> {
    return this.api.get<Unit[]>(API_ENDPOINTS.marketplace.similarUnits(id), {
      context: this.context,
    });
  }

  private fetch(
    params: UnitSearchParams,
    pageNumber: number,
    append: boolean,
  ): Observable<PaginatedResponse<Unit>> {
    this.loading.set(true);

    return this.api
      .get<PaginatedResponse<Unit>>(API_ENDPOINTS.marketplace.search, {
        context: this.context,
        params: { ...params, pageNumber, pageSize: params.pageSize ?? APP.pageSize },
      })
      .pipe(
        tap({
          next: (result) => {
            this.items.update((current) => (append ? [...current, ...result.items] : result.items));
            this.totalCount.set(result.totalCount);
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        }),
      );
  }
}
