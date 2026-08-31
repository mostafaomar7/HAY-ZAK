import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { Permission } from '@core/constants/permissions';
import type { WireTaxInvoice } from '@core/models/tax-invoice';
import { PermissionService } from '@core/services/permission.service';
import { environment } from '../../../../../environments/environment';
import { InvoicesPage } from './invoices-page';

/**
 * Stubbed rather than signed in, because the branch under test is exactly the
 * one permission: a renter reaches the printable document, a lessor reading
 * their commission invoices does not, and both must be exercised here.
 */
let held: readonly Permission[] = [Permission.CreateBooking];

function invoice(overrides: Partial<WireTaxInvoice> = {}): WireTaxInvoice {
  return {
    id: 'inv-1',
    invoiceNo: 'INV-2026-000041',
    type: 'BOOKING',
    issuedAt: '2026-08-12T09:20:00.000Z',
    taxableHalalas: 30000,
    vatHalalas: 0,
    totalHalalas: 30000,
    vatRateBps: 0,
    qrCode: null,
    booking: {
      id: 'bk-1',
      referenceNo: 'HZ-2026-08-0307',
      startDate: '2026-08-12',
      endDate: '2026-09-11',
      daysCount: 30,
      unit: { id: 'u-1', title: 'مستودع مكيّف في حي العليا' },
    },
    ...overrides,
  };
}

const COMMISSION = invoice({
  id: 'inv-2',
  invoiceNo: 'INV-2026-000042',
  type: 'COMMISSION',
  taxableHalalas: 3913,
  vatHalalas: 587,
  totalHalalas: 4500,
  vatRateBps: 1500,
});

describe('InvoicesPage (FR-PAY-09)', () => {
  let fixture: ComponentFixture<InvoicesPage>;
  let http: HttpTestingController;
  let el: HTMLElement;

  const url = `${environment.apiUrl}${API_ENDPOINTS.me.invoices}`;

  function flush(items: WireTaxInvoice[]) {
    http
      .expectOne((r) => r.url === url)
      .flush({
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
    fixture.detectChanges();
  }

  async function create() {
    await TestBed.configureTestingModule({
      imports: [InvoicesPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: PermissionService,
          useValue: { can: (permission: Permission) => held.includes(permission) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InvoicesPage);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    held = [Permission.CreateBooking];
    await create();
  });

  afterEach(() => http.verify());

  it('asks for the page and nothing else — a fifth parameter is a 422', () => {
    const request = http.expectOne((r) => r.url === url);
    expect(request.request.params.keys()).toEqual(['page']);
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
  });

  /**
   * The whole reason this screen exists as one list rather than two: the same
   * booking reference carries a booking invoice and a commission invoice with
   * different totals, and only `type` explains the difference.
   */
  it('names the kind of every invoice, so one reference with two totals reads', () => {
    flush([invoice(), COMMISSION]);

    const rows = Array.from(el.querySelectorAll('.row'));
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('فاتورة حجز');
    expect(rows[1].textContent).toContain('فاتورة عمولة');
    // Same booking on both, which is exactly why the label is not optional.
    expect(rows[0].textContent).toContain('HZ-2026-08-0307');
    expect(rows[1].textContent).toContain('HZ-2026-08-0307');
  });

  /**
   * `/my-bookings/:id/invoice` is the renter's printable document and there is
   * no page for a commission invoice. Offering the link on one would send the
   * lessor to a screen written about somebody else's payment.
   */
  it('links only the booking invoice to the printable document', () => {
    flush([invoice(), COMMISSION]);

    const links = Array.from(el.querySelectorAll('a[href]')).map((a) => a.getAttribute('href'));
    expect(links).toContain('/my-bookings/bk-1/invoice');
    expect(links.length).toBe(1);
  });

  /**
   * A lessor holds no `CreateBooking`, so that route would answer with the
   * forbidden page. The link is absent rather than drawn and refused.
   */
  it('draws no document link for an account that cannot reach that route', async () => {
    TestBed.resetTestingModule();
    held = [];
    await create();

    flush([invoice()]);
    expect(el.querySelector('a[href*="/my-bookings"]')).toBeNull();
  });

  /** The rate the document was issued under, not today's setting. */
  it('states the VAT that was actually charged, and says so when none was', () => {
    flush([invoice(), COMMISSION]);

    const rows = Array.from(el.querySelectorAll('.row'));
    expect(rows[0].textContent).toContain('بدون ضريبة قيمة مضافة');
    expect(rows[1].textContent).toContain('منها ضريبة قيمة مضافة');
  });

  it('offers a way back to the catalogue rather than an empty page', () => {
    flush([]);
    expect(el.querySelector('app-ui-empty-state')).not.toBeNull();
    expect(el.textContent).toContain('لا توجد فواتير بعد');
  });
});
