import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { PayoutStatus } from '@core/enums/payment.enum';
import type { EarningsResponse, EarningsRow } from '@core/models/earnings.model';
import { environment } from '../../../../../environments/environment';
import { EarningsPage } from './earnings-page';

function row(overrides: Partial<EarningsRow> = {}): EarningsRow {
  return {
    bookingId: 'bk-1',
    bookingReferenceNo: 'HZ-2026-01042',
    unitTitle: 'مستودع مكيّف — النرجس',
    startDate: '2026-08-05',
    endDate: '2026-08-12',
    grossHalalas: 52500,
    commissionHalalas: 2625,
    netHalalas: 49875,
    payoutStatus: PayoutStatus.Paid,
    bankReference: 'TRF-88214',
    transferredAt: '2026-08-13',
    ...overrides,
  };
}

describe('EarningsPage (LSR-07)', () => {
  let fixture: ComponentFixture<EarningsPage>;
  let http: HttpTestingController;
  let el: HTMLElement;

  const url = `${environment.apiUrl}${API_ENDPOINTS.lessor.earningsTable}`;

  function flush(rows: EarningsRow[], totalEarnings = 2707.5) {
    const body: EarningsResponse = {
      summary: { totalEarnings, transferred: 0, pending: 0, onHold: 0 },
      rows,
    };
    http.expectOne((r) => r.url === url).flush({ data: body, success: true });
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EarningsPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(EarningsPage);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => http.verify());

  it('shows a skeleton, not a bare line of text, while loading', () => {
    expect(el.querySelector('app-ui-skeleton')).not.toBeNull();
    flush([]);
  });

  it('renders the hero total and one row per payout', () => {
    flush([row(), row({ bookingId: 'bk-2', payoutStatus: PayoutStatus.Processing })]);

    expect(el.querySelector('app-ui-stat-tile')?.textContent).toContain('إجمالي الأرباح');
    expect(el.textContent).toContain('2,707.50');
    expect(el.querySelectorAll('.table__row').length).toBe(2);
  });

  it('offers a way to the requests screen when there is nothing to show', () => {
    flush([]);

    expect(el.textContent).toContain('لا توجد مستحقات مسجّلة حتى الآن');
    expect(el.querySelector('a[href="/lessor/requests"]')?.textContent).toContain('عرض الطلبات');
  });

  // UC-04 — a frozen payout is only actionable if it points at the screen that
  // actually fixes it, which is the bank details, not the profile.
  it('sends a frozen payout to the bank-details screen', () => {
    flush([row({ payoutStatus: PayoutStatus.OnHold, holdReason: 'الآيبان لا يطابق اسمك.' })]);

    const hold = el.querySelector('.hold');
    expect(hold).not.toBeNull();
    expect(hold?.textContent).toContain('الآيبان لا يطابق اسمك.');

    const action = hold?.querySelector('a');
    expect(action?.textContent).toContain('تصحيح البيانات البنكية');
    expect(action?.getAttribute('href')).toBe('/lessor/bank-account');
  });

  it('explains when a transfer is still in progress', () => {
    flush([row({ payoutStatus: PayoutStatus.Processing, bankReference: undefined })]);

    expect(el.querySelector('.note')?.textContent).toContain('خلال يومي عمل');
  });

  it('adds no note or hold panel to a completed transfer', () => {
    flush([row()]);

    expect(el.querySelector('.note')).toBeNull();
    expect(el.querySelector('.hold')).toBeNull();
    expect(el.textContent).toContain('TRF-88214');
  });

  it('filters by unit without issuing another request', () => {
    flush([row(), row({ bookingId: 'bk-2', unitTitle: 'قراج مغلق — الملقا' })]);

    fixture.componentInstance['onUnit']('قراج مغلق — الملقا');
    fixture.detectChanges();

    expect(el.querySelectorAll('.table__row').length).toBe(1);
    http.expectNone((r) => r.url === url);
  });

  it('refetches when the period changes', () => {
    flush([row()]);

    fixture.componentInstance['onPeriod']('month');
    fixture.detectChanges();

    const request = http.expectOne((r) => r.url === url);
    expect(request.request.params.has('fromDate')).toBeTrue();
    expect(request.request.params.has('toDate')).toBeTrue();
    request.flush({
      data: { summary: { totalEarnings: 0, transferred: 0, pending: 0, onHold: 0 }, rows: [] },
      success: true,
    });
  });
});
