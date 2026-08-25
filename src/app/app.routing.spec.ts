import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideLocationMocks } from '@angular/common/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { mockApiInterceptor } from '@core/mock/mock-api.interceptor';
import { MOCK_LESSOR } from '@core/mock/lessor.fixtures';
import { AuthService } from '@core/services/auth.service';
import { routes } from './app.routes';
import { App } from './app';

/**
 * End-to-end smoke test through the real router and the real mock interceptor —
 * the same path a developer hits with `npm start`.
 *
 * This exists because a blank page is the one failure the unit tests could not
 * see: every page rendered in isolation, while the shell, the guards and the
 * lazy routes were what actually broke. Anything that blanks the lessor portal
 * on first load should fail here.
 */
describe('app routing (smoke)', () => {
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        provideLocationMocks(),
        provideHttpClient(withInterceptors([mockApiInterceptor])),
      ],
    }).compileComponents();

    router = TestBed.inject(Router);

    // The guards need a session; seedDevSession does this in the real app.
    localStorage.clear();
    TestBed.inject(AuthService).setSession({
      tokens: {
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresIn: 1800,
        tokenType: 'Bearer',
      },
      user: MOCK_LESSOR,
    });
  });

  afterEach(() => localStorage.clear());

  /**
   * Boots the app, navigates, and waits out the mock interceptor's latency.
   *
   * Real timers rather than fakeAsync: a lazy route resolves a dynamic import,
   * which fakeAsync's microtask queue does not drain reliably. navigateByUrl's
   * promise already waits for the chunk, so awaiting it is both simpler and
   * closer to what the browser does.
   */
  async function open(url: string): Promise<ComponentFixture<App>> {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    await router.navigateByUrl(url);
    fixture.detectChanges();

    // Outlast the mock's delay(500), then let the response render.
    await new Promise((resolve) => setTimeout(resolve, 800));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    return fixture;
  }

  /** Same waiting as open(), for a navigation triggered by a DOM click. */
  async function settleAfterClick(fixture: ComponentFixture<App>) {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 800));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('renders the lessor spaces screen, not a blank page', async () => {
    const fixture = await open('/lessor/units');

    const el = fixture.nativeElement as HTMLElement;

    // The shell.
    expect(el.querySelector('app-lessor-sidebar')).withContext('sidebar').not.toBeNull();
    expect(el.querySelector('app-lessor-topbar')).withContext('topbar').not.toBeNull();

    // The routed page, with content from the fixtures.
    expect(el.querySelector('app-units-page')).withContext('page').not.toBeNull();
    expect(el.textContent).toContain('مستودع مكيّف — النرجس');
    expect(el.querySelectorAll('app-unit-card').length).toBeGreaterThan(0);
  });

  it('renders the requests screen', async () => {
    const fixture = await open('/lessor/requests');

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-requests-page')).not.toBeNull();
    expect(el.querySelectorAll('app-request-card').length).toBeGreaterThan(0);
  });

  it('renders the earnings table with the hero total', async () => {
    const fixture = await open('/lessor/earnings');

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-earnings-page')).not.toBeNull();
    expect(el.textContent).toContain('إجمالي الأرباح');
    expect(el.textContent).toContain('2,707.50');
  });

  it('renders the notifications inbox', async () => {
    const fixture = await open('/lessor/notifications');

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-notifications-page')).not.toBeNull();
    expect(el.querySelectorAll('.row').length).toBeGreaterThan(0);
  });

  it('renders the add-a-space wizard on step 1', async () => {
    const fixture = await open('/lessor/units/new');

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-unit-form-page')).not.toBeNull();
    expect(el.querySelector('app-ui-wizard-steps')).not.toBeNull();
    expect(el.textContent).toContain('تصنيف المساحة');
  });

  it('sets the topbar heading from the route data', async () => {
    const fixture = await open('/lessor/earnings');

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.topbar__title')?.textContent,
    ).toContain('المستحقات');
  });

  // Reproduces the reported fault: the card and its "التفاصيل" link did not open
  // anything. Clicks the real anchor rather than calling navigate directly, so a
  // broken href or a swallowed click fails here too.
  it('opens a unit detail page from the card link', async () => {
    const fixture = await open('/lessor/units');
    const el = fixture.nativeElement as HTMLElement;

    const details = Array.from(el.querySelectorAll<HTMLAnchorElement>('a')).find(
      (a) => a.textContent?.trim() === 'التفاصيل',
    );
    expect(details).withContext('details link exists').toBeDefined();
    expect(details?.getAttribute('href')).toMatch(/^\/lessor\/units\/.+/);

    details?.click();
    await settleAfterClick(fixture);

    expect(router.url).toMatch(/^\/lessor\/units\/.+/);
    expect(el.querySelector('app-unit-detail-page')).withContext('detail page').not.toBeNull();
  });

  it('opens a request detail page from the card link', async () => {
    const fixture = await open('/lessor/requests');
    const el = fixture.nativeElement as HTMLElement;

    const card = el.querySelector<HTMLAnchorElement>('a.req');
    expect(card).withContext('request card is a link').not.toBeNull();
    expect(card?.getAttribute('href')).toMatch(/^\/lessor\/requests\/.+/);

    card?.click();
    await settleAfterClick(fixture);

    expect(router.url).toMatch(/^\/lessor\/requests\/.+/);
    expect(el.querySelector('app-request-detail-page')).withContext('detail page').not.toBeNull();
  });

  it('renders the lessor dashboard with its onboarding blocker', async () => {
    const fixture = await open('/lessor/dashboard');
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('app-dashboard-page')).not.toBeNull();
    expect(el.textContent).toContain('إجمالي المستحقات');
    expect(el.textContent).toContain('آخر الإشعارات');
  });

  it('renders the saved bank details with the IBAN masked', async () => {
    const fixture = await open('/lessor/bank-account');
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('app-bank-account-page')).not.toBeNull();
    expect(el.textContent).toContain('تم حفظ بياناتك البنكية');
    // NFR-SEC-02 — only the last four characters may ever be shown.
    expect(el.textContent).toContain('7519');
    expect(el.textContent).not.toContain('SA0380000000608010167519');
  });

  it('renders the profile screen with the deletion panel closed', async () => {
    const fixture = await open('/lessor/account');
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('app-profile-page')).not.toBeNull();
    expect(el.textContent).toContain('تفضيلات الإشعارات');
    expect(el.querySelectorAll('app-ui-toggle').length).toBe(3);
    // The destructive form must not be reachable without opening the panel.
    expect(el.querySelector('#d-confirm')).toBeNull();
  });

  it('sends an unknown path to the not-found page instead of throwing', async () => {
    const fixture = await open('/does/not/exist');

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('الصفحة غير موجودة');
  });
});
