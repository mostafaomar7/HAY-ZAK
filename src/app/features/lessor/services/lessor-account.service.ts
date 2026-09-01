import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import type { LessorDashboard, LessorEarnings } from '@core/models';
import { ApiService } from '@core/services/api.service';

/**
 * Dashboard, earnings and bank details — FR-LSR-01, FR-LSR-02, FR-LSR-08.
 * Root-provided because the dashboard summary is read from several screens.
 */
@Injectable({ providedIn: 'root' })
export class LessorAccountService {
  private readonly api = inject(ApiService);

  /**
   * The whole landing screen in one request — counts, money and the badge.
   *
   * Wrapped in `{ dashboard }` on the wire, like `/auth/me` wraps its user.
   */
  dashboard(): Observable<LessorDashboard> {
    return this.api
      .get<{ dashboard: LessorDashboard }>(API_ENDPOINTS.lessor.dashboard)
      .pipe(map((result) => result.dashboard));
  }

  /**
   * FR-LSR-08 — the three money buckets and the rule that separates them.
   *
   * Takes no date range: the buckets are the current position of the account,
   * not a period's activity. The per-booking history is `/lessor/bookings`,
   * which the same screen reads beside this.
   */
  earnings(): Observable<LessorEarnings> {
    return this.api
      .get<{ earnings: LessorEarnings }>(API_ENDPOINTS.lessor.earnings)
      .pipe(map((result) => result.earnings));
  }

  // `earningsTable()` and `downloadStatement()` are gone with the screen that
  // called them: `/lessor/earnings/rows` and `/lessor/earnings/statement` have
  // never existed, so the table showed an error box and the export button did
  // nothing. The rows come from `/lessor/bookings` now, and there is no
  // statement to offer until there is an endpoint that produces one.
}
