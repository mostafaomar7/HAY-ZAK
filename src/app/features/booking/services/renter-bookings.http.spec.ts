import { provideHttpClient } from '@angular/common/http';
import type { HttpTestingController } from '@angular/common/http/testing';
import {
  HttpTestingController as Controller,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BookingStatus } from '@core/enums/booking-status.enum';
import { RenterBookingsService } from './renter-bookings.service';

function wireBooking(over: Record<string, unknown> = {}) {
  return {
    id: 'b-1',
    referenceNo: 'HZ-2026-08-0307',
    status: BookingStatus.AwaitingPayment,
    unit: { id: 'u-1', title: 'مستودع', addressLine: null, city: null },
    startDate: '2028-03-01',
    endDate: '2028-03-05',
    // The wire's name for a count of nights.
    daysCount: 4,
    price: {
      dailyPriceHalalas: 7500,
      subtotalHalalas: 30000,
      vatHalalas: 0,
      totalHalalas: 30000,
    },
    goodsDescription: 'أثاث منزلي',
    contact: null,
    confirmedAt: null,
    createdAt: '2026-08-26T10:59:53.872Z',
    ...over,
  };
}

/**
 * The three things about this endpoint that are quiet when they go wrong.
 *
 * A wrong night count is off by one against dates printed beside it. A
 * commission on a renter's screen is somebody else's arithmetic about a total
 * they already paid in full. And a `returnUrl` that is not this origin is
 * refused by the API — deliberately, because an open return is a phishing
 * tool — so building it wrong breaks payment entirely.
 */
describe('RenterBookingsService', () => {
  let service: RenterBookingsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [RenterBookingsService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(RenterBookingsService);
    http = TestBed.inject(Controller);
  });

  afterEach(() => http.verify());

  it('reads daysCount as nights', () => {
    let nights: number | undefined;
    service.byId('b-1').subscribe(({ booking }) => (nights = booking.nights));

    http
      .expectOne((r) => r.url.endsWith('/renter/bookings/b-1'))
      .flush({ success: true, data: { booking: wireBooking(), holdExpiresAt: null } });

    // 1 March → 5 March is four nights, and the dates are on screen next to it.
    expect(nights).toBe(4);
  });

  it('leaves the commission undefined when the server sent none', () => {
    let commission: unknown;
    service.byId('b-1').subscribe(({ booking }) => (commission = booking.commission));

    http
      .expectOne((r) => r.url.endsWith('/renter/bookings/b-1'))
      .flush({ success: true, data: { booking: wireBooking(), holdExpiresAt: null } });

    // Not zero: zero would render "عمولة المنصة: 0.00" on a renter's receipt.
    expect(commission).toBeUndefined();
  });

  it('reads the commission when it is a lessor looking', () => {
    let commission: { commissionHalalas: number; netToLessorHalalas: number } | undefined;
    service.byId('b-1').subscribe(({ booking }) => (commission = booking.commission));

    http
      .expectOne((r) => r.url.endsWith('/renter/bookings/b-1'))
      .flush({
        success: true,
        data: {
          booking: wireBooking({
            price: {
              dailyPriceHalalas: 7500,
              subtotalHalalas: 37500,
              vatHalalas: 0,
              totalHalalas: 37500,
              commissionRateBps: 1500,
              commissionHalalas: 5625,
              netToLessorHalalas: 31875,
            },
          }),
          holdExpiresAt: null,
        },
      });

    // Deducted from the lessor, not added to the renter: the total charged is
    // unchanged and the two figures sum back to it.
    expect(commission?.commissionHalalas).toBe(5625);
    expect((commission?.commissionHalalas ?? 0) + (commission?.netToLessorHalalas ?? 0)).toBe(
      37500,
    );
  });

  it('keeps the hold deadline beside the booking, and null when nothing is held', () => {
    let hold: string | null | undefined;
    service.byId('b-1').subscribe((result) => (hold = result.holdExpiresAt));

    http
      .expectOne((r) => r.url.endsWith('/renter/bookings/b-1'))
      .flush({
        success: true,
        data: {
          booking: wireBooking({ status: BookingStatus.Confirmed }),
          holdExpiresAt: null,
        },
      });

    expect(hold).toBeNull();
  });

  it('builds returnUrl on this origin, which is the only one the API accepts', () => {
    service.pay('b-1').subscribe();

    const request = http.expectOne((r) => r.url.endsWith('/renter/bookings/b-1/pay'));
    const body = request.request.body as { returnUrl: string };
    request.flush({ success: true, data: { redirectUrl: 'https://gateway.example/checkout/x' } });

    expect(body.returnUrl.startsWith(window.location.origin)).toBeTrue();
    expect(body.returnUrl.endsWith('/bookings/return')).toBeTrue();
  });

  it('unwraps the invoice and reads its daysCount as nights', () => {
    let invoice: { invoiceNo: string; booking: { nights: number } } | undefined;
    service.invoice('b-1').subscribe((result) => (invoice = result));

    const request = http.expectOne((r) => r.url.endsWith('/renter/bookings/b-1/invoice'));
    request.flush({
      success: true,
      data: {
        invoice: {
          id: 'inv-1',
          invoiceNo: 'INV-2026-000041',
          issuedAt: '2026-08-26T11:02:05.674Z',
          taxableHalalas: 30000,
          vatHalalas: 0,
          totalHalalas: 30000,
          vatRateBps: 0,
          qrCode: null,
          booking: {
            id: 'b-1',
            referenceNo: 'HZ-2026-08-0307',
            startDate: '2028-03-01',
            endDate: '2028-03-05',
            daysCount: 4,
            unit: { id: 'u-1', title: 'مستودع' },
          },
        },
      },
    });

    // The endpoint wraps it, and counts nights under the wire's name for days —
    // both of which the page would otherwise read straight off the response.
    expect(invoice?.invoiceNo).toBe('INV-2026-000041');
    expect(invoice?.booking.nights).toBe(4);
  });

  it('leaves the 404 before payment as an error for the page to read', () => {
    let status: number | undefined;
    service.invoice('b-1').subscribe({ error: (e: { status?: number }) => (status = e.status) });

    http
      .expectOne((r) => r.url.endsWith('/renter/bookings/b-1/invoice'))
      .flush(
        { success: false, error: { code: 'INVOICE_NOT_FOUND', message: '' } },
        { status: 404, statusText: 'Not Found' },
      );

    // Nothing is invoiced until it is paid for. The page shows "لم تصدر بعد"
    // rather than an error, but it has to be told, not handed an empty invoice.
    expect(status).toBe(404);
  });

  it('sends the whole booking in one call', () => {
    service
      .create({
        unitId: 'u-1',
        startDate: '2028-03-01',
        endDate: '2028-03-05',
        goodsDescription: 'أثاث منزلي وكراتين',
        prohibitedAck: true,
      })
      .subscribe();

    const request = http.expectOne((r) => r.url.endsWith('/renter/bookings'));
    const body = request.request.body as Record<string, unknown>;
    request.flush({
      success: true,
      data: { booking: wireBooking(), holdExpiresAt: '2026-08-26T11:14:53.272Z' },
    });

    // There is no draft and no separate confirm: the dates, the goods and the
    // acknowledgement go together, and the answer is already holding the dates.
    expect(request.request.method).toBe('POST');
    expect(Object.keys(body).sort()).toEqual([
      'endDate',
      'goodsDescription',
      'prohibitedAck',
      'startDate',
      'unitId',
    ]);
    expect(body['prohibitedAck']).toBeTrue();
  });
});
