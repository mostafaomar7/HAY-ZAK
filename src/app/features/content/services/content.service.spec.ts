import { provideHttpClient } from '@angular/common/http';
import type { HttpTestingController } from '@angular/common/http/testing';
import {
  HttpTestingController as Controller,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { STATIC_PAGE_SLUGS } from '@core/models/content.model';
import { BUNDLED_PAGES } from '@core/constants/static-pages';
import { ContentService } from './content.service';

/**
 * The seven pages must arrive whatever the server does.
 *
 * Four of them are links in the header and the footer of every screen, and
 * `/content/pages/:slug` is not shipped — so until the CMS exists, the failure
 * path *is* the path. What these assert is the order: the server is asked
 * first, so the day an administrator publishes a version it wins without a
 * change here, and the bundle is only reached when the request does not answer.
 */
describe('ContentService', () => {
  let service: ContentService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ContentService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ContentService);
    http = TestBed.inject(Controller);
  });

  afterEach(() => http.verify());

  it('asks the server before it reaches for the bundle', () => {
    service.page('terms').subscribe();

    const request = http.expectOne((candidate) => candidate.url.endsWith('/content/pages/terms'));
    // Public: a guest reads the terms, and a bearer here would mean a signed-in
    // visitor could be served a different document.
    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush({ success: true, data: { ...BUNDLED_PAGES.terms, title: 'من الخادم' } });
  });

  it('prefers the published version over the bundled one', () => {
    let received: { title: string } | undefined;
    service.page('faq').subscribe((page) => (received = page));

    http
      .expectOne((candidate) => candidate.url.endsWith('/content/pages/faq'))
      .flush({ success: true, data: { ...BUNDLED_PAGES.faq, title: 'نسخة المسؤول' } });

    expect(received?.title).toBe('نسخة المسؤول');
  });

  /** The case that is live today: the CMS module answers 404. */
  it('falls back to the bundled page when the endpoint does not exist', () => {
    let received: { title: string } | undefined;
    service.page('how-it-works').subscribe((page) => (received = page));

    http
      .expectOne((candidate) => candidate.url.endsWith('/content/pages/how-it-works'))
      .flush(
        { success: false, error: { code: 'NOT_FOUND', message: '' } },
        { status: 404, statusText: 'Not Found' },
      );

    expect(received?.title).toBe(BUNDLED_PAGES['how-it-works'].title);
  });

  it('falls back when the request never reaches the server at all', () => {
    let received: { title: string } | undefined;
    service.page('contact').subscribe((page) => (received = page));

    http
      .expectOne((candidate) => candidate.url.endsWith('/content/pages/contact'))
      .error(new ProgressEvent('offline'));

    expect(received?.title).toBe(BUNDLED_PAGES.contact.title);
  });

  it('does not re-request a page it already resolved', () => {
    service.page('privacy').subscribe();
    http
      .expectOne((candidate) => candidate.url.endsWith('/content/pages/privacy'))
      .flush(
        { success: false, error: { code: 'NOT_FOUND', message: '' } },
        { status: 404, statusText: 'Not Found' },
      );

    let received: { slug: string } | undefined;
    service.page('privacy').subscribe((page) => (received = page));

    // No second request to verify() against — the fallback is replayed.
    expect(received?.slug).toBe('privacy');
  });

  /**
   * A missing entry would be `undefined` reaching a template as a page, which
   * renders as a blank document rather than as an error — so the completeness
   * of the record is asserted rather than assumed.
   *
   * "Has a body" is deliberately not "has sections": the FAQ's content lives in
   * `faqGroups` and the refund policy's in `refundTiers`, and both leave
   * `sections` empty on purpose. Demanding sections of them would be asserting
   * something false about the model.
   */
  it('carries a bundled document for every slug the footer links to', () => {
    for (const slug of STATIC_PAGE_SLUGS) {
      const page = BUNDLED_PAGES[slug];
      expect(page).withContext(slug).toBeDefined();
      expect(page.slug).toBe(slug);
      expect(page.title.length).withContext(`${slug} title`).toBeGreaterThan(0);

      const blocks =
        page.sections.length +
        (page.faqGroups?.length ?? 0) +
        (page.refundTiers?.length ?? 0) +
        (page.journeys?.length ?? 0) +
        (page.contactChannels?.length ?? 0);
      expect(blocks).withContext(`${slug} has something to render`).toBeGreaterThan(0);
    }
  });
});
