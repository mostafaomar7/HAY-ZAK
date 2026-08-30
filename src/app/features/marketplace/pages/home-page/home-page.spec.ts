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

  it('renders the hero, the search bar and the three-step explainer', () => {
    expect(el.querySelector('.hero__title')?.textContent).toContain('مساحاتك');
    expect(el.querySelector('.bar')).not.toBeNull();
    // FR-MKT-01 requires a three-step "how it works" section.
    expect(el.querySelectorAll('.step').length).toBe(3);
  });

  it('shows a tile per category, with how many spaces are in it', () => {
    const tiles = el.querySelectorAll('.cat');

    expect(tiles.length).toBe(4);
    expect(tiles[0].textContent).toContain('مستودع');
    expect(tiles[0].querySelector('.cat__count')?.textContent?.trim()).toContain('19');
    expect(tiles[0].querySelector('svg')).withContext('category icon').not.toBeNull();
  });

  it('shows the newest spaces and a way through to the rest', () => {
    expect(el.querySelectorAll('app-unit-result-card').length).toBe(4);
    expect(el.querySelector('.section__more')?.getAttribute('href')).toBe('/units');
  });

  it('offers the closing call to action to both sides of the market', () => {
    const links = Array.from(el.querySelectorAll<HTMLAnchorElement>('.cta a'));

    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/units', '/auth/account-type']);
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

  /**
   * The hero asks for a start and a length; `/public/units` takes two dates and
   * refuses one end of a range on its own. So the far end is worked out here,
   * and `days` — which the endpoint does not know and would answer 422 to —
   * never reaches the query string.
   */
  it('carries the chosen filters into the results query string as a date range', () => {
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);

    fixture.componentInstance['form'].patchValue({
      cityId: 'riyadh',
      categoryId: 'warehouse',
      startDate: '2026-09-01',
      days: 14,
    });
    fixture.componentInstance['search']();

    const [path, extras] = navigate.calls.mostRecent().args as [
      string[],
      { queryParams: Record<string, unknown> },
    ];

    expect(path).toEqual(['/units']);
    expect(extras.queryParams['cityId']).toBe('riyadh');
    expect(extras.queryParams['categoryId']).toBe('warehouse');
    expect(extras.queryParams['startDate']).toBe('2026-09-01');
    // Half-open: the end is the first day the space is free again.
    expect(extras.queryParams['endDate']).toBe('2026-09-15');
    expect(extras.queryParams['days']).toBeUndefined();
  });

  it('sends neither end of the range when no start date was picked', () => {
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);

    fixture.componentInstance['form'].patchValue({ cityId: 'riyadh', days: 14 });
    fixture.componentInstance['search']();

    const [, extras] = navigate.calls.mostRecent().args as [
      string[],
      { queryParams: Record<string, unknown> },
    ];

    expect(extras.queryParams['startDate']).toBeNull();
    expect(extras.queryParams['endDate']).toBeNull();
  });

  it('offers both calendars and shows a Hijri reading of the chosen date', () => {
    const toggles = el.querySelectorAll<HTMLButtonElement>('.cal__opt');
    expect(toggles.length).toBe(2);
    expect(toggles[0].getAttribute('aria-pressed')).toBe('true');

    fixture.componentInstance['form'].patchValue({ startDate: '2026-09-01' });
    fixture.detectChanges();

    // NFR-USB-05 — the same instant, read in the Umm al-Qura calendar.
    const hijri = fixture.componentInstance['hijriDate']();
    expect(hijri).toBeTruthy();
    expect(hijri).not.toContain('2026');
  });

  it('lets the date be entered in Hijri and stores the Gregorian equivalent', () => {
    const page = fixture.componentInstance as unknown as {
      setCalendar(c: 'gregorian' | 'hijri'): void;
      setHijriYear(v: string): void;
      setHijriMonth(v: string): void;
      setHijriDay(v: string): void;
      hijriDays(): number[];
    };

    page.setCalendar('hijri');
    fixture.detectChanges();

    // The native control is gone; three lists stand in its place.
    expect(el.querySelector('input[type="date"]')).toBeNull();
    expect(el.querySelectorAll('.hj__part').length).toBe(3);

    page.setHijriYear('1448');
    page.setHijriMonth('9');
    page.setHijriDay('1');
    fixture.detectChanges();

    // 1 Ramadan 1448. The value that leaves the form is Gregorian, because that
    // is the only thing the API accepts.
    expect(fixture.componentInstance['form'].controls.startDate.value).toBe('2027-02-08');
  });

  it('offers only the days the Umm al-Qura month actually has', () => {
    const page = fixture.componentInstance as unknown as {
      setCalendar(c: 'gregorian' | 'hijri'): void;
      setHijriYear(v: string): void;
      setHijriMonth(v: string): void;
      hijriDays(): number[];
    };

    page.setCalendar('hijri');
    page.setHijriYear('1448');

    // Ramadan 1448 is twenty-nine days. A thirtieth in the list is a date the
    // conversion would have to answer `null` for.
    page.setHijriMonth('9');
    expect(page.hijriDays().length).toBe(29);

    page.setHijriMonth('10');
    expect(page.hijriDays().length).toBe(30);
  });

  it('rejects a start date in the past', () => {
    const control = fixture.componentInstance['form'].controls.startDate;

    control.setValue('2020-01-01');
    expect(control.valid).toBeFalse();

    control.setValue('2099-01-01');
    expect(control.valid).toBeTrue();
  });
});
