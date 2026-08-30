import { HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { BUNDLED_PAGES } from '@core/constants/static-pages';
import { LegalDocumentType } from '@core/enums/operations.enum';
import { SKIP_AUTH } from '@core/interceptors/auth.interceptor';
import type {
  ContactRequest,
  ContactResult,
  StaticPage,
  StaticPageSlug,
} from '@core/models/content.model';
import type { SignupTerms } from '@core/models/user.model';
import { LoggerService } from '@core/services/logger.service';
import { ApiService } from '@core/services/api.service';

/**
 * The seven static pages (FR-CMS-01).
 *
 * Pages are cached per slug for the session: they change when an administrator
 * publishes a new version, which is rare, and re-fetching the terms every time a
 * footer link is followed is pure latency.
 *
 * **The server wins, and the bundle catches.** `/public/pages/:slug` answers
 * 404 for anything an administrator has not published — 404 and not 403, so
 * that being able to tell "hidden" from "absent" cannot leak what is being
 * drafted. Four of these pages are links in the header and the footer of every
 * screen, so an unpublished slug would otherwise put a visitor's second click
 * on an error, and "تعذّر تحميل الشروط والأحكام" is not something to show
 * somebody who came to read the terms.
 *
 * So a failure falls back to the copy in `core/constants/static-pages.ts`. The
 * order matters: asking the server first means an administrator's published
 * version takes over with no change here, and the bundle stays what it should
 * be — what is shown when the CMS has nothing, which for a legal document is
 * worth having regardless.
 *
 * **The terms are the exception, and they are not a CMS page.** They live in
 * `terms_versions` and come from `GET /auth/terms`, which is also where the
 * `termsVersionId` a registration must record consent against comes from. A
 * copy of them under `/public/pages/terms` would be a second legal document
 * with its own version number, and the two could disagree about what somebody
 * agreed to. So that slug asks the authoritative endpoint first.
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
      cached = (
        slug === 'terms'
          ? this.api
              .get<SignupTerms>(API_ENDPOINTS.auth.terms, { context: this.context })
              .pipe(map(termsAsPage))
          : this.api.get<StaticPage>(API_ENDPOINTS.content.pageBySlug(slug), {
              context: this.context,
            })
      ).pipe(
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

/**
 * The terms as the static-page screen renders them.
 *
 * `content` is one plain string, so each blank-line-separated paragraph
 * becomes an untitled section — the legal pages' numbered side index has
 * nothing to index here, and inventing headings for somebody else's legal text
 * would be putting words in it.
 *
 * `documentType` is `TermsOfUse` because that is the only document this
 * endpoint serves; `acceptedVersionNo` is deliberately absent — whether *this*
 * reader has accepted it is not something `/auth/terms` is told, and claiming
 * it would be the client asserting a consent record it cannot see.
 */
function termsAsPage(terms: SignupTerms): StaticPage {
  const paragraphs = terms.content
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    slug: 'terms',
    title: BUNDLED_PAGES.terms.title,
    version: {
      id: terms.id,
      documentType: LegalDocumentType.TermsOfUse,
      versionNo: String(terms.versionNo),
      effectiveFrom: terms.effectiveFrom,
    },
    sections: paragraphs.map((body, index) => ({
      id: `terms-${index + 1}`,
      title: '',
      body,
    })),
  };
}
