import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import type { ApiError } from '@core/models/api-error.model';
import type {
  ReferenceData,
  ReferenceKind,
  ReferenceRequest,
  ReferenceRow,
  WireReferenceData,
} from '@core/models/reference-admin';
import { referenceDataFromWire, requestFor } from '@core/models/reference-admin';
import { ApiService } from '@core/services/api.service';

/**
 * The reference lists (FR-ADM-05) — `reference:manage`, held by the system
 * administrator and the operations supervisor.
 *
 * **There is no delete, and there is no method for one.** Everything is
 * deactivated instead, because listings and bookings written years ago still
 * have to read correctly. The absence of the verb here is the enforcement on
 * this side; the absence of the route is the enforcement on the other.
 *
 * All four lists come back in one call, active and inactive together. That is
 * not an optimisation — the screen edits them side by side, and four requests
 * would mean four chances for the districts on screen to belong to a city list
 * that has since changed.
 */
@Injectable()
export class AdminReferenceService {
  private readonly api = inject(ApiService);

  all(): Observable<ReferenceData> {
    return this.api
      .get<WireReferenceData>(API_ENDPOINTS.admin.reference)
      .pipe(map(referenceDataFromWire));
  }

  create<T extends ReferenceRequest>(kind: ReferenceKind, request: T): Observable<void> {
    return this.api.post<void, T>(API_ENDPOINTS.admin.referenceKind(kind), request);
  }

  /**
   * **A full replace, not a patch.**
   *
   * This used to be typed and documented as a partial, and it is not: the
   * endpoint answers `{ isActive: false }` with a 422 naming `nameAr` and
   * `nameEn`, and a district's `cityId` besides. The request must therefore
   * carry the whole entry, which `requestFor()` builds from the row.
   */
  update<T extends ReferenceRequest>(
    kind: ReferenceKind,
    id: string,
    request: T,
  ): Observable<void> {
    return this.api.put<void, T>(API_ENDPOINTS.admin.referenceItem(kind, id), request);
  }

  /**
   * Turning an entry off, which is the strongest thing that can happen to one.
   *
   * Takes the **row**, not an id: the update replaces the entry, so everything
   * it already had has to go back with the flag. Sending the flag alone is what
   * made this fail on the cities, the districts and the prohibited items —
   * every tab except the one whose form happened to resend its fields.
   *
   * A category with published listings under it refuses even this — see
   * `listingsBlockingDeactivation`.
   */
  setActive(kind: ReferenceKind, row: ReferenceRow, isActive: boolean): Observable<void> {
    return this.update(kind, row.id, requestFor(row, { isActive }));
  }
}

/**
 * How many published listings are standing in the way, or null for any other
 * failure.
 *
 * The count is the entire useful content of a 409 `CATEGORY_IN_USE`: it turns
 * "could not deactivate" into "31 published listings are under this category",
 * which tells an operator what to do next instead of that something went
 * wrong.
 */
export function listingsBlockingDeactivation(error: ApiError): number | null {
  if (error.code !== 'CATEGORY_IN_USE') return null;
  return error.metaNumber('requested') ?? null;
}
