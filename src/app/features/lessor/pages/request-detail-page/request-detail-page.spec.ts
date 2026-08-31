import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BookingStatus } from '@core/enums/booking-status.enum';
import type { RenterBooking } from '@core/models/renter-booking';
import { RequestDetailPage } from './request-detail-page';

function makeBooking(status: BookingStatus, renterName?: string): RenterBooking {
  return {
    id: 'bk-1',
    referenceNo: 'HZ-2026-01078',
    status,
    unit: {
      id: 'un-1',
      title: 'قراج مغلق — الملقا',
      addressLine: null,
      city: { id: 'riyadh', nameAr: 'الرياض', nameEn: 'Riyadh' },
      coverUrl: null,
    },
    startDate: '2026-08-12',
    endDate: '2026-09-11',
    nights: 30,
    price: {
      dailyPriceHalalas: 6000,
      subtotalHalalas: 180000,
      vatHalalas: 0,
      totalHalalas: 180000,
    },
    // The lessor's half: this is `/lessor/bookings`, which is the only place
    // these two figures exist.
    commission: { rateBps: 1000, commissionHalalas: 18000, netToLessorHalalas: 162000 },
    goodsDescription: 'كراتين أثاث منزلي.',
    contact: renterName ? { fullName: renterName, mobile: '0555555555' } : null,
    confirmedAt: null,
    createdAt: '2026-08-10T09:00:00Z',
  };
}

describe('RequestDetailPage', () => {
  let fixture: ComponentFixture<RequestDetailPage>;
  let http: HttpTestingController;

  function render(booking: RenterBooking): HTMLElement {
    fixture = TestBed.createComponent(RequestDetailPage);
    fixture.componentRef.setInput('id', 'bk-1');
    fixture.detectChanges();

    // `/lessor/bookings/:id`, wrapped in `{ booking }` and carrying the wire's
    // own names — `daysCount` for a count of nights, and the commission inside
    // `price`. Flushing the domain shape here would test the adapter's output
    // against itself and pass whatever the server actually sends.
    http
      .expectOne((r) => r.url.endsWith('/lessor/bookings/bk-1'))
      .flush({
        success: true,
        data: {
          booking: {
            id: booking.id,
            referenceNo: booking.referenceNo,
            status: booking.status,
            unit: booking.unit,
            startDate: booking.startDate,
            endDate: booking.endDate,
            daysCount: booking.nights,
            price: {
              ...booking.price,
              ...(booking.commission
                ? {
                    commissionRateBps: booking.commission.rateBps,
                    commissionHalalas: booking.commission.commissionHalalas,
                    netToLessorHalalas: booking.commission.netToLessorHalalas,
                  }
                : {}),
            },
            goodsDescription: booking.goodsDescription,
            contact: booking.contact,
            confirmedAt: booking.confirmedAt,
            createdAt: booking.createdAt,
          },
        },
      });
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RequestDetailPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /**
   * The net is the server's number, not a subtraction of ours.
   *
   * It used to fall back to `subtotal - commission` when the payload carried
   * none — the same arithmetic the server does, until the day it is not: a
   * commission exception for one lessor, a rounding rule, a fee. Now the
   * figure is read, and its absence is shown as absent.
   */
  it('shows the period, goods and the net the server sent', () => {
    const el = render(makeBooking(BookingStatus.Confirmed));

    expect(el.textContent).toContain('كراتين أثاث منزلي.');
    expect(el.textContent).toContain('1,800.00');
    expect(el.textContent).toContain('180.00');
    expect(el.textContent).toContain('1,620.00');
  });

  it('says nothing rather than inventing a net the server did not send', () => {
    const booking = makeBooking(BookingStatus.Confirmed);
    const el = render({ ...booking, commission: undefined });

    expect(el.textContent).toContain('1,800.00');
    // Neither the commission row nor a derived total.
    expect(el.textContent).not.toContain('1,620.00');
    expect(el.textContent).not.toContain('180.00');
  });

  // The panel must not contain the renter's details before confirmation.
  it('hides the renter behind the locked panel before the booking is paid for', () => {
    const el = render(makeBooking(BookingStatus.AwaitingPayment, 'فهد الدوسري'));

    expect(el.querySelector('app-ui-locked-panel')).not.toBeNull();
    expect(el.textContent).not.toContain('فهد الدوسري');
    expect(el.textContent).not.toContain('0555555555');
    expect(el.textContent).toContain('تظهر بيانات المستأجر بعد اعتماد الطلب');
  });

  it('reveals the renter and a callable number once confirmed', () => {
    const el = render(makeBooking(BookingStatus.Confirmed, 'فهد الدوسري'));

    expect(el.querySelector('app-ui-locked-panel')).toBeNull();
    expect(el.textContent).toContain('فهد الدوسري');
    expect(el.querySelector('a[href="tel:0555555555"]')).not.toBeNull();
  });

  it('withholds the contract until the booking is confirmed', () => {
    const pending = render(makeBooking(BookingStatus.AwaitingPayment));
    expect(pending.textContent).toContain('يصدر العقد بعد اعتماد الطلب');
    expect(pending.textContent).not.toContain('تنزيل العقد');
  });

  it('offers the contract once confirmed', () => {
    const el = render(makeBooking(BookingStatus.Confirmed, 'فهد الدوسري'));
    expect(el.textContent).toContain('تنزيل العقد');
  });

  // FR-LSR-06 — no decision control, in any state.
  it('exposes no approve or reject control', () => {
    for (const status of [
      BookingStatus.AwaitingPayment,
      BookingStatus.Confirmed,
      BookingStatus.Active,
    ]) {
      const el = render(makeBooking(status, 'فهد الدوسري'));
      const labels = Array.from(el.querySelectorAll('button')).map((b) => b.textContent?.trim());
      expect(labels).withContext(status).not.toContain('موافقة');
      expect(labels).withContext(status).not.toContain('رفض');
    }
  });

  describe('stepper', () => {
    const stepStates = (el: HTMLElement) =>
      Array.from(el.querySelectorAll('.step')).map((li) => ({
        label: li.querySelector('.step__label')?.textContent?.trim(),
        done: li.classList.contains('step--done'),
        current: li.classList.contains('step--current'),
      }));

    it('marks confirmation as current once the booking is paid for', () => {
      const steps = stepStates(render(makeBooking(BookingStatus.Confirmed)));

      expect(steps[0]).toEqual(jasmine.objectContaining({ done: true }));
      expect(steps[1]).toEqual(jasmine.objectContaining({ label: 'مؤكَّد', current: true }));
      expect(steps[2]).toEqual(jasmine.objectContaining({ done: false, current: false }));
    });

    it('replaces the tail with a failed step when administration cancels', () => {
      const steps = stepStates(render(makeBooking(BookingStatus.Cancelled)));

      expect(steps.length).toBe(2);
      expect(steps[1].label).toBe('ملغي من الإدارة');
      expect(fixture.nativeElement.querySelector('.step--failed')).not.toBeNull();
    });
  });
});
