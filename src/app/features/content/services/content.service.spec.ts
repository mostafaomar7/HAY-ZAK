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
 * `/public/pages/:slug` answers 404 for a page nobody has published — and 404
 * rather than 403, deliberately, so that being able to tell "hidden" from
 * "absent" cannot leak what is being drafted. Either way the failure
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
    service.page('about').subscribe();

    const request = http.expectOne((candidate) => candidate.url.endsWith('/public/pages/about'));
    // Public: a guest reads these, and a bearer here would mean a signed-in
    // visitor could be served a different document.
    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush({ success: true, data: { ...BUNDLED_PAGES.about, title: 'من الخادم' } });
  });

  /**
   * The terms are not a CMS page. They live in their own versioned table, and
   * `/auth/terms` is where the `termsVersionId` a registration records consent
   * against comes from — a second copy under `/public/pages/terms` would be a
   * second legal document that could disagree with the one somebody signed.
   */
  it('reads the terms from the versioned endpoint, not from the CMS', () => {
    let received: { title: string; sections: { body: string }[] } | undefined;
    service.page('terms').subscribe((page) => (received = page));

    const request = http.expectOne((candidate) => candidate.url.endsWith('/auth/terms'));
    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush({
      success: true,
      data: {
        id: 'terms-v9',
        versionNo: 9,
        effectiveFrom: '2026-08-12T00:00:00Z',
        content: 'الفقرة الأولى.\n\nالفقرة الثانية.',
      },
    });

    // Each blank-line-separated paragraph becomes an untitled section: the
    // endpoint sends prose, and inventing headings for a legal text would be
    // putting words in it.
    expect(received?.sections.map((section) => section.body)).toEqual([
      'الفقرة الأولى.',
      'الفقرة الثانية.',
    ]);
  });

  it('prefers the published version over the bundled one', () => {
    let received: { title: string } | undefined;
    service.page('faq').subscribe((page) => (received = page));

    http
      .expectOne((candidate) => candidate.url.endsWith('/public/pages/faq'))
      .flush({ success: true, data: { ...BUNDLED_PAGES.faq, title: 'نسخة المسؤول' } });

    expect(received?.title).toBe('نسخة المسؤول');
  });

  /** The case that is live today: the CMS module answers 404. */
  it('falls back to the bundled page when the endpoint does not exist', () => {
    let received: { title: string } | undefined;
    service.page('how-it-works').subscribe((page) => (received = page));

    http
      .expectOne((candidate) => candidate.url.endsWith('/public/pages/how-it-works'))
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
      .expectOne((candidate) => candidate.url.endsWith('/public/pages/contact'))
      .error(new ProgressEvent('offline'));

    expect(received?.title).toBe(BUNDLED_PAGES.contact.title);
  });

  it('does not re-request a page it already resolved', () => {
    service.page('privacy').subscribe();
    http
      .expectOne((candidate) => candidate.url.endsWith('/public/pages/privacy'))
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
