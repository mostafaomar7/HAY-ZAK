import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import type {
  CmsPage,
  CreateCmsPageRequest,
  UpdateCmsPageRequest,
  WireCmsPageResponse,
  WireCmsPagesResponse,
} from '@core/models/cms-page';
import { cmsPageFromWire } from '@core/models/cms-page';
import { ApiService } from '@core/services/api.service';

/**
 * The editable pages (FR-CMS-01) — `cms:manage`, held by the system
 * administrator and the operations supervisor.
 *
 * These are the pages in the header and the footer of every screen: the terms,
 * the privacy notice, how the platform works, the refund policy. They ship
 * bundled in the application so the site reads before this module is populated
 * (`core/constants/static-pages.ts`), and an administrator's published version
 * takes over the moment one exists.
 */
@Injectable()
export class AdminCmsService {
  private readonly api = inject(ApiService);

  list(): Observable<CmsPage[]> {
    return this.api
      .get<WireCmsPagesResponse>(API_ENDPOINTS.admin.cmsPages)
      .pipe(map((response) => (response.pages ?? []).map(cmsPageFromWire)));
  }

  byId(id: string): Observable<CmsPage> {
    return this.api
      .get<WireCmsPageResponse>(API_ENDPOINTS.admin.cmsPageById(id))
      .pipe(map((response) => cmsPageFromWire(response.page)));
  }

  create(request: CreateCmsPageRequest): Observable<CmsPage> {
    return this.api
      .post<WireCmsPageResponse, CreateCmsPageRequest>(API_ENDPOINTS.admin.cmsPages, request)
      .pipe(map((response) => cmsPageFromWire(response.page)));
  }

  update(id: string, request: UpdateCmsPageRequest): Observable<CmsPage> {
    return this.api
      .put<WireCmsPageResponse, UpdateCmsPageRequest>(API_ENDPOINTS.admin.cmsPageById(id), request)
      .pipe(map((response) => cmsPageFromWire(response.page)));
  }

  /**
   * Publishing and unpublishing is a partial update carrying one field.
   *
   * Not a resend of the whole page: two people with the editor open would
   * otherwise have one of them publish a draft that silently reverts the
   * other's correction. One flag, one field.
   */
  setPublished(id: string, isPublished: boolean): Observable<CmsPage> {
    return this.update(id, { isPublished });
  }
}
