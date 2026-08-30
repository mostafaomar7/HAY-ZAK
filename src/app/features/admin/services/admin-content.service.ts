import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import type { TermsApprovalRow, TermsVersionRow } from '@core/models/admin.model';
import { ApiService } from '@core/services/api.service';

/**
 * The legal versions and the consent recorded against them (FR-ADM-07).
 *
 * **Not shipped** — every route here answers 404. The reference lists and the
 * CMS pages used to share this service and moved out when their endpoints
 * landed, to `AdminReferenceService` and `AdminCmsService`; what is left is the
 * one part of this module that is still waiting.
 */
@Injectable()
export class AdminContentService {
  private readonly api = inject(ApiService);

  // ── Legal versions ─────────────────────────────────────────────────────
  termsVersions(): Observable<TermsVersionRow[]> {
    return this.api.get<TermsVersionRow[]>(API_ENDPOINTS.admin.termsVersions);
  }

  createTermsVersion(row: Partial<TermsVersionRow>): Observable<TermsVersionRow> {
    return this.api.post<TermsVersionRow, Partial<TermsVersionRow>>(
      API_ENDPOINTS.admin.termsVersions,
      row,
    );
  }

  publishTermsVersion(id: string): Observable<void> {
    return this.api.post<void>(API_ENDPOINTS.admin.publishTermsVersion(id));
  }

  archiveTermsVersion(id: string): Observable<void> {
    return this.api.post<void>(API_ENDPOINTS.admin.archiveTermsVersion(id));
  }

  /** FR-ADM-07 — who accepted this exact version, and when. */
  termsApprovals(id: string): Observable<TermsApprovalRow[]> {
    return this.api.get<TermsApprovalRow[]>(API_ENDPOINTS.admin.termsApprovals(id));
  }
}
