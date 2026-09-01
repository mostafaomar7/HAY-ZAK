import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { BookingStatus } from '@core/enums/booking-status.enum';
import type { LessorEarnings } from '@core/models/payment.model';
import { environment } from '../../../../../environments/environment';
import { EarningsPage } from './earnings-page';

/** A booking as `/lessor/bookings` sends one — the lessor's view, with the
 * commission on it. The renter's response carries no `commission` at all. */
function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bk-1',
    referenceNo: 'HZ-2026-01042',
    status: BookingStatus.Completed,
    unit: { id: 'u-1', title: 'مستودع مكيّف — النرجس', addressLine: null, coverUrl: null },
    startDate: '2026-08-05',
    endDate: '2026-08-12',
    daysCount: 7,
    price: {
      dailyPriceHalalas: 7500,
      subtotalHalalas: 52500,
      vatHalalas: 0,
      totalHalalas: 52500,
      commissionRateBps: 500,
      commissionHalalas: 2625,
      netToLessorHalalas: 49875,
    },
    goodsDescription: 'أثاث منزلي',
    contact: null,
    confirmedAt: '2026-08-04T09:04:00.000Z',
    createdAt: '2026-08-04T09:00:00.000Z',
    ...overrides,
  };
}

describe('EarningsPage (LSR-07)', () => {
  let fixture: ComponentFixture<EarningsPage>;
  let http: HttpTestingController;
  let el: HTMLElement;

  const bookingsUrl = `${environment.apiUrl}${API_ENDPOINTS.bookings.forLessor}`;
  const bucketsUrl = `${environment.apiUrl}${API_ENDPOINTS.lessor.earnings}`;

  /**
   * The screen makes two requests, and they answer different questions: the
   * table is a page of bookings, the buckets are the account's position now.
   * Both are answered here so no test has to know which one it wanted.
   */
  function flush(rows: Record<string, unknown>[] = [booking()]) {
    const request = http.expectOne((r) => r.url === bookingsUrl);
    request.flush({
      success: true,
      data: {
        items: rows,
        pagination: {
          page: 1,
          pageSize: 20,
          total: rows.length,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      },
    });
    flushBuckets();
    fixture.detectChanges();
    return request;
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
    flush();
  });

  /**
   * The regression this was written for: the table read
   * `/lessor/earnings/rows`, which has never existed, so the screen showed the
   * three buckets above a red "تعذّر تحميل المستحقات" — the money on screen and
   * none of the bookings behind it.
   */
  it('reads the bookings endpoint, never `/lessor/earnings/rows`', () => {
    const request = flush([booking(), booking({ id: 'bk-2', referenceNo: 'HZ-2026-01043' })]);

    expect(request.request.url).toBe(bookingsUrl);
    expect(el.querySelectorAll('.table__row').length).toBe(2);
    expect(el.textContent).toContain('HZ-2026-01042');
  });

  /**
   * The three buckets are the hero, not one total. "How much have I earned"
   * and "how much can reach my bank this week" are different questions, and
   * only the second is actionable.
   */
  it('renders the three buckets beside the table', () => {
    flush();

    const tiles = Array.from(el.querySelectorAll('app-ui-stat-tile')).map((t) => t.textContent);
    expect(tiles.length).toBe(3);
    expect(tiles[0]).toContain('جاهز للتحويل');
    expect(tiles[1]).toContain('قيد الانتظار');
    expect(tiles[2]).toContain('حُوِّل');
  });

  /**
   * The backend asked for this on the screen and was right to: "why is my
   * money still pending" is the question that becomes a support ticket when
   * the page does not answer it.
   */
  it('says in words why money is not releasable yet', () => {
    flush();
    expect(el.textContent).toContain('بعد ٢٤ ساعة من بداية الحجز');
  });

  /** The lessor's half of the money, which only their own view carries. */
  it('shows the commission and the net from the booking', () => {
    flush();

    const row = el.querySelector('.table__row')!.textContent ?? '';
    expect(row).toContain('525'); // gross, 52,500 halalas
    expect(row).toContain('498'); // net, 49,875 halalas
  });

  /**
   * `/lessor/bookings` takes `status`, `page` and `pageSize` and nothing else.
   * The period and unit filters that used to sit here narrowed the rows already
   * loaded — a page of twenty out of two hundred, presented as the whole set.
   */
  it('offers only the filter the endpoint actually takes', () => {
    flush();

    const selects = el.querySelectorAll('.page__toolbar select');
    expect(selects.length).toBe(1);

    const select = selects[0] as HTMLSelectElement;
    select.value = BookingStatus.Completed;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const request = http.expectOne((r) => r.url === bookingsUrl);
    expect(request.request.params.get('status')).toBe(BookingStatus.Completed);
    request.flush({
      success: true,
      data: {
        items: [],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      },
    });
    flushBuckets();
    fixture.detectChanges();
  });

  /** A statement of account with no endpoint behind it is a button that lies. */
  it('offers no statement export', () => {
    flush();
    expect(el.textContent).not.toContain('تصدير');
  });

  /**
   * The buckets answer the account's position and the table answers a page.
   * One failing must not blank the other.
   */
  it('keeps the table when the buckets fail', () => {
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
    http.expectOne((r) => r.url === bucketsUrl).error(new ProgressEvent('failed'));
    fixture.detectChanges();

    expect(el.querySelectorAll('app-ui-stat-tile').length).toBe(0);
    expect(el.querySelectorAll('.table__row').length).toBe(1);
  });
});
