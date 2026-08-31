import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { Permission } from '@core/constants/permissions';
import { AccountStatus, AdminRole, UserRole } from '@core/enums/user-role.enum';
import type { WireAdminUser, WireAdminUserDetail } from '@core/models/admin-user';
import { AuthService } from '@core/services/auth.service';
import { PermissionService } from '@core/services/permission.service';
import { environment } from '../../../../../environments/environment';
import { AdminUsersPage } from './users-page';

const OPERATIONS: WireAdminUser = {
  id: 'adm-1',
  fullName: 'نوف السالم',
  role: UserRole.Admin,
  adminRole: AdminRole.Operations,
  mobile: '+966542208891',
  email: 'nouf@hayzak.com',
  status: AccountStatus.Active,
  identity: null,
  suspendedReason: null,
  createdAt: '2026-01-04T08:00:00.000Z',
};

/** The counts `GET /admin/users/:id` carries and `PUT .../admin-role` does not. */
const DETAIL: WireAdminUserDetail = {
  ...OPERATIONS,
  activity: {
    unitsCount: 3,
    bookingsAsRenter: 1,
    bookingsAsLessor: 7,
    liveBookings: 2,
    openComplaints: 1,
  },
};

describe('AdminUsersPage — administrator kind (FR-ADM-04)', () => {
  let fixture: ComponentFixture<AdminUsersPage>;
  let http: HttpTestingController;
  let el: HTMLElement;

  let held: readonly Permission[] = [Permission.ManageAdmins];

  const listUrl = `${environment.apiUrl}${API_ENDPOINTS.admin.users}`;
  const detailUrl = `${environment.apiUrl}${API_ENDPOINTS.admin.userById('adm-1')}`;
  const roleUrl = `${environment.apiUrl}${API_ENDPOINTS.admin.changeAdminRole('adm-1')}`;

  function flushList() {
    http
      .expectOne((r) => r.url === listUrl)
      .flush({
        success: true,
        data: {
          items: [OPERATIONS],
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
    fixture.detectChanges();
  }

  /** Opens the side panel on the seeded administrator. */
  function openPanel() {
    (el.querySelector('.tbl__row') as HTMLElement).click();
    http.expectOne((r) => r.url === detailUrl).flush({ success: true, data: { user: DETAIL } });
    fixture.detectChanges();
  }

  async function create() {
    await TestBed.configureTestingModule({
      imports: [AdminUsersPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: PermissionService,
          useValue: { can: (permission: Permission) => held.includes(permission) },
        },
        // Somebody other than the row, so "cannot act on yourself" is not what
        // is being measured here.
        { provide: AuthService, useValue: { user: signal({ id: 'me' }) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminUsersPage);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    held = [Permission.ManageAdmins];
    await create();
  });

  afterEach(() => http.verify());

  /**
   * Setting the kind the account already holds is a 409
   * `ADMIN_USER_ALREADY_IN_STATE`, so a control whose only outcome is a refusal
   * is not drawn at all.
   */
  it('leaves the kind the account already holds out of the picker', () => {
    flushList();
    openPanel();

    const options = Array.from(el.querySelectorAll('.panel__body select option')).map(
      (o) => (o as HTMLOptionElement).value,
    );
    expect(options).toContain(AdminRole.Finance);
    expect(options).toContain(AdminRole.SystemAdmin);
    expect(options).not.toContain(AdminRole.Operations);
  });

  /**
   * The endpoint needs `admins:manage`. An operations supervisor reading the
   * same row is refused by the server, so the control is absent rather than
   * offered and rejected.
   */
  it('offers nothing to an operator without `admins:manage`', async () => {
    TestBed.resetTestingModule();
    held = [];
    await create();

    flushList();
    openPanel();
    expect(el.textContent).not.toContain('تغيير نوع الإداري');
  });

  /**
   * The regression this was written for: `PUT .../admin-role` answers without
   * the `activity` block, and taking that response as the whole detail turned
   * five real counts into five zeros beside a decision that depends on them.
   */
  it('keeps the activity counts, which the role response does not carry', () => {
    flushList();
    openPanel();
    expect(el.textContent).toContain('7');

    const select = el.querySelector('.panel__body select') as HTMLSelectElement;
    select.value = AdminRole.Finance;
    select.dispatchEvent(new Event('change'));

    const reason = el.querySelector('.panel__body textarea') as HTMLTextAreaElement;
    reason.value = 'انتقلت إلى الفريق المالي';
    reason.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (el.querySelector('.panel__foot button') as HTMLButtonElement).click();

    const request = http.expectOne((r) => r.url === roleUrl);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      adminRole: AdminRole.Finance,
      reason: 'انتقلت إلى الفريق المالي',
    });

    // No `activity` — exactly what the server sends.
    request.flush({
      success: true,
      data: { user: { ...OPERATIONS, adminRole: AdminRole.Finance } },
    });
    flushList();

    const counts = el.querySelector('.facts--counts')!.textContent ?? '';
    expect(counts).toContain('7');
    expect(counts).toContain('3');
  });
});
