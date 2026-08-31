import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { Permission } from '@core/constants/permissions';
import { AccountStatus, AdminRole, UserRole } from '@core/enums/user-role.enum';
import { AuthService } from '@core/services/auth.service';
import { PermissionService } from '@core/services/permission.service';
import { environment } from '../../../../../environments/environment';
import { AdminUsersPage } from './users-page';

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

describe('AdminUsersPage — creating an administrator (FR-ADM-04)', () => {
  let fixture: ComponentFixture<AdminUsersPage>;
  let http: HttpTestingController;
  let el: HTMLElement;

  let held: readonly Permission[] = [Permission.ManageAdmins];

  const listUrl = `${environment.apiUrl}${API_ENDPOINTS.admin.users}`;
  const createUrl = `${environment.apiUrl}${API_ENDPOINTS.admin.createAdmin}`;

  function flushList() {
    http.expectOne((r) => r.url === listUrl).flush(EMPTY_PAGE);
    fixture.detectChanges();
  }

  /**
   * The create dialog's submit.
   *
   * Scoped to the last `app-ui-modal` on purpose: the page renders the reject
   * dialog too, and a document-wide `.modal__actions button` picked its
   * confirm button instead — which clicked cleanly and sent nothing.
   */
  function submitCreate() {
    const modals = el.querySelectorAll('app-ui-modal');
    const actions = modals[modals.length - 1].querySelectorAll('.modal__actions button');
    (actions[actions.length - 1] as HTMLButtonElement).click();
  }

  function type(selector: string, value: string) {
    const field = el.querySelector(selector) as HTMLInputElement | HTMLSelectElement;
    field.value = value;
    field.dispatchEvent(new Event(field.tagName === 'SELECT' ? 'change' : 'input'));
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

  it('offers no way in for an operator without `admins:manage`', async () => {
    TestBed.resetTestingModule();
    held = [];
    await create();

    flushList();
    // The dialog's markup is in the DOM whether or not it is open, so the
    // absence being checked is the way in — the button that opens it.
    expect(el.querySelector('.pageActions')).toBeNull();
  });

  /**
   * The absence of the password field is the design, not an omission. The
   * server strips a `password` sent anyway rather than refusing it, so a form
   * that offered the box would appear to work and would be handing somebody a
   * password that opened nothing.
   */
  it('has no password field, and sends only the four the endpoint takes', () => {
    flushList();
    (el.querySelector('.pageActions button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelector('input[type="password"]')).toBeNull();

    type('.createForm input[type="text"]', 'نوف السالم');
    type('.createForm input[type="tel"]', '0542208891');
    type('.createForm input[type="email"]', 'nouf@hayzak.com');
    type('.createForm select', AdminRole.Operations);

    submitCreate();

    const request = http.expectOne((r) => r.url === createUrl);
    expect(request.request.body).toEqual({
      fullName: 'نوف السالم',
      mobile: '0542208891',
      adminRole: AdminRole.Operations,
      email: 'nouf@hayzak.com',
    });
    request.flush({
      success: true,
      data: {
        user: {
          id: 'adm-9',
          fullName: 'نوف السالم',
          role: UserRole.Admin,
          adminRole: AdminRole.Operations,
          mobile: '+966542208891',
          email: 'nouf@hayzak.com',
          status: AccountStatus.Active,
          identity: null,
          suspendedReason: null,
          createdAt: '2026-08-31T09:00:00.000Z',
        },
        activation: {
          method: 'PASSWORD_RESET',
          mobile: '+966542208891',
          instructionAr: 'الحساب اتعمل من غير كلمة مرور.',
          instructionEn: 'The account has no password.',
        },
      },
    });
    fixture.detectChanges();
    flushList();

    // The dialog stays open on the server's instruction: the operator has to
    // relay it to another person before it is any use, and a toast would be
    // gone before they had.
    expect(el.querySelector('.activation')).not.toBeNull();
    expect(el.textContent).toContain('الحساب اتعمل من غير كلمة مرور.');
    expect(el.textContent).toContain('+966542208891');
    expect(el.querySelector('.createForm')).toBeNull();
  });

  /** The email is the only optional one; it is omitted rather than sent empty. */
  it('leaves the email out entirely when it was not filled in', () => {
    flushList();
    (el.querySelector('.pageActions button') as HTMLButtonElement).click();
    fixture.detectChanges();

    type('.createForm input[type="text"]', 'ريم الغامدي');
    type('.createForm input[type="tel"]', '0556403312');
    type('.createForm select', AdminRole.Finance);

    submitCreate();

    const request = http.expectOne((r) => r.url === createUrl);
    expect(Object.keys(request.request.body as object).sort()).toEqual([
      'adminRole',
      'fullName',
      'mobile',
    ]);
    request.flush({
      success: true,
      data: {
        user: {
          id: 'adm-8',
          fullName: 'ريم الغامدي',
          role: UserRole.Admin,
          adminRole: AdminRole.Finance,
          mobile: '+966556403312',
          email: '',
          status: AccountStatus.Active,
          identity: null,
          suspendedReason: null,
          createdAt: '2026-08-31T09:00:00.000Z',
        },
        activation: null,
      },
    });
    fixture.detectChanges();
    flushList();
  });
});
