import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { forkJoin } from 'rxjs';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import type { PaginatedResponse } from '@core/models/api-response.model';
import type {
  ListingReviewDetail,
  ListingReviewRow,
  ReviewDecision,
} from '@core/models/admin.model';
import { ApiService } from '@core/services/api.service';

/**
 * The listing review queue (FR-UNT-06).
 *
 * One queue, not two. Bookings are not reviewed: payment confirms them, and
 * neither an operator nor the lessor stands between the two. The methods that
 * approved and rejected a booking are gone rather than left unused — a service
 * that can still call `/admin/bookings/:id/approve` is a service somebody will
 * wire a button to.
 *
 * Approve takes no body and reject requires a `ReviewDecision`: the asymmetry is
 * the rule itself, expressed in the signature. There is deliberately no
 * `decide(approved, reason?)` — that shape lets a rejection through with no
 * reason attached, which is exactly what the audit trail must never allow.
 */
@Injectable()
export class AdminReviewService {
  private readonly api = inject(ApiService);

  // ── Listings ───────────────────────────────────────────────────────────
  listingQueue(params: Record<string, string>): Observable<PaginatedResponse<ListingReviewRow>> {
    return this.api.list<ListingReviewRow>(API_ENDPOINTS.admin.pendingUnits, {
      params,
    });
  }

  listing(id: string): Observable<ListingReviewDetail> {
    return this.api.get<ListingReviewDetail>(API_ENDPOINTS.admin.unitReviewById(id));
  }

  approveListing(id: string): Observable<void> {
    return this.api.post<void>(API_ENDPOINTS.admin.approveUnit(id));
  }

  rejectListing(id: string, decision: ReviewDecision): Observable<void> {
    return this.api.post<void, ReviewDecision>(API_ENDPOINTS.admin.rejectUnit(id), decision);
  }

  /**
   * Bulk actions run one request per row rather than through a bulk endpoint:
   * each decision is its own audit entry and its own notification, and a partial
   * failure must leave the rows it did reach decided.
   */
  approveListings(ids: readonly string[]): Observable<void[]> {
    return forkJoin(ids.map((id) => this.approveListing(id)));
  }

  rejectListings(ids: readonly string[], decision: ReviewDecision): Observable<void[]> {
    return forkJoin(ids.map((id) => this.rejectListing(id, decision)));
  }
}
