import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { UnitStatus } from '@core/enums/unit-status.enum';
import { LanguageService } from '@core/i18n/language.service';
import type { PaginatedResponse } from '@core/models/api-response.model';
import type {
  ListingReviewDetail,
  ListingReviewRow,
  ReviewDecision,
} from '@core/models/admin.model';
import type { WireUnit } from '@core/models/unit-wire';
import { fileUrl } from '@core/models/unit-wire';
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
  private readonly i18n = inject(LanguageService);

  /**
   * The queue is `/admin/units` filtered, not a `/pending` route of its own —
   * `pending` in that position is read as a unit identifier and answers 422.
   *
   * The same endpoint reaches every other status, which is why the filter is a
   * parameter the caller may override rather than a constant buried here.
   */
  listingQueue(params: Record<string, string>): Observable<PaginatedResponse<ListingReviewRow>> {
    return this.api
      .list<WireUnit>(API_ENDPOINTS.admin.units, {
        params: { status: UnitStatus.PendingReview, ...params },
      })
      .pipe(map((page) => ({ ...page, items: page.items.map((unit) => this.toRow(unit)) })));
  }

  listing(id: string): Observable<ListingReviewDetail> {
    return this.api
      .get<WireUnit>(API_ENDPOINTS.admin.unitById(id))
      .pipe(map((unit) => this.toDetail(unit)));
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

  /**
   * The API sends a unit; the queue shows a review row.
   *
   * `submittedAt`, `slaDueAt` and `isOverdue` all come from the server now.
   * `submittedAt` used to be read off `updatedAt` here — which was wrong in a
   * way that only showed up under use: editing a listing already in the queue
   * moves `updatedAt`, so every deadline silently reset whenever a lessor
   * touched anything.
   *
   * Two fields are still derived, and both are arithmetic rather than policy:
   *
   * - `waitingHours` from the server's `submittedAt`, for the "waiting since"
   *   label. Whether that is *late* is `isOverdue`, which the server decides.
   * - `isEdit` is "has been reviewed before" — a unit with a `reviewedAt` is
   *   back for a second look, which is what the badge means.
   */
  private toRow(unit: WireUnit): ListingReviewRow {
    const submittedAt = unit.submittedAt ?? null;

    return {
      id: unit.id,
      unitTitle: unit.title,
      ownerName: unit.lessor?.fullName ?? '',
      categoryName: this.i18n.pick(unit.category),
      cityName: this.i18n.pick(unit.city),
      dailyPriceHalalas: unit.dailyPriceHalalas,
      areaSqm: unit.areaSqm,
      submittedAt,
      slaDueAt: unit.slaDueAt ?? null,
      isOverdue: unit.isOverdue ?? false,
      waitingHours: submittedAt ? hoursSince(submittedAt) : null,
      isEdit: !!unit.reviewedAt,
    };
  }

  private toDetail(unit: WireUnit): ListingReviewDetail {
    return {
      ...this.toRow(unit),
      description: unit.description,
      imageUrls: (unit.images ?? []).map((image) => fileUrl(image.url)),
      districtName: this.i18n.pick(unit.district),
      owner: {
        name: unit.lessor?.fullName ?? '',
        mobile: unit.lessor?.mobile ?? '',
        // The API does not report whether the lessor's identity is verified on
        // this projection. Claiming "verified" without being told would be the
        // one wrong answer, so an unknown reads as not verified.
        isVerified: false,
      },
    };
  }
}

/** Whole hours between an instant and now, never negative. */
function hoursSince(iso: string): number {
  const elapsed = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(elapsed / 3_600_000));
}
