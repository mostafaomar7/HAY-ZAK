import { HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, of } from 'rxjs';
import { catchError, shareReplay } from 'rxjs/operators';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { BUNDLED_PAGES } from '@core/constants/static-pages';
import { SKIP_AUTH } from '@core/interceptors/auth.interceptor';
import type {
  ContactRequest,
  ContactResult,
  StaticPage,
  StaticPageSlug,
} from '@core/models/content.model';
import { LoggerService } from '@core/services/logger.service';
import { ApiService } from '@core/services/api.service';

/**
 * The seven static pages (FR-CMS-01).
 *
 * Pages are cached per slug for the session: they change when an administrator
 * publishes a new version, which is rare, and re-fetching the terms every time a
 * footer link is followed is pure latency.
 *
 * **The server wins, and the bundle catches.** `/content/pages/:slug` is not
 * shipped — every one of them answers 404 — and four of these pages are links
 * in the header and the footer of every screen, so a visitor's second click was
 * landing on an error. "تعذّر تحميل الشروط والأحكام" is not something to show
 * somebody who came to read the terms.
 *
 * So a failure falls back to the copy in `content.pages.ts` rather than
 * surfacing. The order matters: asking the server first means the day the CMS
 * ships, an administrator's published version takes over with no change here,
 * and the bundle quietly becomes what it should be — what is shown when the CMS
 * is unreachable, which for a legal document is worth having regardless.
 *
 * The contact form is not cached — it is a write.
 */
@Injectable({ providedIn: 'root' })
export class ContentService {
  private readonly api = inject(ApiService);
  private readonly log = inject(LoggerService);

  private readonly context = new HttpContext().set(SKIP_AUTH, true);
  private readonly pages = new Map<StaticPageSlug, Observable<StaticPage>>();

  page(slug: StaticPageSlug): Observable<StaticPage> {
    let cached = this.pages.get(slug);
    if (!cached) {
      cached = this.api
        .get<StaticPage>(API_ENDPOINTS.content.pageBySlug(slug), { context: this.context })
        .pipe(
          catchError(() => {
            // Said once per slug per session, in the console rather than on the
            // page: the visitor is reading the document either way, and which
            // copy it came from is the developer's problem, not theirs.
            this.log.warn(`المحتوى غير متاح من السيرفر — عُرضت النسخة المضمّنة: ${slug}`);
            return of(BUNDLED_PAGES[slug]);
          }),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
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
