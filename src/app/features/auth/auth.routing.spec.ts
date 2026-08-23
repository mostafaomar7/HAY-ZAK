import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideLocationMocks } from '@angular/common/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { mockApiInterceptor } from '@core/mock/mock-api.interceptor';
import { routes } from '../../app.routes';
import { App } from '../../app';

/** Smoke coverage for the three sign-in screens (design file 2). */
describe('auth routing (smoke)', () => {
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

    // guestGuard bounces a signed-in user away from these screens, so the
    // session from another spec must not leak in.
    localStorage.clear();
  });

  afterEach(() => localStorage.clear());

  async function open(url: string): Promise<ComponentFixture<App>> {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    await router.navigateByUrl(url);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 800));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    return fixture;
  }

  it('renders the login form', async () => {
    const el = (await open('/auth/login')).nativeElement as HTMLElement;

    expect(el.querySelector('app-login-page')).not.toBeNull();
    expect(el.querySelector('#l-identifier')).not.toBeNull();
    expect(el.querySelector('#l-password')).not.toBeNull();
    // The brand panel is decorative, so it must be hidden from assistive tech.
    expect(el.querySelector('.auth__brand')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders the registration form with every required field', async () => {
    const el = (await open('/auth/register')).nativeElement as HTMLElement;

    expect(el.querySelector('app-register-page')).not.toBeNull();
    for (const id of ['#r-name', '#r-id', '#r-email', '#r-mobile', '#r-password', '#r-confirm']) {
      expect(el.querySelector(id)).withContext(id).not.toBeNull();
    }
    // FR-AUTH-06 — acceptance is a real checkbox, not fine print.
    expect(el.querySelector('.terms input[type="checkbox"]')).not.toBeNull();
  });

  it('renders six OTP boxes reading left to right', async () => {
    const el = (await open('/auth/verify?mobile=0551234567')).nativeElement as HTMLElement;

    expect(el.querySelector('app-otp-page')).not.toBeNull();
    expect(el.querySelectorAll('.otp__box').length).toBe(6);
    expect(el.querySelector('.otp')?.getAttribute('dir')).toBe('ltr');
    expect(el.textContent).toContain('المحاولات المتبقية');
  });

  it('redirects a bare /auth to login', async () => {
    await open('/auth');
    expect(router.url).toBe('/auth/login');
  });
});
