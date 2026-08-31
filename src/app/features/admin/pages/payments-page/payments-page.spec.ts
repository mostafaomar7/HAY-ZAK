import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { BookingStatus } from '@core/enums/booking-status.enum';
import type { WireAdminBooking } from '@core/models/admin.model';
import { environment } from '../../../../../environments/environment';
import { AdminPaymentsPage } from './payments-page';

function booking(overrides: Partial<WireAdminBooking> = {}): WireAdminBooking {
  return {
    id: 'bk-1',
    referenceNo: 'HZ-2026-00981',
    status: BookingStatus.Completed,
    startDate: '2026-08-05',
    endDate: '2026-08-12',
    daysCount: 7,
    totalHalalas: 52500,
    commissionHalalas: 2625,
    netToLessorHalalas: 49875,
    payoutHeld: false,
    unit: { id: 'u-1', title: 'مستودع مكيّف — النرجس' },
    renter: { id: 'r-1', fullName: 'عبدالله القحطاني', mobile: '+966500000001' },
    lessor: { id: 'l-1', fullName: 'سعود العنزي', mobile: '+966500000002' },
    createdAt: '2026-08-04T09:00:00.000Z',
    confirmedAt: '2026-08-04T09:04:00.000Z',
    ...overrides,
  };
}

const REVENUE = {
  success: true,
  data: {
    report: {
      period: { from: null, to: null },
      collectedHalalas: 9_267_000,
      netCashHalalas: 7_500_000,
      commissionHalalas: 1_212_750,
      owedToLessorsHalalas: 6_260_250,
      vatPayableHalalas: 27_000,
      refundedHalalas: 1_155_000,
      paidOutHalalas: 612_000,
    },
  },
};

/**
 * ADM-05 — payment tracking (FR-PAY-08).
 *
 * The screen read `/admin/payments`, which has never existed on any version of
 * the API, so it showed an error box and nothing else for as long as it had
 * been there.
 */
describe('AdminPaymentsPage', () => {
  let fixture: ComponentFixture<AdminPaymentsPage>;
  let http: HttpTestingController;
  let el: HTMLElement;

  const bookingsUrl = `${environment.apiUrl}${API_ENDPOINTS.admin.bookings}`;
  const revenueUrl = `${environment.apiUrl}${API_ENDPOINTS.reports.revenue}`;

  function flush(items: WireAdminBooking[]) {
    const request = http.expectOne((r) => r.url === bookingsUrl);
    request.flush({
      success: true,
      data: {
        items,
        pagination: {
          page: 1,
          pageSize: 20,
          total: items.length,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      },
    });
    http.expectOne((r) => r.url === revenueUrl).flush(REVENUE);
    fixture.detectChanges();
    return request;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminPaymentsPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminPaymentsPage);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => http.verify());

  it('reads the bookings, never `/admin/payments`', () => {
    const request = flush([booking()]);
    expect(request.request.url).toBe(bookingsUrl);
    expect(el.querySelectorAll('.tbl__row').length).toBe(1);
    expect(el.textContent).toContain('عبدالله القحطاني');
    expect(el.textContent).toContain('HZ-2026-00981');
  });

  /**
   * The indicators used to be summed from the rows on screen. A page of twenty
   * out of two hundred, labelled "إجمالي التحصيل", is a wrong number on a
   * finance screen — and one nobody would think to question.
   */
  it('takes the totals from the revenue report, not from the page', () => {
    flush([booking()]);

    const cards = Array.from(el.querySelectorAll('app-admin-kpi-card')).map((c) => c.textContent);
    // 9,267,000 halalas is 92,670 riyals — the period's figure, not the row's.
    expect(cards[0]).toContain('92,670');
    // Rounded to the riyal, as every figure in the console is.
    expect(cards[1]).toContain('12,128');
  });

  /** A zero on a finance screen is a claim; a dash is the absence of one. */
  it('shows a dash rather than zero when the revenue report fails', () => {
    http
      .expectOne((r) => r.url === bookingsUrl)
      .flush({
        success: true,
        data: {
          items: [booking()],
          pagination: {
            page: 1,
            pageSize: 20,
            total: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          },
        },
      });
    http.expectOne((r) => r.url === revenueUrl).error(new ProgressEvent('failed'));
    fixture.detectChanges();

    const cards = Array.from(el.querySelectorAll('app-admin-kpi-card')).map((c) => c.textContent);
    expect(cards[0]).toContain('—');
    // The table under them is unaffected: the two calls fail independently.
    expect(el.querySelectorAll('.tbl__row').length).toBe(1);
  });

  /** The one thing on a row somebody acts on. */
  it('marks a booking whose payout is frozen', () => {
    flush([booking(), booking({ id: 'bk-2', referenceNo: 'HZ-2026-01004', payoutHeld: true })]);

    const held = el.querySelectorAll('.cell__sub--alert');
    expect(held.length).toBe(1);
    expect(held[0].textContent).toContain('مجمَّد');
  });

  /**
   * A bucket belongs to a payout run, which covers several bookings and does
   * not exist until an operator approves one — so no booking row can carry
   * one, and the screen points at where that answer lives instead.
   */
  it('claims no transfer state, and says where it is', () => {
    flush([booking()]);
    expect(el.querySelector('.note a')?.getAttribute('href')).toBe('/admin/transfers');
  });

  it('sends only the parameters this endpoint accepts', () => {
    const request = flush([booking()]);
    for (const key of request.request.params.keys()) {
      expect(['status', 'search', 'from', 'to', 'page', 'pageSize']).toContain(key);
    }
  });
});
