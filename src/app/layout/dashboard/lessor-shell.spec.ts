import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationInitStatus, provideAppInitializer } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { AuthService } from '@core/services/auth.service';
import { seedDevSession } from '@core/mock/dev-session';
import { mockApiInterceptor } from '@core/mock/mock-api.interceptor';

/**
 * Integration cover for the lessor portal shell.
 *
 * Written after a real regression: the shell read `ActivatedRoute.firstChild
 * .snapshot.data` while the child was still activating, which threw on the very
 * first render and left the router outlet empty — the app looked like a blank
 * page with a half-drawn chrome. Nothing below mocks the router, so that class
 * of failure surfaces here instead of in a browser.
 */
describe('LessorShell (integration)', () => {
  let harness: RouterTestingHarness;

  async function boot(url: string) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptors([mockApiInterceptor])),
        provideAppInitializer(seedDevSession),
      ],
    });
    await TestBed.inject(ApplicationInitStatus).donePromise;
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    harness.detectChanges();
    return harness.routeNativeElement as HTMLElement;
  }

  /** Real timers: fakeAsync cannot be combined with the awaited navigation. */
  async function settle() {
    await new Promise((resolve) => setTimeout(resolve, 800));
    harness.detectChanges();
  }

  it('signs the mock lessor in so the guards resolve', async () => {
    await boot('/lessor/units');
    const auth = TestBed.inject(AuthService);
    expect(auth.isAuthenticated()).toBeTrue();
  });

  it('stays on the requested route instead of bouncing to a missing login page', async () => {
    await boot('/lessor/units');
    expect(TestBed.inject(Router).url).toBe('/lessor/units');
  });

  it('renders the sidebar with the lessor navigation and its icons', async () => {
    const el = await boot('/lessor/units');

    const labels = Array.from(el.querySelectorAll('.sidebar__item')).map((a) =>
      a.textContent?.trim(),
    );
    expect(labels).toEqual(['اللوحة', 'المساحات المسجّلة', 'الطلبات', 'المستحقات', 'حسابي']);

    // Regression: the icon SVG must have real children, not an empty <svg>.
    expect(el.querySelector('.sidebar__item app-ui-icon svg')?.children.length).toBeGreaterThan(0);
  });

  it('takes the page heading from the deepest route data', async () => {
    const el = await boot('/lessor/units');
    expect(el.querySelector('.topbar__title')?.textContent?.trim()).toBe('المساحات المسجّلة');
  });

  it('shows the gold add-a-space call to action in the topbar', async () => {
    const el = await boot('/lessor/units');
    const cta = el.querySelector('a[href="/lessor/units/new"]');
    expect(cta?.textContent?.trim()).toBe('إضافة مساحة جديدة');
    expect(cta?.className).toContain('btn--accent');
  });

  it('renders the units page content from the mock API', async () => {
    const el = await boot('/lessor/units');

    // The mock interceptor delays 600ms so the loading state is real.
    expect(el.querySelector('app-ui-skeleton')).not.toBeNull();

    await settle();

    expect(el.querySelector('app-ui-skeleton')).toBeNull();
    expect(el.querySelectorAll('app-unit-card').length).toBeGreaterThan(0);
    expect(el.textContent).toContain('مستودع مكيّف — النرجس');
  });

  it('renders the requests page content from the mock API', async () => {
    const el = await boot('/lessor/requests');
    await settle();

    expect(el.querySelector('.topbar__title')?.textContent?.trim()).toBe('الطلبات');
    expect(el.querySelectorAll('app-request-card').length).toBeGreaterThan(0);
  });
});
