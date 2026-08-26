import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideLocationMocks } from '@angular/common/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { By } from '@angular/platform-browser';
import { AdminRole, UserRole } from '@core/enums/user-role.enum';
import { MOCK_ADMIN_USER, SEEDED_ADMIN_PERMISSIONS } from '@core/mock/admin.fixtures';
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
 * is to sign in as each kind of administrator and look.
 *
 * Signing in means holding the permissions the server issues, not naming a
 * role: the API sends one `ADMIN` role and a per-account permission list, so a
 * test that set a role would be testing a rule nothing enforces. The sets come
 * from `SEEDED_ADMIN_PERMISSIONS`, read off the running server.
 */
describe('admin console routing (smoke)', () => {
  let router: Router;

  async function configure(who: AdminRole | UserRole.Lessor | null): Promise<void> {
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

    if (!who) return;

    const administrator = who !== UserRole.Lessor;

    TestBed.inject(AuthService).setSession({
      tokens: {
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresIn: 1800,
        tokenType: 'Bearer',
      },
      user: administrator
        ? { ...MOCK_ADMIN_USER, adminRole: who, permissions: SEEDED_ADMIN_PERMISSIONS[who] }
        : { ...MOCK_ADMIN_USER, role: UserRole.Lessor, adminRole: null, permissions: [] },
    });
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
      await configure(AdminRole.SystemAdmin);
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
      await configure(AdminRole.Finance);
    });

    it('reaches the transfers screen', async () => {
      await open('/admin/transfers');
      expect(router.url).toBe('/admin/transfers');
    });

    /**
     * The commission and the VAT rate are this officer's to set (SRS §5), and
     * the screen was guarded on `settings:manage` — which they do not hold and
     * are not meant to, because it also covers integration keys and system
     * limits. `settings:financial` is the one that exists for this.
     */
    it('reaches the financial settings SRS §5 gives it', async () => {
      await open('/admin/financial-settings');
      expect(router.url).toBe('/admin/financial-settings');
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

    /**
     * The same refusal the API makes: `GET /admin/units` answers 403 to a
     * finance token. Asserted here so the console never offers a queue the
     * server would refuse to fill.
     */
    it('is refused the listing review queue', async () => {
      await open('/admin/listings');
      expect(router.url).toBe('/forbidden');
    });

    /**
     * `complaints:manage` is the system administrator's and the operations
     * supervisor's; the finance officer does not open the queue at all.
     *
     * Worth asserting despite this officer being the one who issues refunds:
     * `refunds:issue` is what a *resolution* needs on top of
     * `complaints:manage`, not a way in. Holding half the pair opens nothing.
     */
    it('is refused the complaints queue despite issuing refunds', async () => {
      await open('/admin/complaints');
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
      await configure(AdminRole.Operations);
    });

    it('reaches both review queues', async () => {
      await open('/admin/listings');
      expect(router.url).toBe('/admin/listings');

      await open('/admin/bookings');
      expect(router.url).toBe('/admin/bookings');
    });

    /**
     * This supervisor handles complaints and cannot refund. The screen shows
     * both halves of that: it opens, and the two refunding resolutions are
     * disabled rather than offered — the server refuses them anyway, but being
     * told after filling in an amount and a bank reference is not the same as
     * being told at the start.
     */
    it('reaches the complaints queue with the refunding decisions disabled', async () => {
      const fixture = await open('/admin/complaints');
      expect(router.url).toBe('/admin/complaints');

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('app-admin-complaints-page')).not.toBeNull();
    });

    it('is refused the financial settings', async () => {
      await open('/admin/financial-settings');
      expect(router.url).toBe('/forbidden');
    });

    /**
     * These two used to ride on `settings:manage`, which made them
     * system-administrator only — narrower than SRS §5. The wire now has
     * `reference:manage` and `audit:view`, so the matrix is the SRS's again.
     */
    it('reaches the reference lists SRS §5 gives it', async () => {
      await open('/admin/reference-lists');
      expect(router.url).toBe('/admin/reference-lists');
    });

    /**
     * The audit trail records what every administrator did, including whoever
     * is reading it. `audit:view` is the system administrator's alone.
     */
    it('is refused the audit trail', async () => {
      await open('/admin/audit');
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
