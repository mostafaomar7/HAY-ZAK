import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BookingStatus } from '@core/enums/booking-status.enum';
import type { Booking } from '@core/models/booking.model';
import { RequestDetailPage } from './request-detail-page';

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
    dailyPriceSnapshot: 60,
    subtotal: 1800,
    commissionAmount: 90,
    vatAmount: 0,
    totalAmount: 1800,
    goodsDescription: 'كراتين أثاث منزلي.',
    prohibitedAck: true,
    status,
    counterpartyContact: renterName ? { fullName: renterName, mobile: '0555555555' } : undefined,
    createdAt: '2026-08-10T09:00:00Z',
  };
}

describe('RequestDetailPage', () => {
  let fixture: ComponentFixture<RequestDetailPage>;
  let http: HttpTestingController;

  function render(booking: Booking): HTMLElement {
    fixture = TestBed.createComponent(RequestDetailPage);
    fixture.componentRef.setInput('id', 'bk-1');
    fixture.detectChanges();

    http
      .expectOne((r) => r.url.endsWith('/bookings/bk-1'))
      .flush({
        data: booking,
        success: true,
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

  it('shows the period, goods and the net after commission', () => {
    const el = render(makeBooking(BookingStatus.PaidPendingApproval));

    expect(el.textContent).toContain('كراتين أثاث منزلي.');
    expect(el.textContent).toContain('1,800.00');
    expect(el.textContent).toContain('90.00');
    // 1800 − 90, computed here because the payload carried no netToLessor.
    expect(el.textContent).toContain('1,710.00');
  });

  // FR-LSR-09 — the panel must not contain the renter's details pre-approval.
  it('hides the renter behind the locked panel before approval', () => {
    const el = render(makeBooking(BookingStatus.PaidPendingApproval, 'فهد الدوسري'));

    expect(el.querySelector('app-ui-locked-panel')).not.toBeNull();
    expect(el.textContent).not.toContain('فهد الدوسري');
    expect(el.textContent).not.toContain('0555555555');
    expect(el.textContent).toContain('تظهر بيانات المستأجر بعد اعتماد الطلب');
  });

  it('reveals the renter and a callable number once approved', () => {
    const el = render(makeBooking(BookingStatus.Approved, 'فهد الدوسري'));

    expect(el.querySelector('app-ui-locked-panel')).toBeNull();
    expect(el.textContent).toContain('فهد الدوسري');
    expect(el.querySelector('a[href="tel:0555555555"]')).not.toBeNull();
  });

  it('withholds the contract until the booking is approved', () => {
    const pending = render(makeBooking(BookingStatus.PaidPendingApproval));
    expect(pending.textContent).toContain('يصدر العقد بعد اعتماد الطلب');
    expect(pending.textContent).not.toContain('تنزيل العقد');
  });

  it('offers the contract once approved', () => {
    const el = render(makeBooking(BookingStatus.Approved, 'فهد الدوسري'));
    expect(el.textContent).toContain('تنزيل العقد');
  });

  // FR-LSR-06 — no decision control, in any state.
  it('exposes no approve or reject control', () => {
    for (const status of [
      BookingStatus.PaidPendingApproval,
      BookingStatus.Approved,
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

    it('marks review as current while awaiting a decision', () => {
      const steps = stepStates(render(makeBooking(BookingStatus.PaidPendingApproval)));

      expect(steps[0]).toEqual(jasmine.objectContaining({ done: true }));
      expect(steps[1]).toEqual(jasmine.objectContaining({ label: 'قيد المراجعة', current: true }));
      expect(steps[2]).toEqual(jasmine.objectContaining({ done: false, current: false }));
    });

    it('replaces the tail with a failed step for a terminal rejection', () => {
      const steps = stepStates(render(makeBooking(BookingStatus.RejectedRefunded)));

      expect(steps.length).toBe(2);
      expect(steps[1].label).toBe('مرفوض ومُسترد');
      expect(fixture.nativeElement.querySelector('.step--failed')).not.toBeNull();
    });
  });
});
