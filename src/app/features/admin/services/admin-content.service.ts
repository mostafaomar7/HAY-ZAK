import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import type {
  CmsPageDetail,
  ReferenceListKind,
  ReferenceListRequest,
  ReferenceListRow,
  TermsApprovalRow,
  TermsVersionRow,
} from '@core/models/admin.model';
import { ApiService } from '@core/services/api.service';

/** Reference lists, CMS pages and legal versions (FR-ADM-05, FR-CMS-01, FR-ADM-07). */
@Injectable()
export class AdminContentService {
  private readonly api = inject(ApiService);

  // ── Reference lists ────────────────────────────────────────────────────
  referenceList(kind: ReferenceListKind, cityId?: string): Observable<ReferenceListRow[]> {
    return this.api.get<ReferenceListRow[]>(API_ENDPOINTS.admin.referenceList(kind), {
      params: cityId ? { cityId } : {},
    });
  }

  addReferenceItem(
    kind: ReferenceListKind,
    request: ReferenceListRequest,
  ): Observable<ReferenceListRow> {
    return this.api.post<ReferenceListRow, ReferenceListRequest>(
      API_ENDPOINTS.admin.referenceList(kind),
      request,
    );
  }

  updateReferenceItem(
    kind: ReferenceListKind,
    id: string,
    request: ReferenceListRequest,
  ): Observable<ReferenceListRow> {
    return this.api.put<ReferenceListRow, ReferenceListRequest>(
      API_ENDPOINTS.admin.referenceItem(kind, id),
      request,
    );
  }

  /**
   * FR-ADM-05 — deleting an entry that live records point at is refused by the
   * server, not hidden by the client: the count on screen can be a minute old,
   * and the server is the only place that knows for certain.
   */
  deleteReferenceItem(kind: ReferenceListKind, id: string): Observable<void> {
    return this.api.delete<void>(API_ENDPOINTS.admin.referenceItem(kind, id));
  }

  /** The whole new order in one call, so a drag cannot land half-applied. */
  reorderReferenceList(kind: ReferenceListKind, ids: readonly string[]): Observable<void> {
    return this.api.put<void, { ids: readonly string[] }>(
      API_ENDPOINTS.admin.referenceOrder(kind),
      {
        ids,
      },
    );
  }

  // ── CMS ────────────────────────────────────────────────────────────────
  cmsPages(): Observable<CmsPageDetail[]> {
    return this.api.get<CmsPageDetail[]>(API_ENDPOINTS.admin.cmsPages);
  }

  cmsPage(slug: string): Observable<CmsPageDetail> {
    return this.api.get<CmsPageDetail>(API_ENDPOINTS.admin.cmsPageBySlug(slug));
  }

  saveCmsPage(slug: string, page: Partial<CmsPageDetail>): Observable<void> {
    return this.api.put<void, Partial<CmsPageDetail>>(
      API_ENDPOINTS.admin.cmsPageBySlug(slug),
      page,
    );
  }

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
