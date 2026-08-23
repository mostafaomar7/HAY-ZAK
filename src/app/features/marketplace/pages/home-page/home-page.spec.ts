import { provideHttpClient, withInterceptors } from '@angular/common/http';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { mockApiInterceptor } from '@core/mock/mock-api.interceptor';
import { HomePage } from './home-page';

describe('HomePage (renter landing)', () => {
  let fixture: ComponentFixture<HomePage>;
  let router: Router;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [provideRouter([]), provideHttpClient(withInterceptors([mockApiInterceptor]))],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;

    // The mock interceptor answers the reference lists after a short delay.
    await new Promise((resolve) => setTimeout(resolve, 700));
    fixture.detectChanges();
  });

  it('renders the hero, the search card and the three-step explainer', () => {
    expect(el.querySelector('.hero__title')?.textContent).toContain('مساحاتك');
    expect(el.querySelector('.search')).not.toBeNull();
    // FR-MKT-01 requires a three-step "how it works" section.
    expect(el.querySelectorAll('.step').length).toBe(3);
  });

  it('populates city and category options from reference data', () => {
    const cities = el.querySelectorAll('#h-city option');
    const categories = el.querySelectorAll('#h-category option');

    // Each has the "any" option plus the loaded list.
    expect(cities.length).toBeGreaterThan(1);
    expect(categories.length).toBeGreaterThan(1);
  });

  // Design rule 1 / FR-MKT-02: nothing here may demand an account.
  it('asks for no sign-in to search', () => {
    expect(el.textContent).not.toContain('تسجيل الدخول');
    expect(el.querySelector('input[type="password"]')).toBeNull();
  });

  it('carries the chosen filters into the results query string', async () => {
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);

    fixture.componentInstance['form'].patchValue({
      cityId: 'riyadh',
      categoryId: 'warehouse',
      days: 14,
    });
    fixture.componentInstance['search']();

    expect(navigate).toHaveBeenCalledWith(
      ['/units'],
      jasmine.objectContaining({
        queryParams: jasmine.objectContaining({
          cityId: 'riyadh',
          categoryId: 'warehouse',
          days: 14,
        }),
      }),
    );
  });

  it('offers both calendars and shows a Hijri reading of the chosen date', () => {
    const toggles = el.querySelectorAll<HTMLButtonElement>('.calendar__opt');
    expect(toggles.length).toBe(2);
    expect(toggles[0].getAttribute('aria-pressed')).toBe('true');

    fixture.componentInstance['form'].patchValue({ startDate: '2026-09-01' });
    fixture.detectChanges();

    // NFR-USB-05 — the same instant, read in the Umm al-Qura calendar.
    const hijri = fixture.componentInstance['hijriDate']();
    expect(hijri).toBeTruthy();
    expect(hijri).not.toContain('2026');
  });

  it('rejects a start date in the past', () => {
    const control = fixture.componentInstance['form'].controls.startDate;

    control.setValue('2020-01-01');
    expect(control.valid).toBeFalse();

    control.setValue('2099-01-01');
    expect(control.valid).toBeTrue();
  });
});
