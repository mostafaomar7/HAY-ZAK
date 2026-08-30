import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import type { PaginatedResponse } from '@core/models/api-response.model';
import type {
  AuditAction,
  AuditEntry,
  AuditQuery,
  WireAuditActions,
  WireAuditEntry,
} from '@core/models/audit';
import { auditEntryFromWire } from '@core/models/audit';
import { ApiService } from '@core/services/api.service';

/**
 * The audit trail (FR-ADM-09) — `audit:view`, the system administrator's alone.
 *
 * There is no update and no delete, and the absence of the methods is the
 * enforcement on this side: the log is append-only, and a service that could
 * write to it would be a service somebody could be asked to use.
 *
 * There is also **no export**, deliberately. If the client asks for one, that
 * is a conversation with the backend before it is a method here.
 */
@Injectable()
export class AdminAuditService {
  private readonly api = inject(ApiService);

  list(query: AuditQuery = {}): Observable<PaginatedResponse<AuditEntry>> {
    return this.api
      .list<WireAuditEntry>(API_ENDPOINTS.admin.auditLog, {
        params: {
          action: query.action,
          entityType: query.entityType,
          entityId: query.entityId,
          actorUserId: query.actorUserId,
          // Plain dates, and `to` covers its whole day on the server — so a
          // range of one day is `from` and `to` set to the same value, not an
          // off-by-one somebody has to remember here.
          from: query.from,
          to: query.to,
          page: query.page,
        },
      })
      .pipe(
        map((page) => ({
          items: page.items.map(auditEntryFromWire),
          pagination: page.pagination,
        })),
      );
  }

  /**
   * The `action` values actually present, for the filter.
   *
   * Read from the data rather than hard-coded, so an action the server starts
   * recording appears in the filter without a release on this side.
   */
  actions(): Observable<AuditAction[]> {
    return this.api
      .get<WireAuditActions>(API_ENDPOINTS.admin.auditActions)
      .pipe(map((response) => response.actions ?? []));
  }
}
