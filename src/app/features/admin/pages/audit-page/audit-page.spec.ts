import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { environment } from '../../../../../environments/environment';
import { AdminAuditPage } from './audit-page';

const EMPTY_PAGE = {
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
};

describe('AdminAuditPage (FR-ADM-09)', () => {
  let fixture: ComponentFixture<AdminAuditPage>;
  let http: HttpTestingController;
  let el: HTMLElement;

  const auditUrl = `${environment.apiUrl}${API_ENDPOINTS.admin.auditLog}`;
  const actionsUrl = `${environment.apiUrl}${API_ENDPOINTS.admin.auditActions}`;

  function settle() {
    http.expectOne((r) => r.url === actionsUrl).flush({ success: true, data: { items: [] } });
    http.expectOne((r) => r.url === auditUrl).flush(EMPTY_PAGE);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminAuditPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminAuditPage);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => http.verify());

  /**
   * The regression this was written for: the box collected a value the fetch
   * never read, so typing in it and pressing "تطبيق الفلاتر" did nothing at
   * all. `/admin/audit` has no `search` — it takes `entityId` — and sending one
   * would have been a 422 naming the parameters it will accept.
   */
  it('sends what was typed as `entityId`, and never as `search`', () => {
    settle();

    const bar = el.querySelector('app-admin-filter-bar')!;
    const box = bar.querySelector('input[type="search"]') as HTMLInputElement;
    box.value = 'unit-1234';
    box.dispatchEvent(new Event('input'));
    (bar.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const request = http.expectOne((r) => r.url === auditUrl);
    expect(request.request.params.get('entityId')).toBe('unit-1234');
    expect(request.request.params.has('search')).toBeFalse();
    request.flush(EMPTY_PAGE);
  });

  /** No export: the trail deliberately has none, so the button is not drawn. */
  it('offers no export button', () => {
    settle();
    expect(el.textContent).not.toContain('تصدير');
  });
});
