import { Injectable, computed, inject, signal } from '@angular/core';
import type { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { APP } from '@core/constants/app.constants';
import { contactDetailsReleased } from '@core/constants/booking-transitions';
import { BookingStatus } from '@core/enums/booking-status.enum';
import type { PaginatedResponse } from '@core/models/api-response.model';
import type { RenterBooking, WireBooking } from '@core/models/renter-booking';
import { bookingFromWire } from '@core/models/renter-booking';
import { ApiService } from '@core/services/api.service';

/**
 * The lessor's "Requests" screen (FR-LSR-05).
 *
 * Read-only by design, and now doubly so: payment confirms a booking, so there
 * is no decision left to make. FR-LSR-06 and the §5 permission matrix give the
 * lessor no authority to accept or reject, and SRS §2.5 forbids the interface
 * from even suggesting otherwise. There is deliberately no approve/reject
 * method here — if one appears, the requirement has been broken.
 *
 * Reads `/lessor/bookings`, which is the same object the renter sees plus the
 * commission and the net. It must not read `/renter/bookings`: that is scoped
 * to the caller, so a lessor asking for it gets a 403 rather than their own
 * rows — and it would withhold the two figures this screen exists to show.
 */
@Injectable()
export class LessorRequestsService {
  private readonly api = inject(ApiService);

  private readonly items = signal<RenterBooking[]>([]);
  private readonly loading = signal(false);
  private readonly totalCount = signal(0);

  readonly requests = this.items.asReadonly();
  readonly isLoading = this.loading.asReadonly();
  readonly total = this.totalCount.asReadonly();

  /** Requests still waiting on an administration decision. */
  readonly awaitingDecision = computed(() =>
    this.items().filter((b) => b.status === BookingStatus.Confirmed),
  );

  /** FR-LSR-01 — active bookings counter on the dashboard. */
  readonly activeCount = computed(
    () => this.items().filter((b) => b.status === BookingStatus.Active).length,
  );

  load(status?: BookingStatus, page = 1): Observable<PaginatedResponse<RenterBooking>> {
    this.loading.set(true);
    return this.api
      .list<WireBooking>(API_ENDPOINTS.bookings.forLessor, {
        params: { status, page, pageSize: APP.pageSize },
      })
      .pipe(
        map((page_) => ({
          items: page_.items.map(bookingFromWire),
          pagination: page_.pagination,
        })),
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

  /**
   * `{ booking }` and nothing else — the lessor's detail carries no
   * `holdExpiresAt`, unlike the renter's. Which is right: the countdown is the
   * renter's to act on, and a lessor watching one could do nothing about it.
   */
  byId(id: string): Observable<RenterBooking> {
    return this.api
      .get<{ booking: WireBooking }>(API_ENDPOINTS.bookings.forLessorById(id))
      .pipe(map((payload) => bookingFromWire(payload.booking)));
  }
}

/**
 * FR-LSR-09 / §5 — the renter's name and mobile are withheld until the booking
 * is approved. Templates must ask this rather than reading the field directly,
 * so a populated payload can never leak early.
 */
export function renterContactVisible(booking: RenterBooking): boolean {
  return contactDetailsReleased(booking.status);
}

/** What the requests table may show before approval. */
export interface RequestRowView {
  referenceNo: string;
  /** Withheld until confirmation — show a placeholder, not an empty cell. */
  renterName: string | null;
  startDate: string;
  endDate: string;
  /** Nights, and the column says so. */
  nights: number;
  goodsDescription: string;
  /** What the renter paid. */
  totalHalalas: number;
  /**
   * What this booking is actually worth to the lessor, after the commission.
   *
   * The whole reason this screen reads `/lessor/bookings` rather than the
   * renter's list. `undefined` if the server did not send it — never zero,
   * which would read as "you get nothing".
   */
  netToLessorHalalas?: number;
  status: BookingStatus;
}

export function toRequestRow(booking: RenterBooking): RequestRowView {
  return {
    referenceNo: booking.referenceNo,
    renterName: renterContactVisible(booking) ? (booking.contact?.fullName ?? null) : null,
    startDate: booking.startDate,
    endDate: booking.endDate,
    nights: booking.nights,
    goodsDescription: booking.goodsDescription,
    totalHalalas: booking.price.totalHalalas,
    netToLessorHalalas: booking.commission?.netToLessorHalalas,
    status: booking.status,
  };
}
