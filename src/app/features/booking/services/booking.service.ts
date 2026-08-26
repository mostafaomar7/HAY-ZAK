import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import type { BookingStatusHistoryEntry } from '@core/models/booking.model';
import type { ComplaintRequest } from '@core/models/renter.model';
import { ApiService } from '@core/services/api.service';

/**
 * Every write in the booking journey (FR-BKG, FR-PAY).
 *
 * What is left after the journey moved to `RenterBookingsService`: the records
 * that hang off a booking which already exists — its history, its contract, and
 * the complaint that is the only way to raise a problem with it. None of these
 * endpoints is shipped yet. The invoice went across with the journey, because
 * it is served from `/renter/bookings/:id/invoice` and is the renter's.
 *
 * Deliberately has no `approve` or `reject`, and no `cancel`. Payment confirms
 * a booking, so there is no approval to grant; and neither party can cancel —
 * an administrator resolving a complaint is the only path to CANCELLED.
 */
@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly api = inject(ApiService);

  /**
   * FR-BKG-02 — the price the renter is charged.
   *
   * There is no quote endpoint and no need for one: `POST /renter/bookings`
   * answers with the price it committed to, and the commission is deducted
   * from the lessor rather than added to the renter, so the total is the daily
   * rate times the nights and nothing the client has to be told separately.
   * Creating, confirming and paying live on `RenterBookingsService`.
   */

  paymentStatus(bookingId: string): Observable<{ status: string; failureReason?: string }> {
    return this.api.get<{ status: string; failureReason?: string }>(
      API_ENDPOINTS.payments.status(bookingId),
    );
  }

  history(id: string): Observable<BookingStatusHistoryEntry[]> {
    return this.api.get<BookingStatusHistoryEntry[]>(API_ENDPOINTS.bookings.history(id));
  }

  /**
   * Raises a complaint against the booking.
   *
   * There is no `cancel` beside it, and that absence is the product rule
   * rather than an omission: neither party can cancel, so a client that had
   * the method would be able to call an endpoint that does not exist. The
   * complaint is the only route, and an administrator decides the outcome.
   */
  raiseComplaint(id: string, payload: ComplaintRequest): Observable<void> {
    return this.api.post<void, ComplaintRequest>(API_ENDPOINTS.bookings.complaints(id), payload);
  }
}
