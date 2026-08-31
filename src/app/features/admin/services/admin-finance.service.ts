import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import type { PaginatedResponse } from '@core/models/api-response.model';
import type {
  AdminBookingQuery,
  AdminBookingRow,
  WireAdminBooking,
} from '@core/models/admin.model';
import { adminBookingFromWire } from '@core/models/admin.model';
import type { PayoutStatus } from '@core/enums/payment.enum';
import type {
  EligiblePayout,
  Payout,
  PayoutFailedRequest,
  PayoutPaidRequest,
} from '@core/models/payment.model';
import { ApiService } from '@core/services/api.service';

/** Payments, payouts and the financial configuration (FR-PAY, FR-ADM-06). */
@Injectable()
export class AdminFinanceService {
  private readonly api = inject(ApiService);

  /**
   * FR-PAY-08 — payment tracking, read off the bookings.
   *
   * `/admin/payments` has never existed; this screen asked for it and showed an
   * error box for as long as it has been there. `/admin/bookings` is shipped and
   * carries every figure that screen needs on the row — what the renter paid,
   * the commission, the lessor's net, and whether the payout is held.
   *
   * Read-only, like everything else on that screen: every number here is the
   * consequence of something that already happened, and the place to change any
   * of them is the screen that performs the act.
   */
  bookings(query: AdminBookingQuery = {}): Observable<PaginatedResponse<AdminBookingRow>> {
    return this.api
      .list<WireAdminBooking>(API_ENDPOINTS.admin.bookings, {
        params: {
          status: query.status,
          search: query.search?.trim() || undefined,
          from: query.from,
          to: query.to,
          page: query.page,
        },
      })
      .pipe(
        map((page) => ({
          items: page.items.map(adminBookingFromWire),
          pagination: page.pagination,
        })),
      );
  }

  /**
   * Money that is releasable and has no payout yet, one row per lessor.
   *
   * A transfer is made per lessor rather than per booking, which is why the
   * server groups it: an operator sends one amount to one account, and paying
   * each booking separately would be a bank charge per night rented.
   */
  eligiblePayouts(page = 1): Observable<PaginatedResponse<EligiblePayout>> {
    return this.api.list<EligiblePayout>(API_ENDPOINTS.payments.eligiblePayouts, {
      params: { page },
    });
  }

  payouts(
    params: { page?: number; status?: PayoutStatus } = {},
  ): Observable<PaginatedResponse<Payout>> {
    return this.api.list<Payout>(API_ENDPOINTS.payments.payouts, { params });
  }

  payout(id: string): Observable<Payout> {
    return this.api.get<Payout>(API_ENDPOINTS.payments.payoutById(id));
  }

  /** Approves one lessor's releasable total into a payout awaiting execution. */
  approvePayout(lessorId: string): Observable<Payout> {
    return this.api.post<Payout, { lessorId: string }>(API_ENDPOINTS.payments.payouts, {
      lessorId,
    });
  }

  /**
   * Records that the transfer was actually made.
   *
   * `bankReference` is required and the server refuses without it. A payout
   * marked done with nothing tying it to a bank statement is not a record
   * anybody can audit, which is the entire point of recording it.
   */
  markPaid(id: string, bankReference: string): Observable<Payout> {
    return this.api.post<Payout, PayoutPaidRequest>(API_ENDPOINTS.payments.markPayoutPaid(id), {
      bankReference,
    });
  }

  markFailed(id: string, reason: string): Observable<Payout> {
    return this.api.post<Payout, PayoutFailedRequest>(API_ENDPOINTS.payments.markPayoutFailed(id), {
      reason,
    });
  }

  /** Back to awaiting execution, once whatever failed has been corrected. */
  retryPayout(id: string): Observable<Payout> {
    return this.api.post<Payout>(API_ENDPOINTS.payments.retryPayout(id));
  }

  demandBankDetails(lessorId: string, message: string): Observable<void> {
    return this.api.post<void, { message: string }>(
      API_ENDPOINTS.payments.demandBankDetails(lessorId),
      { message },
    );
  }

  /*
   * Settings and commission exceptions used to live here. The settings moved
   * to `AdminSettingsService` when the shipped endpoint turned out to answer
   * with string-valued rows and a per-group permission rather than one object;
   * the exceptions have no endpoint at all and were a screen without a server.
   */
}
