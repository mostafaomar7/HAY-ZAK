import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import type { LessorDashboard, LessorEarnings } from '@core/models';
import { ApiService } from '@core/services/api.service';
import { saveBlob } from '@core/utils/file.utils';
import type { EarningsResponse } from '@core/models/earnings.model';

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
   * not a period's activity. The per-booking history is `earningsTable()`.
   */
  earnings(): Observable<LessorEarnings> {
    return this.api
      .get<{ earnings: LessorEarnings }>(API_ENDPOINTS.lessor.earnings)
      .pipe(map((result) => result.earnings));
  }

  /**
   * LSR-07 — the dues table. Separate from `earnings()` because the screen needs
   * the per-booking rows joined with their commission and payout, which the
   * summary endpoint does not carry.
   */
  earningsTable(fromDate: string, toDate: string): Observable<EarningsResponse> {
    return this.api.get<EarningsResponse>(API_ENDPOINTS.lessor.earningsTable, {
      params: { fromDate, toDate },
    });
  }

  /** FR-LSR-10 — PDF earnings statement for a period. */
  downloadStatement(fromDate: string, toDate: string): Observable<Blob> {
    return this.api.download(API_ENDPOINTS.lessor.earningsStatement, {
      params: { fromDate, toDate },
    });
  }

  saveStatement(blob: Blob, fromDate: string, toDate: string): void {
    saveBlob(blob, `hayzak-earnings-${fromDate}-${toDate}.pdf`);
  }
}
