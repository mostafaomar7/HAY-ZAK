import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideLocationMocks } from '@angular/common/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { By } from '@angular/platform-browser';
import { UserRole } from '@core/enums/user-role.enum';
import { MOCK_ADMIN_USER } from '@core/mock/admin.fixtures';
import { mockApiInterceptor } from '@core/mock/mock-api.interceptor';
import { AuthService } from '@core/services/auth.service';
import { routes } from './app.routes';
import { App } from './app';

/**
 * End-to-end smoke test of the operations console through the real router, the
 * real shell, the real guards and the real mock interceptor.
 *
 * The permission cases are the point. Fourteen screens each declare a permission
 * and each has a matching sidebar entry, and the only way to know the two agree
 * is to sign in as each role and look.
 */
describe('admin console routing (smoke)', () => {
  let router: Router;

  async function configure(role: UserRole | null): Promise<void> {
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        provideLocationMocks(),
        provideHttpClient(withInterceptors([mockApiInterceptor])),
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    localStorage.clear();
    sessionStorage.clear();

    if (role) {
      TestBed.inject(AuthService).setSession({
        tokens: {
          accessToken: 'test-token',
          refreshToken: 'test-refresh',
          expiresIn: 1800,
          tokenType: 'Bearer',
        },
        user: { ...MOCK_ADMIN_USER, role },
      });
    }
  }

  async function open(url: string): Promise<ComponentFixture<App>> {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    await router.navigateByUrl(url);
    fixture.detectChanges();

    // Outlast the mock's delay(500), then let the response render.
    await new Promise((resolve) => setTimeout(resolve, 900));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    return fixture;
  }

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('as a system administrator', () => {
    beforeEach(async () => {
      await configure(UserRole.SystemAdministrator);
    });

    it('lands on the indicators from /admin', async () => {
      const fixture = await open('/admin');

      expect(router.url).toBe('/admin/dashboard');
      expect(fixture.nativeElement.textContent as string).toContain('إعلانات بانتظار المراجعة');
    });

    it('opens every console screen', async () => {
      const screens = [
        '/admin/listings',
        '/admin/bookings',
        '/admin/complaints',
        '/admin/payments',
        '/admin/transfers',
        '/admin/reports',
        '/admin/financial-settings',
        '/admin/users',
        '/admin/reference-lists',
        '/admin/content',
        '/admin/terms',
        '/admin/audit',
        '/admin/library',
      ];

      for (const screen of screens) {
        const fixture = await open(screen);
        expect(router.url).withContext(screen).toBe(screen);
        expect((fixture.nativeElement.textContent as string).trim().length)
          .withContext(`${screen} rendered blank`)
          .toBeGreaterThan(40);
      }
      // Thirteen navigations at ~900ms each outrun Jasmine's 5s default, and a
      // timed-out spec spills its expectations into the next one.
    }, 40_000);

    it('shows all three sidebar groups', async () => {
      const fixture = await open('/admin/dashboard');
      const text = fixture.nativeElement.textContent as string;

      expect(text).toContain('المراجعة والتشغيل');
      expect(text).toContain('المالية');
      expect(text).toContain('النظام');
    });
  });

  describe('as a finance officer', () => {
    beforeEach(async () => {
      await configure(UserRole.FinanceOfficer);
    });

    it('reaches the transfers screen', async () => {
      await open('/admin/transfers');
      expect(router.url).toBe('/admin/transfers');
    });

    it('is refused the user administration screen', async () => {
      await open('/admin/users');
      expect(router.url)
        .withContext('managing users is not a finance permission (SRS §5)')
        .toBe('/forbidden');
    });

    it('is refused the audit trail', async () => {
      await open('/admin/audit');
      expect(router.url).toBe('/forbidden');
    });

    it('is offered no link to a screen it cannot open', async () => {
      const fixture = await open('/admin/transfers');
      // The sidebar specifically: "سجل التدقيق" also appears in the page's own
      // copy, so asserting on the whole document would prove nothing.
      const sidebar = fixture.debugElement.query(By.css('app-admin-sidebar'))
        .nativeElement as HTMLElement;

      expect(sidebar.textContent).toContain('التحويلات');
      expect(sidebar.textContent).not.toContain('سجل التدقيق');
      expect(sidebar.textContent).not.toContain('المستخدمون');
    });
  });

  describe('as an operations supervisor', () => {
    beforeEach(async () => {
      await configure(UserRole.OperationsSupervisor);
    });

    it('reaches both review queues', async () => {
      await open('/admin/listings');
      expect(router.url).toBe('/admin/listings');

      await open('/admin/bookings');
      expect(router.url).toBe('/admin/bookings');
    });

    it('is refused the financial settings', async () => {
      await open('/admin/financial-settings');
      expect(router.url).toBe('/forbidden');
    });
  });

  describe('as a lessor', () => {
    beforeEach(async () => {
      await configure(UserRole.Lessor);
    });

    it('cannot reach the console at all', async () => {
      await open('/admin/dashboard');
      expect(router.url).toBe('/forbidden');
    });
  });

  describe('signed out', () => {
    beforeEach(async () => {
      await configure(null);
    });

    it('can open the administration sign-in', async () => {
      const fixture = await open('/admin/login');

      expect(router.url).toBe('/admin/login');
      expect(fixture.nativeElement.textContent as string).toContain('تسجيل دخول الإدارة');
    });

    it('is sent to sign in rather than into the console', async () => {
      await open('/admin/dashboard');
      expect(router.url).not.toBe('/admin/dashboard');
    });
  });
});
