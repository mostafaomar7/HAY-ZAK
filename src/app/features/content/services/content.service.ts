import { HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { SKIP_AUTH } from '@core/interceptors/auth.interceptor';
import type {
  ContactRequest,
  ContactResult,
  StaticPage,
  StaticPageSlug,
} from '@core/models/content.model';
import { ApiService } from '@core/services/api.service';

/**
 * The seven static pages (FR-CMS-01).
 *
 * Pages are cached per slug for the session: they change when an administrator
 * publishes a new version, which is rare, and re-fetching the terms every time a
 * footer link is followed is pure latency.
 *
 * The contact form is not cached — it is a write.
 */
@Injectable({ providedIn: 'root' })
export class ContentService {
  private readonly api = inject(ApiService);

  private readonly context = new HttpContext().set(SKIP_AUTH, true);
  private readonly pages = new Map<StaticPageSlug, Observable<StaticPage>>();

  page(slug: StaticPageSlug): Observable<StaticPage> {
    let cached = this.pages.get(slug);
    if (!cached) {
      cached = this.api
        .get<StaticPage>(API_ENDPOINTS.content.pageBySlug(slug), { context: this.context })
        .pipe(shareReplay({ bufferSize: 1, refCount: false }));
      this.pages.set(slug, cached);
    }
    return cached;
  }

  submitContact(payload: ContactRequest): Observable<ContactResult> {
    return this.api.post<ContactResult, ContactRequest>(API_ENDPOINTS.content.contact, payload, {
      context: this.context,
    });
  }

  /** Call after an administrator republishes a page. */
  invalidate(): void {
    this.pages.clear();
  }
}
