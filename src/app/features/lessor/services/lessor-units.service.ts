import { Injectable, computed, inject, signal } from '@angular/core';
import type { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { APP } from '@core/constants/app.constants';
import { PUBLIC_UNIT_STATUSES, UnitStatus } from '@core/enums/unit-status.enum';
import type { PaginatedResponse } from '@core/models/api-response.model';
import type {
  WireAvailabilityBlock,
  WireUnit,
  WireUnitImage,
  WireUnitRequest,
} from '@core/models/unit-wire';
import { blockFromWire, imageFromWire, unitFromWire, unitToWire } from '@core/models/unit-wire';
import type { Unit, UnitAvailabilityBlock, UnitImage, UnitRequest } from '@core/models/unit.model';
import { ApiService } from '@core/services/api.service';

/** A unit and its calendar — one response, so one type. */
export interface LessorUnitDetail {
  unit: Unit;
  availability: UnitAvailabilityBlock[];
}

/**
 * Owns the lessor's "My spaces" data (FR-LSR-04). Holds the list in a signal so
 * the page, the dashboard counters and the requests screen all read one source
 * and stay consistent after an edit.
 *
 * Everything here goes through `unit-wire.ts`. The API's unit is not the
 * application's — dates, visiting hours and image URLs all differ — and doing
 * the conversion at the one place requests are made is what keeps every screen
 * from having to know.
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
      booked: units.filter((u) => u.isFullyBooked).length,
      pendingReview: units.filter((u) => u.status === UnitStatus.PendingReview).length,
      rejected: units.filter((u) => u.status === UnitStatus.Rejected).length,
      drafts: units.filter((u) => u.status === UnitStatus.Draft).length,
    };
  });

  /**
   * One page of the lessor's own units.
   *
   * `pageSize`, never `limit` — the server answers 422 for the latter, which is
   * the right answer: a page size that is quietly ignored looks like it worked
   * while returning twelve rows where two were asked for.
   */
  load(status?: UnitStatus, page = 1): Observable<PaginatedResponse<Unit>> {
    this.loading.set(true);
    return this.api
      .list<WireUnit>(API_ENDPOINTS.lessor.units, {
        params: { status, page, pageSize: APP.pageSize },
      })
      .pipe(
        map((response) => ({ ...response, items: response.items.map(unitFromWire) })),
        tap({
          next: (result) => {
            this.items.set(result.items);
            this.totalCount.set(result.pagination.total);
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        }),
      );
  }

  /**
   * The unit and its calendar, in one request.
   *
   * There is no separate availability endpoint: the blocks arrive nested in the
   * detail. Two requests would have been two chances for the page to render a
   * unit beside somebody else's calendar.
   */
  detail(id: string): Observable<LessorUnitDetail> {
    return this.api.get<WireUnit>(API_ENDPOINTS.lessor.unitById(id)).pipe(map(toDetail));
  }

  byId(id: string): Observable<Unit> {
    return this.detail(id).pipe(map((detail) => detail.unit));
  }

  /**
   * FR-UNT-07 — a new unit starts as a draft, never published. Saving early and
   * often is deliberate: SRS §2.2 requires the journey to survive interruption.
   */
  createDraft(payload: Partial<UnitRequest>): Observable<Unit> {
    return this.api
      .post<WireUnit, Partial<WireUnitRequest>>(API_ENDPOINTS.lessor.units, unitToWire(payload))
      .pipe(map(unitFromWire), tap(this.upsert));
  }

  /** PATCH, not PUT: the server takes the changed fields and keeps the rest. */
  update(id: string, payload: Partial<UnitRequest>): Observable<Unit> {
    return this.api
      .patch<WireUnit, Partial<WireUnitRequest>>(
        API_ENDPOINTS.lessor.unitById(id),
        unitToWire(payload),
      )
      .pipe(map(unitFromWire), tap(this.upsert));
  }

  /**
   * Moves the unit to PENDING_REVIEW — it does not appear publicly until an
   * administrator approves it.
   *
   * Refused with `UNIT_IMAGES_REQUIRED` under `APP.unitImages.min` images. The
   * form checks the same number before enabling the button, so the lessor is
   * told while they can still add one.
   */
  submitForReview(id: string): Observable<Unit> {
    return this.api
      .post<WireUnit>(API_ENDPOINTS.lessor.submitUnit(id))
      .pipe(map(unitFromWire), tap(this.upsert));
  }

  /** There is no delete. Bookings reference the unit, so it is archived. */
  archive(id: string): Observable<Unit> {
    return this.api
      .post<WireUnit>(API_ENDPOINTS.lessor.archiveUnit(id))
      .pipe(map(unitFromWire), tap(this.upsert));
  }

  /** FR-LSR-07 — suspension is a request, not a direct action. */
  requestSuspension(id: string, reason: string): Observable<void> {
    return this.api.post<void>(API_ENDPOINTS.lessor.requestUnitSuspension(id), { reason });
  }

  /**
   * FR-UNT-02/03 — all the files in one request.
   *
   * One call rather than one per file: the endpoint takes several under the
   * field name `images` and answers with the unit's complete image list, so the
   * order the server assigned is what comes back. Parallel single-file uploads
   * would race for `sortOrder`.
   */
  uploadImages(unitId: string, files: readonly File[]): Observable<UnitImage[]> {
    const form = new FormData();
    for (const file of files) form.append('images', file, file.name);

    return this.api
      .upload<{ images: WireUnitImage[] }>(API_ENDPOINTS.lessor.unitImages(unitId), form)
      .pipe(map((result) => result.images.map(imageFromWire)));
  }

  deleteImage(unitId: string, imageId: string): Observable<void> {
    return this.api.delete<void>(API_ENDPOINTS.lessor.unitImageById(unitId, imageId));
  }

  /**
   * FR-UNT-08 — a manual block by the lessor, outside any booking.
   *
   * Plain `YYYY-MM-DD` and half-open: `endDate` is the first free day again, so
   * a block ending on the 10th and one starting on the 10th do not collide.
   * Overlapping an existing block or a booking is `UNIT_DATES_UNAVAILABLE`.
   */
  blockDates(
    unitId: string,
    startDate: string,
    endDate: string,
    note?: string,
  ): Observable<UnitAvailabilityBlock> {
    return this.api
      .post<WireAvailabilityBlock>(API_ENDPOINTS.lessor.unitBlocks(unitId), {
        startDate,
        endDate,
        note,
      })
      .pipe(map(blockFromWire));
  }

  /** Releases a manual block. A booking's block is not the lessor's to remove. */
  unblockDates(unitId: string, blockId: string): Observable<void> {
    return this.api.delete<void>(API_ENDPOINTS.lessor.unitBlockById(unitId, blockId));
  }

  private readonly upsert = (unit: Unit): void => {
    this.items.update((list) => {
      const index = list.findIndex((u) => u.id === unit.id);
      if (index === -1) return [unit, ...list];
      const next = [...list];
      next[index] = unit;
      return next;
    });
  };
}

function toDetail(wire: WireUnit): LessorUnitDetail {
  return {
    unit: unitFromWire(wire),
    availability: (wire.availability ?? []).map(blockFromWire),
  };
}

/** FR-UNT-10 — price and deletion lock while a live booking exists. */
export function isUnitEditable(unit: Unit): boolean {
  return unit.status !== UnitStatus.Archived;
}

/**
 * FR-UNT-10 — the price is frozen while the unit is fully committed.
 *
 * The API is the authority and refuses the PATCH regardless; this only keeps
 * the field from inviting an edit that would be rejected.
 */
export function isUnitPriceLocked(unit: Unit): boolean {
  return unit.isFullyBooked === true;
}

export function isUnitVisiblePublicly(unit: Unit): boolean {
  return PUBLIC_UNIT_STATUSES.includes(unit.status);
}
