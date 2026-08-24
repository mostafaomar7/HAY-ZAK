import { Injectable, computed, inject, signal } from '@angular/core';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { APP } from '@core/constants/app.constants';
import { contactDetailsReleased } from '@core/constants/booking-transitions';
import { BookingStatus } from '@core/enums/booking-status.enum';
import type { PaginatedResponse } from '@core/models/api-response.model';
import type { Booking } from '@core/models/booking.model';
import { ApiService } from '@core/services/api.service';

/**
 * The lessor's "Requests" screen (FR-LSR-05).
 *
 * Read-only by design: FR-LSR-06 and the §5 permission matrix give the lessor no
 * authority to accept or reject anything, and SRS §2.5 forbids the interface
 * from even suggesting otherwise. There is deliberately no approve/reject method
 * on this service — if one appears, the requirement has been broken.
 */
@Injectable()
export class LessorRequestsService {
  private readonly api = inject(ApiService);

  private readonly items = signal<Booking[]>([]);
  private readonly loading = signal(false);
  private readonly totalCount = signal(0);

  readonly requests = this.items.asReadonly();
  readonly isLoading = this.loading.asReadonly();
  readonly total = this.totalCount.asReadonly();

  /** Requests still waiting on an administration decision. */
  readonly awaitingDecision = computed(() =>
    this.items().filter((b) => b.status === BookingStatus.PaidPendingApproval),
  );

  /** FR-LSR-01 — active bookings counter on the dashboard. */
  readonly activeCount = computed(
    () => this.items().filter((b) => b.status === BookingStatus.Active).length,
  );

  load(status?: BookingStatus, page = 1): Observable<PaginatedResponse<Booking>> {
    this.loading.set(true);
    return this.api
      .list<Booking>(API_ENDPOINTS.lessor.bookingRequests, {
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

  byId(id: string): Observable<Booking> {
    return this.api.get<Booking>(API_ENDPOINTS.bookings.byId(id));
  }
}

/**
 * FR-LSR-09 / §5 — the renter's name and mobile are withheld until the booking
 * is approved. Templates must ask this rather than reading the field directly,
 * so a populated payload can never leak early.
 */
export function renterContactVisible(booking: Booking): boolean {
  return contactDetailsReleased(booking.status);
}

/** What the requests table may show before approval. */
export interface RequestRowView {
  referenceNo: string;
  /** Withheld pre-approval — show a placeholder, not an empty cell. */
  renterName: string | null;
  startDate: string;
  endDate: string;
  daysCount: number;
  goodsDescription: string;
  totalHalalas: number;
  status: BookingStatus;
}

export function toRequestRow(booking: Booking): RequestRowView {
  return {
    referenceNo: booking.referenceNo,
    renterName: renterContactVisible(booking)
      ? (booking.counterpartyContact?.fullName ?? null)
      : null,
    startDate: booking.startDate,
    endDate: booking.endDate,
    daysCount: booking.daysCount,
    goodsDescription: booking.goodsDescription,
    totalHalalas: booking.totalHalalas,
    status: booking.status,
  };
}
