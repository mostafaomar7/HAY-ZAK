import { provideHttpClient } from '@angular/common/http';
import type { HttpTestingController } from '@angular/common/http/testing';
import {
  HttpTestingController as Controller,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NotificationInboxService } from './notification-inbox.service';

function row(over: Record<string, unknown> = {}) {
  return {
    id: 'n-1',
    type: 'booking.confirmed',
    title: 'تم تأكيد حجزك',
    body: 'حجز HZ-2026-08-0307 — تم الدفع وتأكيد الحجز.',
    reference: { type: 'booking', id: 'bk-1' },
    readAt: null,
    createdAt: '2026-08-26T10:00:00Z',
    ...over,
  };
}

/**
 * The badge, the links, and the one number that must never be invented here.
 *
 * `unreadCount` is a fact the server owns. This service keeps a local copy so
 * the badge moves the instant somebody opens a notification, and every path out
 * of that has to end with the server's number — including the failing one,
 * which is where a client quietly starts showing a figure of its own.
 */
describe('NotificationInboxService', () => {
  let service: NotificationInboxService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(NotificationInboxService);
    http = TestBed.inject(Controller);
  });

  afterEach(() => http.verify());

  function loadWith(items: unknown[], unreadCount: number) {
    service.load().subscribe();
    http
      .expectOne((r) => r.url.endsWith('/me/notifications'))
      .flush({ success: true, data: { items, unreadCount } });
  }

  it('takes the badge from the response, not from the rows on screen', () => {
    // Ninety-one notifications, two unread, twelve on this page. Counting what
    // is loaded would show whatever happened to be in the first twelve.
    loadWith([row(), row({ id: 'n-2', readAt: '2026-08-26T11:00:00Z' })], 91);

    expect(service.unreadCount()).toBe(91);
  });

  it('takes the badge from the response again after marking one read', () => {
    loadWith([row()], 3);
    service.markRead('n-1');

    const request = http.expectOne((r) => r.url.endsWith('/me/notifications/n-1/read'));
    // PUT, not POST. POST is a 404 on this endpoint.
    expect(request.request.method).toBe('PUT');
    request.flush({ success: true, data: { read: true, unreadCount: 2 } });

    // Two numbers for one fact disagree eventually, and the server's is true.
    expect(service.unreadCount()).toBe(2);
  });

  it('puts the count back when marking read fails', () => {
    loadWith([row()], 3);
    service.markRead('n-1');

    http
      .expectOne((r) => r.url.endsWith('/me/notifications/n-1/read'))
      .flush({}, { status: 500, statusText: 'Server Error' });

    // The optimistic decrement is an affordance, not an answer. Leaving it in
    // place after a failure is how a badge starts holding a number nobody
    // sent — and it survives until the next load, which may be minutes.
    expect(service.unreadCount()).withContext('rolled back to the server figure').toBe(3);
  });

  it('leaves the row read even when the count rolls back', () => {
    loadWith([row()], 3);
    service.markRead('n-1');

    http
      .expectOne((r) => r.url.endsWith('/me/notifications/n-1/read'))
      .flush({}, { status: 500, statusText: 'Server Error' });

    // The person has read it either way; re-bolding it argues with them.
    expect(service.notifications()[0].isRead).toBeTrue();
  });

  it('does not send a second request for one already read', () => {
    loadWith([row({ readAt: '2026-08-26T11:00:00Z' })], 0);
    service.markRead('n-1');

    // Marking twice is a 200 rather than an error, so this saves a round trip
    // rather than avoiding a failure — a double-tap on a phone is not a fault.
    http.expectNone((r) => r.url.endsWith('/me/notifications/n-1/read'));
  });

  it('restores the count when mark-all fails', () => {
    loadWith([row(), row({ id: 'n-2' })], 2);
    service.markAllRead();
    expect(service.unreadCount()).withContext('optimistic').toBe(0);

    http
      .expectOne((r) => r.url.endsWith('/me/notifications/read-all'))
      .flush({}, { status: 500, statusText: 'Server Error' });

    expect(service.unreadCount()).toBe(2);
  });

  describe('deep links', () => {
    function linkFor(reference: unknown): string | undefined {
      loadWith([row({ reference })], 1);
      return service.notifications()[0].targetUrl;
    }

    it('points a booking at the booking', () => {
      expect(linkFor({ type: 'booking', id: 'bk-1' })).toBe('/my-bookings/bk-1');
    });

    it('points a complaint at the conversation', () => {
      expect(linkFor({ type: 'complaint', id: 'cmp-1' })).toBe('/my-complaints/cmp-1');
    });

    it("points a unit at the owner's screen, not the public listing", () => {
      // Only a lessor is told anything about a unit — approved, rejected,
      // suspended — so the public page would be the wrong destination.
      expect(linkFor({ type: 'unit', id: 'u-1' })).toBe('/lessor/units/u-1');
    });

    it('points a payout at earnings, which is the only page it has', () => {
      expect(linkFor({ type: 'payout', id: 'pay-1' })).toBe('/lessor/earnings');
    });

    it('gives an unknown kind no link at all', () => {
      // A notification that does nothing when clicked beats one that opens the
      // wrong screen, and a new server-side kind must not become a guess.
      expect(linkFor({ type: 'invoice', id: 'inv-1' })).toBeUndefined();
    });

    it('gives a null reference no link', () => {
      expect(linkFor(null)).toBeUndefined();
    });
  });

  it('asks for unread only when the bell does, and never for the read ones', () => {
    service.load({ unreadOnly: true, pageSize: 10 }).subscribe();

    const request = http.expectOne((r) => r.url.endsWith('/me/notifications'));
    expect(request.request.params.get('unreadOnly')).toBe('true');
    expect(request.request.params.get('pageSize')).toBe('10');
    request.flush({ success: true, data: { items: [], unreadCount: 0 } });

    service.load({ unreadOnly: false }).subscribe();

    const second = http.expectOne((r) => r.url.endsWith('/me/notifications'));
    // Omitted rather than `false`, which would read as "the read ones".
    expect(second.request.params.has('unreadOnly')).toBeFalse();
    second.flush({ success: true, data: { items: [], unreadCount: 0 } });
  });
});
