import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import type { PaginatedResponse } from '@core/models/api-response.model';
import type {
  AuditDetail,
  AuditRow,
  ComplaintDetail,
  ComplaintRow,
} from '@core/models/admin.model';
import { ApiService } from '@core/services/api.service';

/**
 * The two read-heavy oversight screens: the audit trail (FR-ADM-09) and
 * complaints (FR-ADM-08).
 *
 * They share a service because they share a job — showing what happened and who
 * is answerable for it — and because a complaint's resolution is itself an audit
 * event. Note there is no update or delete for an audit entry: the log is
 * append-only by design, and the absence of the method is the enforcement here.
 */
@Injectable()
export class AdminOversightService {
  private readonly api = inject(ApiService);

  // ── Audit ──────────────────────────────────────────────────────────────
  auditLog(params: Record<string, string>): Observable<PaginatedResponse<AuditRow>> {
    return this.api.get<PaginatedResponse<AuditRow>>(API_ENDPOINTS.admin.auditLog, { params });
  }

  auditEntry(id: string): Observable<AuditDetail> {
    return this.api.get<AuditDetail>(API_ENDPOINTS.admin.auditEntryById(id));
  }

  // ── Complaints ─────────────────────────────────────────────────────────
  complaints(params: Record<string, string>): Observable<PaginatedResponse<ComplaintRow>> {
    return this.api.get<PaginatedResponse<ComplaintRow>>(API_ENDPOINTS.admin.disputes, { params });
  }

  complaint(id: string): Observable<ComplaintDetail> {
    return this.api.get<ComplaintDetail>(API_ENDPOINTS.admin.disputeById(id));
  }

  /**
   * Closing a complaint releases any payout frozen against it (UC-04), which is
   * why the resolution text is required rather than optional: it is the record
   * both parties and the finance officer will read.
   */
  resolve(id: string, resolution: string): Observable<void> {
    return this.api.post<void, { resolution: string }>(API_ENDPOINTS.admin.resolveDispute(id), {
      resolution,
    });
  }
}
