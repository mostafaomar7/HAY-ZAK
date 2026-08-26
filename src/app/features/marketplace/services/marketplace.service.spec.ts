import { provideHttpClient } from '@angular/common/http';
import type { HttpTestingController } from '@angular/common/http/testing';
import {
  HttpTestingController as Controller,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MarketplaceService } from './marketplace.service';

/**
 * What this service must never send.
 *
 * `GET /public/units` rejects four combinations with a 422 rather than
 * ignoring them, and three of those can only arise from controls on the
 * results page rather than from anything a visitor typed: a "nearest" sort
 * with no location behind it, a radius with no point to measure from, and one
 * end of a date range. A visitor who cannot see why the page went red is owed
 * a request that was never going to be refused.
 *
 * These were established against the running server, one probe each — see
 * `docs/api/backend-notes.md`. The assertions are on the query string because
 * that is where the contract lives; an unrecognised parameter is also a 422,
 * so what is *absent* matters as much as what is present.
 */
describe('MarketplaceService', () => {
  let service: MarketplaceService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MarketplaceService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(MarketplaceService);
    http = TestBed.inject(Controller);
  });

  afterEach(() => http.verify());

  /** The parameters of the single request the service just made. */
  function sent(): URLSearchParams {
    const request = http.expectOne((candidate) => candidate.url.endsWith('/public/units'));
    request.flush({
      success: true,
      data: {
        items: [],
        pagination: { page: 1, pageSize: 12, total: 0, totalPages: 0, hasNextPage: false },
      },
    });
    return new URLSearchParams(request.request.params.toString());
  }

  it('asks for the opening screen with nothing but paging', () => {
    service.search({}).subscribe();

    const params = sent();
    expect(params.get('page')).toBe('1');
    expect(params.get('pageSize')).toBe('12');
    // Anything else here would be a filter nobody chose.
    expect([...params.keys()].sort()).toEqual(['page', 'pageSize']);
  });

  it('falls back to newest when "nearest" has no point behind it', () => {
    service.search({ sort: 'nearest' }).subscribe();

    // 422: "الترتيب بالأقرب محتاج موقع".
    expect(sent().get('sort')).toBe('newest');
  });

  it('keeps "nearest" once a point is given', () => {
    service.search({ sort: 'nearest', lat: 24.69, lng: 46.68, radiusKm: 5 }).subscribe();

    const params = sent();
    expect(params.get('sort')).toBe('nearest');
    expect(params.get('lat')).toBe('24.69');
    expect(params.get('radiusKm')).toBe('5');
  });

  it('drops a radius that has no point to measure from', () => {
    service.search({ radiusKm: 5 }).subscribe();

    // The server accepts this and silently ignores it, which is worse than a
    // refusal: the page would claim a filter it is not applying.
    expect(sent().has('radiusKm')).toBeFalse();
  });

  it('drops a half of a date range rather than sending it', () => {
    service.search({ startDate: '2026-09-01' }).subscribe();

    const params = sent();
    expect(params.has('startDate')).toBeFalse();
    expect(params.has('endDate')).toBeFalse();
  });

  it('sends both ends of a date range together', () => {
    service.search({ startDate: '2026-09-01', endDate: '2026-09-10' }).subscribe();

    const params = sent();
    expect(params.get('startDate')).toBe('2026-09-01');
    expect(params.get('endDate')).toBe('2026-09-10');
  });

  it('holds back a search term the server would call too short', () => {
    service.search({ q: 'ا' }).subscribe();

    expect(sent().has('q')).toBeFalse();
  });

  /**
   * An Arabic term must reach the wire encoded exactly once.
   *
   * Percent-encoding an already-encoded string is the classic way a search box
   * comes back empty for every Arabic word while every Latin one behaves — the
   * server receives `%25D9%2585…`, matches nothing, and answers 200 with zero
   * results, which looks like a broken search rather than a broken client.
   *
   * `HttpParams` encodes; nothing in this codebase calls encodeURIComponent.
   * That is a property worth pinning rather than re-deducing, because the
   * failure it prevents is silent on both sides.
   */
  it('sends an Arabic term encoded exactly once', () => {
    service.search({ q: 'مستودع' }).subscribe();

    const request = http.expectOne((candidate) => candidate.url.endsWith('/public/units'));
    const serialised = request.request.params.toString();
    request.flush({
      success: true,
      data: {
        items: [],
        pagination: { page: 1, pageSize: 12, total: 0, totalPages: 0, hasNextPage: false },
      },
    });

    // Angular leaves Arabic characters literal in the serialised params and
    // the browser encodes them once on the way out; either is fine. A `%25`
    // is not — that is a percent sign that was itself encoded.
    expect(serialised).not.toContain('%25');
    expect(decodeURIComponent(serialised)).toContain('q=مستودع');
  });

  it('reads the wire shape into the domain, renaming location to area', () => {
    let received: { area: { radiusMeters: number }; coverUrl: string | null } | undefined;
    service.search({}).subscribe((page) => (received = page.items[0] as never));

    const request = http.expectOne((candidate) => candidate.url.endsWith('/public/units'));
    request.flush({
      success: true,
      data: {
        items: [
          {
            id: 'u-1',
            title: 'مستودع',
            areaSqm: 45,
            dailyPriceHalalas: 7500,
            indicativeMonthlyHalalas: 225000,
            minDays: 3,
            maxDays: 180,
            category: null,
            city: null,
            district: null,
            coverUrl: '/uploads/units/u-1/a.jpg',
            location: {
              latitude: 24.69,
              longitude: 46.68,
              radiusMeters: 300,
              isApproximate: true,
            },
            distanceMeters: null,
            isFullyBooked: false,
            publishedAt: '2026-08-25T10:23:37.528Z',
          },
        ],
        pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1, hasNextPage: false },
      },
    });

    expect(received?.area.radiusMeters).toBe(300);
    // Served from the API's origin, not from under /api/v1.
    expect(received?.coverUrl).not.toContain('/api/v1');
    expect(received?.coverUrl).toContain('/uploads/units/u-1/a.jpg');
  });

  /**
   * A published unit with no location at all.
   *
   * Not hypothetical: 54 of 79 published units on the development server carry
   * `location: null`. The adapter used to spread it — `{ ...null }` is `{}`,
   * which satisfies the type and is not an area — and the map would then place
   * a circle at `undefined, undefined`. Null must survive as null so every
   * screen can decide what to do without one.
   */
  it('keeps a missing location as null rather than an empty area', () => {
    let received: { area: unknown } | undefined;
    service.search({}).subscribe((page) => (received = page.items[0] as never));

    http
      .expectOne((candidate) => candidate.url.endsWith('/public/units'))
      .flush({
        success: true,
        data: {
          items: [
            {
              id: 'u-1',
              title: 'مستودع',
              areaSqm: 45,
              dailyPriceHalalas: 7500,
              indicativeMonthlyHalalas: 225000,
              minDays: 3,
              maxDays: null,
              category: null,
              city: null,
              district: null,
              coverUrl: null,
              location: null,
              distanceMeters: null,
              isFullyBooked: false,
              publishedAt: '2026-08-25T10:23:37.528Z',
            },
          ],
          pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1, hasNextPage: false },
        },
      });

    expect(received?.area).toBeNull();
  });

  /**
   * The availability window has a 365-day ceiling, so the `to` that comes back
   * is not the one asked for. Days past it were never described — unknown, not
   * free — and `unknownFrom` is the first of them.
   */
  it('marks where the availability window stops speaking', () => {
    let received: { unknownFrom: string; blocked: unknown[] } | undefined;
    service.availability('u-1').subscribe((a) => (received = a));

    http
      .expectOne((candidate) => candidate.url.endsWith('/public/units/u-1/availability'))
      .flush({
        success: true,
        data: {
          unitId: 'u-1',
          from: '2026-08-26',
          to: '2026-11-24',
          minDays: 1,
          maxDays: null,
          // Already merged by the server, and half-open: the 11th is free.
          blocked: [{ startDate: '2026-10-05', endDate: '2026-10-11' }],
        },
      });

    expect(received?.unknownFrom).toBe('2026-11-25');
    expect(received?.blocked).toEqual([{ startDate: '2026-10-05', endDate: '2026-10-11' }]);
  });

  it('takes the server at its word about whether there is another page', () => {
    service.search({}).subscribe();

    const request = http.expectOne((candidate) => candidate.url.endsWith('/public/units'));
    request.flush({
      success: true,
      data: {
        items: [],
        // Fewer loaded than the total, but the server says there is no more:
        // a length comparison here would offer a page that does not exist.
        pagination: { page: 1, pageSize: 12, total: 51, totalPages: 5, hasNextPage: false },
      },
    });

    expect(service.hasMore()).toBeFalse();
    expect(service.total()).toBe(51);
  });
});
