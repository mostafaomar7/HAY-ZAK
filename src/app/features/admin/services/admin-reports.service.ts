import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import type {
  BookingsReportRow,
  OccupancyReportRow,
  PayoutReportRow,
  ReportFilters,
  ReportKind,
  RevenueReportRow,
} from '@core/models/admin.model';
import { ApiService } from '@core/services/api.service';

/**
 * The four reports (FR-RPT-01 … FR-RPT-04).
 *
 * Each has its own return type rather than one shared "report row": the four
 * differ in every column, and a single loose shape would push the
 * disambiguation into the template, where the compiler cannot help.
 */
@Injectable()
export class AdminReportsService {
  private readonly api = inject(ApiService);

  bookings(filters: ReportFilters): Observable<BookingsReportRow[]> {
    return this.api.get<BookingsReportRow[]>(API_ENDPOINTS.reports.bookings, {
      params: { ...filters },
    });
  }

  revenue(filters: ReportFilters): Observable<RevenueReportRow[]> {
    return this.api.get<RevenueReportRow[]>(API_ENDPOINTS.reports.revenue, {
      params: { ...filters },
    });
  }

  payouts(filters: ReportFilters): Observable<PayoutReportRow[]> {
    return this.api.get<PayoutReportRow[]>(API_ENDPOINTS.reports.payouts, {
      params: { ...filters },
    });
  }

  occupancy(filters: ReportFilters): Observable<OccupancyReportRow[]> {
    return this.api.get<OccupancyReportRow[]>(API_ENDPOINTS.reports.occupancy, {
      params: { ...filters },
    });
  }

  /** FR-RPT-05 — the file is rendered server-side; the client only saves it. */
  export(kind: ReportKind, format: 'xlsx' | 'pdf', filters: ReportFilters): Observable<Blob> {
    return this.api.download(API_ENDPOINTS.reports.export(kind), {
      params: { ...filters, format },
    });
  }
}
