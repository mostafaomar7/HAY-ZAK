import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import type { WireTaxInvoice } from '@core/models/tax-invoice';
import { environment } from '../../../../../environments/environment';
import { AdminInvoicesPage } from './invoices-page';

function invoice(overrides: Partial<WireTaxInvoice> = {}): WireTaxInvoice {
  return {
    id: 'inv-1',
    invoiceNo: 'INV-2026-000003',
    type: 'BOOKING',
    issuedAt: '2026-08-26T09:42:57.622Z',
    taxableHalalas: 40000,
    vatHalalas: 0,
    totalHalalas: 40000,
    vatRateBps: 0,
    qrCode: null,
    booking: {
      id: 'bk-1',
      referenceNo: 'HZ-2026-08-0206',
      startDate: '2026-12-24',
      endDate: '2026-12-28',
      daysCount: 4,
      unit: { id: 'u-1', title: 'مستودع مكيّف في حي العليا' },
    },
    ...overrides,
  };
}

describe('AdminInvoicesPage (FR-PAY-09)', () => {
  let fixture: ComponentFixture<AdminInvoicesPage>;
  let http: HttpTestingController;
  let el: HTMLElement;

  const url = `${environment.apiUrl}${API_ENDPOINTS.admin.invoices}`;

  function flush(items: WireTaxInvoice[]) {
    const request = http.expectOne((r) => r.url === url);
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
    fixture.detectChanges();
    return request;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminInvoicesPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminInvoicesPage);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => http.verify());

  it('sends no filter at all on the first load', () => {
    const request = flush([invoice()]);
    expect(request.request.params.keys().sort()).toEqual(['page']);
  });

  /**
   * The endpoint takes `from`, `to`, `type` and the page; a fifth parameter is
   * a 422 that names the four. `period` is this screen's own control and must
   * never reach the wire under that name.
   */
  it('turns the period control into a `from` date and never sends `period`', () => {
    flush([invoice()]);

    const bar = el.querySelector('app-admin-filter-bar')!;
    const select = bar.querySelectorAll('select')[1] as HTMLSelectElement;
    select.value = 'last30';
    select.dispatchEvent(new Event('change'));
    (bar.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const request = http.expectOne((r) => r.url === url);
    expect(request.request.params.has('period')).toBeFalse();
    expect(request.request.params.get('from')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
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
   * There is no `search` parameter on this endpoint, so there is no search box:
   * one that filtered the twenty rows in hand would look like a search of the
   * register and answer for a page.
   */
  it('offers no search box, because the register cannot be searched', () => {
    flush([invoice()]);
    expect(el.querySelector('input[type="search"]')).toBeNull();
  });

  it('names the kind of each invoice rather than listing two totals unexplained', () => {
    flush([invoice(), invoice({ id: 'inv-2', type: 'COMMISSION', vatRateBps: 1500 })]);
    expect(el.textContent).toContain('فاتورة حجز');
    expect(el.textContent).toContain('فاتورة عمولة');
  });
});
