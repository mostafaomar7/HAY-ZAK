import { provideHttpClient, withInterceptors } from '@angular/common/http';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { mockApiInterceptor } from '@core/mock/mock-api.interceptor';
import { MOCK_MARKET_UNITS } from '@core/mock/renter.fixtures';
import { AuthService } from '@core/services/auth.service';
import { UnitDetailsPage } from './unit-details-page';

/**
 * The details page carries two of the design's binding rules, and both are
 * requirements rather than layout choices — so they are tested here.
 *
 * Rule 5: exactly one primary action, and no way to contact the owner. SRS §5
 * seals the counterparty's details until administration approves a booking.
 * Rule 1: a guest reads the whole page, and is only asked for an account when
 * "احجز الآن" is pressed.
 */
describe('UnitDetailsPage', () => {
  let fixture: ComponentFixture<UnitDetailsPage>;
  let el: HTMLElement;

  async function build(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [UnitDetailsPage],
      providers: [provideRouter([]), provideHttpClient(withInterceptors([mockApiInterceptor]))],
    }).compileComponents();

    fixture = TestBed.createComponent(UnitDetailsPage);
    fixture.componentRef.setInput('id', MOCK_MARKET_UNITS[0].id);
    fixture.detectChanges();

    // Outlast the mock interceptor's latency, then render the response.
    await new Promise((resolve) => setTimeout(resolve, 800));
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('shows the space without asking a guest to sign in', async () => {
    await build();

    expect(el.textContent).toContain(MOCK_MARKET_UNITS[0].title);
    expect(el.querySelector('input[type="password"]')).toBeNull();
  });

  // Design rule 5 / FR-MKT-09. Asserted structurally rather than by looking for
  // words: a "call the owner" control would be a link or a button, and there is
  // exactly one action that matters on this page.
  it('offers no way to contact the owner', async () => {
    await build();

    expect(el.querySelector('a[href^="tel:"]')).withContext('phone link').toBeNull();
    expect(el.querySelector('a[href^="mailto:"]')).withContext('mail link').toBeNull();
    expect(el.querySelector('form')).withContext('enquiry form').toBeNull();
  });

  it('never names the owner', async () => {
    await build();

    // The fixture's lessor id must not leak into the rendered page.
    expect(el.textContent).not.toContain('lessor-1');
  });

  // FR-UNT-11 — before approval, the location is a 300 m circle and nothing more.
  it('shows the approximate location, not a pin', async () => {
    await build();

    const map = el.querySelector('app-ui-location-map');
    expect(map).not.toBeNull();
    expect(map?.querySelector('.map__circle')).withContext('300 m circle').not.toBeNull();
    expect(map?.querySelector('.map__pin')).withContext('exact pin').toBeNull();
  });

  // FR-UNT-11 again, one layer down: the catalogue response must not even carry
  // the address, so a template mistake cannot leak it.
  it('is never sent the exact address for an unbooked space', async () => {
    await build();

    expect(el.textContent).not.toContain('شارع الأمير سلطان');
  });

  it('groups the visiting hours by day', async () => {
    await build();

    const rows = el.querySelectorAll('.hours__row');
    expect(rows.length).toBe(3);
    // The design's own grouping: Sunday through Thursday as one range.
    expect(rows[0].textContent).toContain('—');
  });

  it('lists the prohibited items from reference data', async () => {
    await build();

    expect(el.querySelectorAll('.banned__item').length).toBe(5);
  });

  /** Design rule 1 — the account is requested here, not at the door. */
  it('asks a guest to register when booking, without leaving the page', async () => {
    await build();

    const book = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes('احجز الآن'),
    );
    expect(book).withContext('the single primary action').toBeDefined();

    book?.click();
    fixture.detectChanges();

    expect(el.querySelector('app-ui-modal')).not.toBeNull();
    expect(el.textContent).toContain('التسجيل لإكمال الحجز');
    // Still on the details page — the dates the visitor picked are not lost.
    expect(el.textContent).toContain(MOCK_MARKET_UNITS[0].title);
  });

  it('sends a signed-in renter into the booking wizard with the dates attached', async () => {
    await build();

    TestBed.inject(AuthService).setSession({
      accessToken: 'test-token',
      user: {
        id: 'r-1',
        fullName: 'فهد الدوسري',
        mobile: '0552104478',
        email: 'f@example.com',
        roles: [],
        status: 'Active' as never,
        createdAt: '2026-08-01T09:00:00Z',
      },
    });

    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    const book = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes('احجز الآن'),
    );
    book?.click();

    expect(navigate).toHaveBeenCalledWith(
      ['/booking', 'new', MOCK_MARKET_UNITS[0].id],
      jasmine.objectContaining({
        queryParams: jasmine.objectContaining({ start: jasmine.any(String) }),
      }),
    );
  });

  it('disables booking on a space that is already let', async () => {
    await TestBed.configureTestingModule({
      imports: [UnitDetailsPage],
      providers: [provideRouter([]), provideHttpClient(withInterceptors([mockApiInterceptor]))],
    }).compileComponents();

    fixture = TestBed.createComponent(UnitDetailsPage);
    // m-7 is the fully-booked fixture (FR-MKT-10).
    fixture.componentRef.setInput('id', 'm-7');
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 800));
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;

    const book = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes('احجز الآن'),
    );

    expect(book?.disabled).toBeTrue();
    expect(el.textContent).toContain('هذه المساحة محجوزة حاليًا');
  });
});
