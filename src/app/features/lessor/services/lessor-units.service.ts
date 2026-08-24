import { HttpContext } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { APP } from '@core/constants/app.constants';
import { PUBLIC_UNIT_STATUSES, UnitStatus } from '@core/enums/unit-status.enum';
import { SKIP_ERROR_TOAST } from '@core/interceptors/error.interceptor';
import type { PaginatedResponse } from '@core/models/api-response.model';
import type { Unit, UnitAvailabilityBlock, UnitImage, UnitRequest } from '@core/models/unit.model';
import { ApiService } from '@core/services/api.service';
import { toFormData } from '@core/utils/object.utils';

/**
 * Owns the lessor's "My spaces" data (FR-LSR-04). Holds the list in a signal so
 * the page, the dashboard counters and the requests screen all read one source
 * and stay consistent after an edit.
 */
@Injectable()
export class LessorUnitsService {
  private readonly api = inject(ApiService);

  private readonly items = signal<Unit[]>([]);
  private readonly loading = signal(false);
  private readonly totalCount = signal(0);

  readonly units = this.items.asReadonly();
  readonly isLoading = this.loading.asReadonly();
  readonly total = this.totalCount.asReadonly();

  /** FR-LSR-01 — the counters the dashboard shows, derived not re-fetched. */
  readonly counts = computed(() => {
    const units = this.items();
    return {
      total: units.length,
      available: units.filter((u) => u.status === UnitStatus.Published).length,
      booked: units.filter((u) => u.status === UnitStatus.FullyBooked).length,
      pendingReview: units.filter((u) => u.status === UnitStatus.PendingReview).length,
      rejected: units.filter((u) => u.status === UnitStatus.Rejected).length,
      drafts: units.filter((u) => u.status === UnitStatus.Draft).length,
    };
  });

  load(status?: UnitStatus, page = 1): Observable<PaginatedResponse<Unit>> {
    this.loading.set(true);
    return this.api
      .list<Unit>(API_ENDPOINTS.lessor.units, {
        params: { status, page, limit: APP.pageSize },
      })
      .pipe(
        tap({
          next: (page) => {
            this.items.set(page.items);
            this.totalCount.set(page.pagination.total);
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        }),
      );
  }

  byId(id: string): Observable<Unit> {
    return this.api.get<Unit>(API_ENDPOINTS.units.byId(id));
  }

  /**
   * FR-UNT-07 — a new unit starts as a draft, never published. Saving early and
   * often is deliberate: SRS §2.2 requires the journey to survive interruption.
   */
  createDraft(payload: Partial<UnitRequest>): Observable<Unit> {
    return this.api
      .post<Unit, Partial<UnitRequest>>(API_ENDPOINTS.units.base, payload)
      .pipe(tap((unit) => this.upsert(unit)));
  }

  update(id: string, payload: Partial<UnitRequest>): Observable<Unit> {
    return this.api
      .put<Unit, Partial<UnitRequest>>(API_ENDPOINTS.units.byId(id), payload)
      .pipe(tap((unit) => this.upsert(unit)));
  }

  /** Moves the unit to PendingReview — it does not appear publicly until approved. */
  submitForReview(id: string): Observable<Unit> {
    return this.api
      .post<Unit>(API_ENDPOINTS.units.submitForReview(id))
      .pipe(tap((unit) => this.upsert(unit)));
  }

  archive(id: string): Observable<Unit> {
    return this.api
      .post<Unit>(API_ENDPOINTS.units.archive(id))
      .pipe(tap((unit) => this.upsert(unit)));
  }

  /** FR-LSR-07 — suspension is a request, not a direct action. */
  requestSuspension(id: string, reason: string): Observable<void> {
    return this.api.post<void>(API_ENDPOINTS.units.requestSuspension(id), { reason });
  }

  /** FR-UNT-02/03 — validate count and size client-side before spending bandwidth. */
  uploadImage(unitId: string, file: File): Observable<UnitImage> {
    return this.api.upload<UnitImage>(API_ENDPOINTS.units.images(unitId), toFormData({ file }));
  }

  deleteImage(unitId: string, imageId: string): Observable<void> {
    return this.api.delete<void>(API_ENDPOINTS.units.imageById(unitId, imageId));
  }

  /** FR-UNT-08 — the availability calendar, not a binary flag. */
  availability(unitId: string): Observable<UnitAvailabilityBlock[]> {
    return this.api.get<UnitAvailabilityBlock[]>(API_ENDPOINTS.units.availability(unitId));
  }

  /** Manual date block by the lessor, outside any booking. */
  blockDates(
    unitId: string,
    startDate: string,
    endDate: string,
  ): Observable<UnitAvailabilityBlock> {
    return this.api.post<UnitAvailabilityBlock>(API_ENDPOINTS.units.availability(unitId), {
      startDate,
      endDate,
    });
  }

  /**
   * Silent check used to decide whether to offer "Add a space" at all — the
   * toast would be noise on a page load (FR-LSR-03 is enforced server-side).
   */
  canPublish(): Observable<{ allowed: boolean; reasons: string[] }> {
    return this.api.get<{ allowed: boolean; reasons: string[] }>(
      `${API_ENDPOINTS.lessor.units}/publish-eligibility`,
      { context: new HttpContext().set(SKIP_ERROR_TOAST, true) },
    );
  }

  private upsert(unit: Unit): void {
    this.items.update((list) => {
      const index = list.findIndex((u) => u.id === unit.id);
      if (index === -1) return [unit, ...list];
      const next = [...list];
      next[index] = unit;
      return next;
    });
  }
}

/** FR-UNT-10 — price and deletion lock while a live booking exists. */
export function isUnitEditable(unit: Unit): boolean {
  return unit.status !== UnitStatus.Archived;
}

export function isUnitPriceLocked(unit: Unit): boolean {
  return unit.status === UnitStatus.FullyBooked;
}

export function isUnitVisiblePublicly(unit: Unit): boolean {
  return PUBLIC_UNIT_STATUSES.includes(unit.status);
}
