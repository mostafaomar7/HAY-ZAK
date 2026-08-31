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

  /** Types into the box, picks the question, and applies. */
  function search(term: string, subject?: 'entity' | 'actor') {
    const bar = el.querySelector('app-admin-filter-bar')!;
    const box = bar.querySelector('input[type="search"]') as HTMLInputElement;
    box.value = term;
    box.dispatchEvent(new Event('input'));

    if (subject) {
      const select = Array.from(bar.querySelectorAll('select')).find((s) =>
        s.id.endsWith('subject'),
      )!;
      select.value = subject;
      select.dispatchEvent(new Event('change'));
    }

    (bar.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  /**
   * The regression this was written for: the box collected a value the fetch
   * never read, so typing in it and pressing "تطبيق الفلاتر" did nothing at
   * all. `/admin/audit` has no `search` — it takes `entityId` — and sending one
   * would have been a 422 naming the parameters it will accept.
   */
  it('sends an id straight through as `entityId`, and never as `search`', () => {
    settle();
    search('01a033ae-e2dd-74b2-be03-591200ffd630');

    const request = http.expectOne((r) => r.url === auditUrl);
    expect(request.request.params.get('entityId')).toBe('01a033ae-e2dd-74b2-be03-591200ffd630');
    expect(request.request.params.has('search')).toBeFalse();
    request.flush(EMPTY_PAGE);
  });

  /**
   * The two-step the backend asked for, because `/admin/audit` will never take
   * free text: both value columns are JSON, so searching inside them is a scan
   * of a table that only grows — and it would make the trail a search index
   * over personal data, which is the opposite of why it stores only what
   * changed. `/admin/users` is indexed for exactly this lookup.
   */
  it('resolves a mobile number through the users list, then filters by that id', () => {
    settle();
    search('0512345678');

    const lookup = http.expectOne(
      (r) => r.url === `${environment.apiUrl}${API_ENDPOINTS.admin.users}`,
    );
    expect(lookup.request.params.get('search')).toBe('0512345678');
    lookup.flush({
      success: true,
      data: {
        items: [{ id: 'usr-7', fullName: 'سعد', role: 'RENTER', mobile: '+966512345678' }],
        pagination: EMPTY_PAGE.data.pagination,
      },
    });
    fixture.detectChanges();

    const request = http.expectOne((r) => r.url === auditUrl);
    expect(request.request.params.get('entityId')).toBe('usr-7');
    request.flush(EMPTY_PAGE);
    fixture.detectChanges();

    // The lookup is shown, not hidden: the operator typed a number and should
    // see which person it landed on.
    expect(el.textContent).toContain('سعد');
  });

  /**
   * "What happened to them" and "what they did" are different columns on the
   * trail. A box that chose for the operator would answer one and look like it
   * had answered the other.
   */
  it('sends the same id as `actorUserId` when the question is what they did', () => {
    settle();
    search('سعد', 'actor');

    http
      .expectOne((r) => r.url === `${environment.apiUrl}${API_ENDPOINTS.admin.users}`)
      .flush({
        success: true,
        data: {
          items: [{ id: 'usr-7', fullName: 'سعد', role: 'ADMIN', mobile: '+966512345678' }],
          pagination: EMPTY_PAGE.data.pagination,
        },
      });
    fixture.detectChanges();

    const request = http.expectOne((r) => r.url === auditUrl);
    expect(request.request.params.get('actorUserId')).toBe('usr-7');
    expect(request.request.params.has('entityId')).toBeFalse();
    request.flush(EMPTY_PAGE);
  });

  /**
   * No id means no filter. Reading the trail unfiltered here would answer a
   * different question with a full page of rows, which reads as a result.
   */
  it('shows nothing, and says why, when the lookup matches nobody', () => {
    settle();
    search('لا أحد');

    http
      .expectOne((r) => r.url === `${environment.apiUrl}${API_ENDPOINTS.admin.users}`)
      .flush({ success: true, data: { items: [], pagination: EMPTY_PAGE.data.pagination } });
    fixture.detectChanges();

    http.expectNone((r) => r.url === auditUrl);
    expect(el.textContent).toContain('لا يوجد مستخدم مطابق');
  });

  /** No export: the trail deliberately has none, so the button is not drawn. */
  it('offers no export button', () => {
    settle();
    expect(el.textContent).not.toContain('تصدير');
  });
});
