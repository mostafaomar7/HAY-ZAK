import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import type { AccountStatus } from '@core/enums/user-role.enum';
import type { PaginatedResponse } from '@core/models/api-response.model';
import type { AdminUserDetail, AdminUserRow } from '@core/models/admin.model';
import { ApiService } from '@core/services/api.service';

/**
 * User administration (FR-ADM-04).
 *
 * Status is set through one verb taking the target state, not through
 * `suspend()`/`activate()`/`verify()`. Three verbs would each have to know which
 * transitions are legal from where; one carries the intent and leaves the rule
 * where it belongs — on the server.
 */
@Injectable()
export class AdminUsersService {
  private readonly api = inject(ApiService);

  list(params: Record<string, string>): Observable<PaginatedResponse<AdminUserRow>> {
    return this.api.list<AdminUserRow>(API_ENDPOINTS.admin.users, { params });
  }

  byId(id: string): Observable<AdminUserDetail> {
    return this.api.get<AdminUserDetail>(API_ENDPOINTS.admin.userById(id));
  }

  setStatus(id: string, status: AccountStatus): Observable<void> {
    return this.api.post<void, { status: AccountStatus }>(API_ENDPOINTS.admin.setUserStatus(id), {
      status,
    });
  }
}
