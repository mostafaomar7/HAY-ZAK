import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideLocationMocks } from '@angular/common/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { MOCK_RENTER } from '@core/mock/accounts';
import { mockApiInterceptor } from '@core/mock/mock-api.interceptor';
import { AuthService } from '@core/services/auth.service';
import { routes } from './app.routes';
import { App } from './app';

/**
 * End-to-end smoke test of the renter portal through the real router, the real
 * shell and the real mock interceptor — the path `npm start` takes.
 *
 * The lessor portal has an equivalent (app.routing.spec.ts). This one exists for
 * the same reason: every screen rendered in isolation while the shell, the
 * guards and the lazy routes were what broke, and a blank page is invisible to a
 * component test.
 */
describe('renter routing (smoke)', () => {
  let router: Router;

  async function configure(signedIn: boolean): Promise<void> {
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

    if (signedIn) {
      // A real renter account, one role, as `accounts.ts` defines it: a
      // session holding both roles would prove the renter screens open for
      // somebody who is also a lessor, which is not who uses them.
      TestBed.inject(AuthService).setSession({
        tokens: {
          accessToken: 'test-token',
          refreshToken: 'test-refresh',
          expiresIn: 1800,
          tokenType: 'Bearer',
        },
        user: MOCK_RENTER,
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

  // ── Open to guests (FR-MKT-02, design rule 1) ──────────────────────────
  describe('as a guest', () => {
    beforeEach(async () => configure(false));

    it('lands on the storefront, not a login screen', async () => {
      const fixture = await open('/');
      const el = fixture.nativeElement as HTMLElement;

      expect(el.querySelector('app-public-topbar')).withContext('header').not.toBeNull();
      expect(el.querySelector('app-home-page')).withContext('landing page').not.toBeNull();
      expect(router.url).toBe('/');
    });

    it('searches without an account', async () => {
      const fixture = await open('/units');
      const el = fixture.nativeElement as HTMLElement;

      expect(el.querySelector('app-results-page')).not.toBeNull();
      expect(el.querySelectorAll('app-unit-result-card').length).toBeGreaterThan(0);
      expect(el.textContent).toContain('مستودع مكيّف — النرجس');
    });

    it('reads a space in full without an account', async () => {
      const fixture = await open('/units/m-1');
      const el = fixture.nativeElement as HTMLElement;

      expect(el.querySelector('app-unit-details-page')).not.toBeNull();
      expect(el.textContent).toContain('احجز الآن');
    });

    it('reads the static pages without an account', async () => {
      const fixture = await open('/pages/faq');
      const el = fixture.nativeElement as HTMLElement;

      expect(el.querySelector('app-static-page')).not.toBeNull();
      expect(el.querySelectorAll('app-ui-accordion').length).toBeGreaterThan(0);
    });

    // The other half of rule 1: a booking does need an account.
    it('is sent to sign in when reaching for a booking', async () => {
      await open('/my-bookings');

      expect(router.url).toContain('/auth/login');
      expect(router.url).toContain('returnUrl');
    });
  });

  // ── Signed in ──────────────────────────────────────────────────────────
  describe('as a signed-in renter', () => {
    beforeEach(async () => configure(true));

    it('lists the bookings under both tabs', async () => {
      const fixture = await open('/my-bookings');
      const el = fixture.nativeElement as HTMLElement;

      expect(el.querySelector('app-my-bookings-page')).not.toBeNull();
      expect(el.querySelectorAll('app-booking-card').length).toBeGreaterThan(0);
      expect(el.textContent).toContain('حجوزاتي');
    });

    it('opens one booking with its stage trail', async () => {
      const fixture = await open('/my-bookings/rb-1');
      const el = fixture.nativeElement as HTMLElement;

      expect(el.querySelector('app-booking-detail-page')).not.toBeNull();
      expect(el.querySelector('app-ui-stepper')).withContext('stage trail').not.toBeNull();
      expect(el.textContent).toContain('HZ-2026-04871');
    });

    it('renders the tax invoice', async () => {
      const fixture = await open('/my-bookings/rb-1/invoice');
      const el = fixture.nativeElement as HTMLElement;

      expect(el.querySelector('app-invoice-page')).not.toBeNull();
      expect(el.textContent).toContain('INV-2026-04871');
    });

    /**
     * There is no cancellation screen. A renter with a problem raises a
     * complaint and administration decides — so the screen that used to quote a
     * refund now takes a description of what went wrong.
     */
    it('offers a complaint route rather than a cancellation', async () => {
      const fixture = await open('/my-bookings/rb-1/complaint');
      const el = fixture.nativeElement as HTMLElement;

      expect(el.querySelector('app-raise-complaint-page')).not.toBeNull();
      expect(el.textContent).toContain('لديّ مشكلة');
      // It says who decides, so nobody leaves expecting an automatic refund.
      expect(el.textContent).toContain('لا يمكن إلغاء الحجز من الطرفين');
    });

    it('starts the booking wizard on step one', async () => {
      const fixture = await open('/booking/new/m-1');
      const el = fixture.nativeElement as HTMLElement;

      expect(el.querySelector('app-dates-step')).not.toBeNull();
      expect(el.querySelector('app-ui-wizard-steps')).withContext('three steps').not.toBeNull();
      expect(el.querySelector('app-ui-range-calendar')).withContext('calendar').not.toBeNull();
    });

    /**
     * Every step renders, which is a lower bar than it sounds.
     *
     * A step that injects a service nobody provides throws at construction, and
     * the router responds by showing *nothing* — the shell and its step header
     * stay on screen with an empty outlet underneath. It reads as a blank page
     * rather than as an error, and the build cannot catch it because the
     * injector is a runtime graph. It happened; this is the guard.
     */
    for (const [step, selector] of [
      ['new/m-1', 'app-dates-step'],
      ['new/m-1/goods', 'app-goods-step'],
      ['bk-1/pay', 'app-payment-step'],
    ] as const) {
      it(`renders a component at /booking/${step}`, async () => {
        const fixture = await open(`/booking/${step}`);
        const el = fixture.nativeElement as HTMLElement;

        expect(el.querySelector(selector)).withContext(`${selector} is missing`).not.toBeNull();
      });
    }

    it('renders the payment return page the gateway sends the browser to', async () => {
      // A fixed address on this origin — the API validates it, so it cannot
      // move without a conversation. If it stops resolving, payment ends on a
      // blank page after the money has moved.
      const fixture = await open('/bookings/return?bookingId=rb-1&status=paid');
      const el = fixture.nativeElement as HTMLElement;

      expect(el.querySelector('app-payment-return-page')).not.toBeNull();
    });

    it('renders the account screen with the ID masked', async () => {
      const fixture = await open('/account');
      const el = fixture.nativeElement as HTMLElement;

      expect(el.querySelector('app-account-page')).not.toBeNull();
      // NFR-SEC-02 — only the last four digits, ever.
      expect(el.textContent).toContain('••••••6421');
      expect(el.querySelectorAll('app-ui-toggle').length).toBe(4);
    });

    it('renders the notification inbox grouped by day', async () => {
      const fixture = await open('/account/notifications');
      const el = fixture.nativeElement as HTMLElement;

      expect(el.querySelector('app-renter-notifications-page')).not.toBeNull();
      expect(el.querySelectorAll('.group').length).toBeGreaterThan(0);
    });

    it('keeps the shell around the whole journey', async () => {
      const fixture = await open('/units');
      const el = fixture.nativeElement as HTMLElement;
      const topbar = el.querySelector('app-public-topbar');

      await router.navigateByUrl('/my-bookings');
      fixture.detectChanges();
      await new Promise((resolve) => setTimeout(resolve, 900));
      fixture.detectChanges();

      // The same element: the header is not torn down between features.
      expect(el.querySelector('app-public-topbar')).toBe(topbar);
    });
  });
});
