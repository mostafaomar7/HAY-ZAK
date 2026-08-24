import { HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { SKIP_AUTH } from '@core/interceptors/auth.interceptor';
import type {
  Booking,
  BookingConfirmRequest,
  BookingDraftRequest,
  BookingStatusHistoryEntry,
} from '@core/models/booking.model';
import type { Invoice, PaymentIntent } from '@core/models/payment.model';
import type { AlternativePeriod, ComplaintRequest } from '@core/models/renter.model';
import type { PaymentMethod } from '@core/enums/payment.enum';
import type { PriceBreakdown } from '@core/utils/money.utils';
import { ApiService } from '@core/services/api.service';

/**
 * Every write in the booking journey (FR-BKG, FR-PAY).
 *
 * Deliberately has no `approve` or `reject`: SRS §6 gives that authority to
 * administration alone, and the renter portal must not grow a back door to it.
 * The renter's only state-changing verbs are draft, confirm, pay and complain.
 */
@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly api = inject(ApiService);

  /**
   * FR-BKG-02 — the price shown before payment.
   *
   * Quoted by the server even though `calculatePrice` could do the arithmetic
   * locally: the commission rate, the VAT base and who bears the commission are
   * all runtime settings (FR-ADM-06), and a client that computes its own total
   * will silently disagree with the charge the moment one of them changes.
   * The local helper stays for optimistic display while this call is in flight.
   */
  quote(unitId: string, startDate: string, daysCount: number): Observable<PriceBreakdown> {
    return this.api.get<PriceBreakdown>(API_ENDPOINTS.bookings.quote, {
      // The details page quotes a price for signed-out visitors too.
      context: new HttpContext().set(SKIP_AUTH, true),
      params: { unitId, startDate, daysCount },
    });
  }

  /**
   * Creates the Draft. No dates are held yet — the design is explicit that the
   * 15-minute hold starts at the identity step, not here.
   */
  createDraft(payload: BookingDraftRequest): Observable<Booking> {
    return this.api.post<Booking, BookingDraftRequest>(API_ENDPOINTS.bookings.base, payload);
  }

  byId(id: string): Observable<Booking> {
    return this.api.get<Booking>(API_ENDPOINTS.bookings.byId(id));
  }

  /**
   * FR-BKG-03/04 — goods description and the prohibited-items acknowledgement.
   * Moves the booking to AwaitingPayment and starts the hold.
   */
  confirm(id: string, payload: BookingConfirmRequest): Observable<Booking> {
    return this.api.post<Booking, BookingConfirmRequest>(
      API_ENDPOINTS.bookings.confirm(id),
      payload,
    );
  }

  /** FR-PAY-01 — hands off to the gateway; the result screen reads the outcome. */
  createPaymentIntent(bookingId: string, method: PaymentMethod): Observable<PaymentIntent> {
    return this.api.post<PaymentIntent, { method: PaymentMethod }>(
      API_ENDPOINTS.payments.createIntent(bookingId),
      { method },
    );
  }

  paymentStatus(bookingId: string): Observable<{ status: string; failureReason?: string }> {
    return this.api.get<{ status: string; failureReason?: string }>(
      API_ENDPOINTS.payments.status(bookingId),
    );
  }

  /** Offered when the window was taken by another renter mid-payment. */
  alternativePeriods(bookingId: string): Observable<AlternativePeriod[]> {
    return this.api.get<AlternativePeriod[]>(API_ENDPOINTS.bookings.alternatives(bookingId));
  }

  history(id: string): Observable<BookingStatusHistoryEntry[]> {
    return this.api.get<BookingStatusHistoryEntry[]>(API_ENDPOINTS.bookings.history(id));
  }

  invoice(id: string): Observable<Invoice> {
    return this.api.get<Invoice>(API_ENDPOINTS.bookings.invoice(id));
  }

  downloadInvoice(id: string): Observable<Blob> {
    return this.api.download(API_ENDPOINTS.bookings.invoice(id), {
      headers: { Accept: 'application/pdf' },
    });
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
