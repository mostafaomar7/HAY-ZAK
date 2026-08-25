import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import type { EarningsResponse, EarningsRow } from '@core/models/earnings.model';
import type { LessorEarnings } from '@core/models/payment.model';
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
    bucket: 'PAID',
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
  const bucketsUrl = `${environment.apiUrl}${API_ENDPOINTS.lessor.earnings}`;

  /**
   * The screen makes two requests, and they answer different questions: the
   * table is a period the lessor chose, the buckets are the account's position
   * now. Both are answered here so no test has to know which one it wanted.
   */
  function flush(rows: EarningsRow[], totalEarnings = 2707.5) {
    const body: EarningsResponse = {
      summary: { totalEarnings, transferred: 0, pending: 0, onHold: 0 },
      rows,
    };
    http.expectOne((r) => r.url === url).flush({ data: body, success: true });
    flushBuckets();
    fixture.detectChanges();
  }

  function flushBuckets(overrides: Partial<LessorEarnings> = {}) {
    const earnings: LessorEarnings = {
      pendingHalalas: 0,
      pendingBookings: 0,
      releasableHalalas: 0,
      releasableBookings: 0,
      paidHalalas: 0,
      paidPayouts: 0,
      lastPayout: null,
      releaseRule: 'after_booking_start_24h',
      ...overrides,
    };
    http.expectOne((r) => r.url === bucketsUrl).flush({ data: { earnings }, success: true });
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

  /**
   * The three buckets are the hero, not one total. "How much have I earned"
   * and "how much can reach my bank this week" are different questions, and
   * only the second is actionable.
   */
  it('renders the three buckets and one row per booking', () => {
    flush([row(), row({ bookingId: 'bk-2', bucket: 'RELEASABLE' })]);

    const tiles = Array.from(el.querySelectorAll('app-ui-stat-tile')).map((t) => t.textContent);
    expect(tiles.length).toBe(3);
    expect(tiles[0]).toContain('جاهز للتحويل');
    expect(tiles[1]).toContain('قيد الانتظار');
    expect(tiles[2]).toContain('حُوِّل');

    expect(el.querySelectorAll('.table__row').length).toBe(2);
  });

  /**
   * The backend asked for this on the screen and was right to: "why is my
   * money still pending" is the question that becomes a support ticket when
   * the page does not answer it.
   */
  it('says in words why money is not releasable yet', () => {
    flush([row()]);
    expect(el.textContent).toContain('بعد ٢٤ ساعة من بداية الحجز');
  });

  /** A rule this build has not heard of gets no sentence, not a guessed one. */
  it('explains nothing rather than guessing at an unknown release rule', () => {
    http
      .expectOne((r) => r.url === url)
      .flush({
        data: { summary: { totalEarnings: 0, transferred: 0, pending: 0, onHold: 0 }, rows: [] },
        success: true,
      });
    flushBuckets({ releaseRule: 'after_some_rule_this_build_does_not_know' });
    fixture.detectChanges();

    expect(el.querySelector('.page__rule')).toBeNull();
  });

  it('offers a way to the requests screen when there is nothing to show', () => {
    flush([]);

    expect(el.textContent).toContain('لا توجد مستحقات مسجّلة حتى الآن');
    expect(el.querySelector('a[href="/lessor/requests"]')?.textContent).toContain('عرض الطلبات');
  });

  // UC-04 — a frozen payout is only actionable if it points at the screen that
  // actually fixes it, which is the bank details, not the profile.
  it('sends a frozen payout to the bank-details screen', () => {
    flush([row({ bucket: 'PENDING', holdReason: 'الآيبان لا يطابق اسمك.' })]);

    const hold = el.querySelector('.hold');
    expect(hold).not.toBeNull();
    expect(hold?.textContent).toContain('الآيبان لا يطابق اسمك.');

    const action = hold?.querySelector('a');
    expect(action?.textContent).toContain('تصحيح البيانات البنكية');
    expect(action?.getAttribute('href')).toBe('/lessor/bank-account');
  });

  it('explains when a transfer is still in progress', () => {
    flush([row({ bucket: 'RELEASABLE', bankReference: undefined })]);

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

    // The buckets are refetched too — they are the account's position, and a
    // stale one beside a fresh table is the disagreement this avoids.
    flushBuckets();
  });
});
