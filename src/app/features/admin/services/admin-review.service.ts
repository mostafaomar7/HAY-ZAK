import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { forkJoin } from 'rxjs';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import type { PaginatedResponse } from '@core/models/api-response.model';
import type {
  BookingReviewDetail,
  BookingReviewRow,
  ListingReviewDetail,
  ListingReviewRow,
  ReviewDecision,
} from '@core/models/admin.model';
import { ApiService } from '@core/services/api.service';

/**
 * The two review queues (FR-UNT-06, FR-BKG-05).
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

  // ── Bookings ───────────────────────────────────────────────────────────
  bookingQueue(params: Record<string, string>): Observable<PaginatedResponse<BookingReviewRow>> {
    return this.api.list<BookingReviewRow>(API_ENDPOINTS.admin.pendingBookings, {
      params,
    });
  }

  booking(id: string): Observable<BookingReviewDetail> {
    return this.api.get<BookingReviewDetail>(API_ENDPOINTS.admin.bookingReviewById(id));
  }

  approveBooking(id: string): Observable<void> {
    return this.api.post<void>(API_ENDPOINTS.admin.approveBooking(id));
  }

  rejectBooking(id: string, decision: ReviewDecision): Observable<void> {
    return this.api.post<void, ReviewDecision>(API_ENDPOINTS.admin.rejectBooking(id), decision);
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

  approveBookings(ids: readonly string[]): Observable<void[]> {
    return forkJoin(ids.map((id) => this.approveBooking(id)));
  }

  rejectBookings(ids: readonly string[], decision: ReviewDecision): Observable<void[]> {
    return forkJoin(ids.map((id) => this.rejectBooking(id, decision)));
  }
}
