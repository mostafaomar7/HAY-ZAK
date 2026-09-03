import { Injectable, computed, inject, signal } from '@angular/core';
import type { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { BookingStatus, TERMINAL_BOOKING_STATUSES } from '@core/enums/booking-status.enum';
import type { PaginatedResponse } from '@core/models/api-response.model';
import type {
  BookingWithHold,
  CreateBookingRequest,
  RenterBooking,
  WireBooking,
  WireBookingWithHold,
  WirePaymentSession,
} from '@core/models/renter-booking';
import { bookingFromWire, bookingWithHoldFromWire } from '@core/models/renter-booking';
import type { TaxInvoice, WireTaxInvoiceResponse } from '@core/models/tax-invoice';
import { taxInvoiceFromWire } from '@core/models/tax-invoice';
import { ApiService } from '@core/services/api.service';

/** The two tabs on "حجوزاتي" (RNT-01). */
export type BookingTab = 'current' | 'previous';

/**
 * The renter's own bookings, and the two writes in the journey.
 *
 * The split between the two tabs is derived from the status, not asked of the
 * server: SRS §6 already defines which states are terminal, and duplicating
 * that judgement in a query parameter is how the two ends drift apart.
 */
@Injectable()
export class RenterBookingsService {
  private readonly api = inject(ApiService);

  private readonly items = signal<RenterBooking[]>([]);
  private readonly loading = signal(false);

  readonly bookings = this.items.asReadonly();
  readonly isLoading = this.loading.asReadonly();

  readonly current = computed(() =>
    this.items().filter((b) => !TERMINAL_BOOKING_STATUSES.includes(b.status)),
  );

  readonly previous = computed(() =>
    this.items().filter((b) => TERMINAL_BOOKING_STATUSES.includes(b.status)),
  );

  load(): Observable<PaginatedResponse<RenterBooking>> {
    this.loading.set(true);
    return this.api.list<WireBooking>(API_ENDPOINTS.bookings.mine).pipe(
      map((page) => ({ items: page.items.map(bookingFromWire), pagination: page.pagination })),
      tap({
        next: (page) => {
          this.items.set(page.items);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      }),
    );
  }

  /**
   * One call: the dates, the goods and the acknowledgement together.
   *
   * It comes back already holding the dates, so this is the moment the clock
   * starts — which is why the whole booking is submitted at once rather than
   * assembled across steps. Read `holdExpiresAt` from the answer.
   */
  create(payload: CreateBookingRequest): Observable<BookingWithHold> {
    return this.api
      .post<WireBookingWithHold, CreateBookingRequest>(API_ENDPOINTS.bookings.mine, payload)
      .pipe(map(bookingWithHoldFromWire));
  }

  byId(id: string): Observable<BookingWithHold> {
    return this.api
      .get<WireBookingWithHold>(API_ENDPOINTS.bookings.byId(id))
      .pipe(map(bookingWithHoldFromWire));
  }

  /**
   * The tax invoice, which exists from CONFIRMED onward.
   *
   * A 404 before payment is the answer, not a fault: nothing has been paid, so
   * nothing has been invoiced. The caller shows "لم تصدر بعد" rather than an
   * error, and does not retry.
   *
   * There is no PDF to fetch beside this — the server returns the same JSON
   * whatever `Accept` asks for — so the page renders the document itself and
   * prints through the browser.
   */
  invoice(id: string): Observable<TaxInvoice> {
    return this.api
      .get<WireTaxInvoiceResponse>(API_ENDPOINTS.bookings.invoice(id))
      .pipe(map((response) => taxInvoiceFromWire(response.invoice)));
  }

  /**
   * Starts the payment and answers where to send the browser.
   *
   * `returnUrl` is this application's own origin — the API refuses anything
   * else, and it is right to: an open return parameter is a phishing tool.
   * Built here rather than configured, so the address is always the one the
   * visitor is actually on.
   *
   * **`bookingId` goes in the query string, and it has to come from us.** The
   * return page reads the booking rather than believing the gateway's verdict,
   * so without an id it has nothing to read and renders its error state — the
   * money has moved and the screen says something went wrong. Tap appends its
   * own charge reference on the way back, not ours, so waiting for the gateway
   * to supply it is waiting for something that never arrives. The fixtures did
   * append it, which is why every test passed over a flow that could not work.
   *
   * Calling it twice is safe and returns the same charge, which matters after
   * a declined card: the booking is still held and the retry is a retry, not a
   * second attempt to pay for the same nights.
   */
  pay(id: string, returnPath = '/bookings/return'): Observable<string> {
    const returnUrl = new URL(returnPath, window.location.origin);
    returnUrl.searchParams.set('bookingId', id);

    return this.api
      .post<WirePaymentSession, { returnUrl: string }>(API_ENDPOINTS.bookings.pay(id), {
        returnUrl: returnUrl.toString(),
      })
      .pipe(map((session) => session.redirectUrl));
  }
}

/**
 * The row action next to "تفاصيل الحجز", which changes with the state.
 *
 * There is no "resume" and no draft to resume: a booking exists only once it
 * has been paid for or is waiting to be. Returns null where the design shows
 * no secondary action.
 */
export function bookingPrimaryAction(booking: RenterBooking): {
  labelKey: 'bookings.viewInvoice' | 'bookings.completePayment';
  link: unknown[];
} | null {
  switch (booking.status) {
    case BookingStatus.AwaitingPayment:
      return { labelKey: 'bookings.completePayment', link: ['/booking', booking.id, 'pay'] };
    case BookingStatus.Confirmed:
    case BookingStatus.Active:
    case BookingStatus.Completed:
      // Payment is what confirms a booking, so an invoice exists from
      // CONFIRMED onward — there is no pending state to wait through.
      return { labelKey: 'bookings.viewInvoice', link: ['/my-bookings', booking.id, 'invoice'] };
    default:
      return null;
  }
}

/**
 * Whether "لديّ مشكلة" belongs on this booking.
 *
 * Everything that is not still waiting to be paid for: a renter with a live,
 * finished or cancelled booking may need to raise something about it, and an
 * unpaid hold holds nothing to complain about. It replaced `canCancelBooking`,
 * which offered a button for an action nobody on this platform can take.
 */
export function canRaiseComplaint(booking: RenterBooking): boolean {
  return booking.status !== BookingStatus.AwaitingPayment;
}

/**
 * FR-UNT-11 — the address and the counterparty are released by confirmation.
 *
 * Derived from the status rather than from `contact !== null` so a screen
 * cannot be talked into revealing one by a response that carried it early.
 */
export function isAddressReleased(booking: RenterBooking): boolean {
  return [BookingStatus.Confirmed, BookingStatus.Active, BookingStatus.Completed].includes(
    booking.status,
  );
}
