import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import type { BookingStatusHistoryEntry } from '@core/models/booking.model';
import { ApiService } from '@core/services/api.service';

/**
 * Every write in the booking journey (FR-BKG, FR-PAY).
 *
 * What is left after the journey moved to `RenterBookingsService`: its history
 * and its contract, neither of which is shipped yet. The invoice went across
 * with the journey, and the complaint went to `ComplaintsService` — complaints
 * are raised at `/me/complaints` and belong to the account, not to a booking,
 * because the lessor answers the same one.
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
}
