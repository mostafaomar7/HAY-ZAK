import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BookingStatus } from '@core/enums/booking-status.enum';
import type { Booking } from '@core/models/booking.model';
import { RequestCard } from './request-card';

function makeBooking(status: BookingStatus, renterName?: string): Booking {
  return {
    id: 'bk-1',
    referenceNo: 'HZ-2026-01078',
    unitId: 'un-1',
    unit: { id: 'un-1', title: 'قراج مغلق — الملقا', images: [], visitSchedule: [] },
    renterId: 'r-1',
    startDate: '2026-08-12',
    endDate: '2026-09-11',
    daysCount: 30,
    dailyPriceSnapshotHalalas: 6000,
    subtotalHalalas: 180000,
    commissionHalalas: 18000,
    vatHalalas: 2700,
    totalHalalas: 180000,
    goodsDescription: 'كراتين أثاث منزلي.',
    prohibitedAck: true,
    status,
    counterpartyContact: renterName ? { fullName: renterName, mobile: '0555555555' } : undefined,
    createdAt: '2026-08-10T09:00:00Z',
  };
}

describe('RequestCard', () => {
  let fixture: ComponentFixture<RequestCard>;

  function render(booking: Booking) {
    fixture = TestBed.createComponent(RequestCard);
    fixture.componentRef.setInput('booking', booking);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RequestCard],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('shows the unit, goods and total', () => {
    const el = render(makeBooking(BookingStatus.Confirmed));
    expect(el.textContent).toContain('قراج مغلق — الملقا');
    expect(el.textContent).toContain('كراتين أثاث منزلي.');
    expect(el.textContent).toContain('1,800.00');
  });

  // FR-LSR-06 / SRS §2.5 — the lessor has no say, and the UI must not imply one.
  //
  // Asserted structurally rather than by scanning for words: the status labels
  // legitimately read "مدفوع — بانتظار الموافقة" and "مقبول", so a substring
  // check would fail on correct output. What must hold is that the card exposes
  // no control capable of deciding anything — zero buttons in every state, and
  // at most the one link to the read-only detail view.
  it('offers no actionable control in any booking state', () => {
    for (const status of Object.values(BookingStatus)) {
      const el = render(makeBooking(status, 'سارة العتيبي'));

      expect(el.querySelectorAll('button').length).withContext(status).toBe(0);
      expect(el.querySelectorAll('input, select, textarea').length).withContext(status).toBe(0);

      const links = el.querySelectorAll('a');
      expect(links.length).withContext(status).toBeLessThanOrEqual(1);
      for (const link of Array.from(links)) {
        expect(link.getAttribute('href')).withContext(status).toBe('/lessor/requests/bk-1');
      }
    }
  });

  // Identity is released on confirmation, never before.
  it('withholds the renter name before confirmation even when the payload carries it', () => {
    const el = render(makeBooking(BookingStatus.AwaitingPayment, 'سارة العتيبي'));
    expect(el.textContent).not.toContain('سارة العتيبي');
    expect(el.textContent).toContain('تظهر بيانات المستأجر بعد موافقة الإدارة');
  });

  it('shows the renter name once the booking is approved', () => {
    const el = render(makeBooking(BookingStatus.Confirmed, 'سارة العتيبي'));
    expect(el.textContent).toContain('سارة العتيبي');
  });

  it('renders a draft as a non-navigable card', () => {
    const el = render(makeBooking(BookingStatus.Draft));
    expect(el.querySelector('a.req')).toBeNull();
    expect(el.querySelector('.req--draft')).not.toBeNull();
    expect(el.textContent).toContain('لم يستكمل المستأجر الطلب');
  });

  it('links to the detail view for a real booking', () => {
    const el = render(makeBooking(BookingStatus.Active, 'سارة العتيبي'));
    expect(el.querySelector('a.req')?.getAttribute('href')).toBe('/lessor/requests/bk-1');
  });
});
