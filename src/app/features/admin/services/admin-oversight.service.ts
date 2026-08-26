import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import type { PaginatedResponse } from '@core/models/api-response.model';
import type { AuditDetail, AuditRow } from '@core/models/admin.model';
import { ApiService } from '@core/services/api.service';

/**
 * The audit trail (FR-ADM-09).
 *
 * There is no update and no delete: the log is append-only by design, and the
 * absence of the methods is the enforcement on this side.
 *
 * Complaints used to share this service — they were both "showing what
 * happened and who is answerable". They moved to `AdminComplaintsService` when
 * the real endpoints shipped, because a complaint is not a record of the past:
 * it is an open conversation with a deadline, four actions and a permission
 * split inside one of them.
 */
@Injectable()
export class AdminOversightService {
  private readonly api = inject(ApiService);

  auditLog(params: Record<string, string>): Observable<PaginatedResponse<AuditRow>> {
    return this.api.list<AuditRow>(API_ENDPOINTS.admin.auditLog, { params });
  }

  auditEntry(id: string): Observable<AuditDetail> {
    return this.api.get<AuditDetail>(API_ENDPOINTS.admin.auditEntryById(id));
  }
}
