import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import type { PaginatedResponse } from '@core/models/api-response.model';
import type {
  AdminOverview,
  BookingsReport,
  LessorReportRow,
  ReportRange,
  RevenueReport,
  WireBookingsReportResponse,
  WireOverviewResponse,
  WireRevenueReportResponse,
} from '@core/models/admin-reports';
import { ApiService } from '@core/services/api.service';

/**
 * The reports (FR-RPT) — `reports:view`, which all three administrators hold.
 *
 * Four calls with four shapes, not one report with a `kind`: the overview has
 * no date range at all, two are single objects and one is a paged table. A
 * shared loose type would have pushed the disambiguation into the templates,
 * where the compiler cannot help — and these are the screens where a number
 * put under the wrong heading is most expensive.
 *
 * There is no export yet. The old `?format=xlsx` route is gone rather than
 * left pointing at a 404.
 */
@Injectable()
export class AdminReportsService {
  private readonly api = inject(ApiService);

  /**
   * The platform as it stands. **No date range, and no parameter for one** —
   * these are counts of what exists, and windowing them would answer a
   * question nobody asked.
   */
  overview(): Observable<AdminOverview> {
    return this.api
      .get<WireOverviewResponse>(API_ENDPOINTS.reports.overview)
      .pipe(map((response) => response.overview));
  }

  /**
   * What was booked in a window.
   *
   * `grossHalalas` here is **what renters paid, not what the platform earned**
   * — the commission is the only part of it that is income, and that is on
   * `revenue()`.
   */
  bookings(range: ReportRange = {}): Observable<BookingsReport> {
    return this.api
      .get<WireBookingsReportResponse>(API_ENDPOINTS.reports.bookings, { params: { ...range } })
      .pipe(map((response) => response.report));
  }

  /** The revenue, and beside it the money the platform is only holding. */
  revenue(range: ReportRange = {}): Observable<RevenueReport> {
    return this.api
      .get<WireRevenueReportResponse>(API_ENDPOINTS.reports.revenue, { params: { ...range } })
      .pipe(map((response) => response.report));
  }

  lessors(page = 1, pageSize?: number): Observable<PaginatedResponse<LessorReportRow>> {
    return this.api.list<LessorReportRow>(API_ENDPOINTS.reports.lessors, {
      params: { page, pageSize },
    });
  }
}
