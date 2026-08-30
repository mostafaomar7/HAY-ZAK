import { provideHttpClient, withInterceptors } from '@angular/common/http';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { STORAGE_KEYS } from '@core/constants/storage-keys';
import { UserRole } from '@core/enums/user-role.enum';
import { mockApiInterceptor } from '@core/mock/mock-api.interceptor';
import { PublicTopbar } from './public-topbar';

/**
 * The bar's two shapes, and one rule that is easy to break twice.
 *
 * "إضافة مساحتك الآن" points at `/auth/account-type`, which is behind
 * `guestGuard`. For a signed-in renter that is a button which navigates
 * nowhere — the guard bounces them straight back — so it has to be absent
 * rather than dead. A lessor gets the screen the words actually name.
 */
describe('PublicTopbar', () => {
  let fixture: ComponentFixture<PublicTopbar>;
  let el: HTMLElement;

  function signIn(role: UserRole): void {
    localStorage.setItem(STORAGE_KEYS.accessToken, JSON.stringify('token'));
    localStorage.setItem(
      STORAGE_KEYS.user,
      JSON.stringify({ id: 'u-1', fullName: 'سارة', role, permissions: [] }),
    );
  }

  async function build(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [PublicTopbar],
      providers: [provideRouter([]), provideHttpClient(withInterceptors([mockApiInterceptor]))],
    }).compileComponents();

    fixture = TestBed.createComponent(PublicTopbar);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  function cta(): HTMLAnchorElement | null {
    return el.querySelector<HTMLAnchorElement>('.actions__cta');
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('sends a guest to choose an account type', async () => {
    await build();

    expect(cta()?.getAttribute('href')).toBe('/auth/account-type');
  });

  it('sends a lessor to the screen that adds a space', async () => {
    signIn(UserRole.Lessor);
    await build();

    expect(cta()?.getAttribute('href')).toBe('/lessor/units/new');
  });

  it('shows a renter no button at all, because there is nowhere it could go', async () => {
    signIn(UserRole.Renter);
    await build();

    expect(cta()).toBeNull();
  });

  it('offers a guest the sign-in link and a signed-in user their account', async () => {
    await build();
    expect(el.querySelector('a[href="/auth/login"]')).not.toBeNull();

    localStorage.clear();
    signIn(UserRole.Renter);
    TestBed.resetTestingModule();
    await build();

    expect(el.querySelector('a[href="/auth/login"]')).toBeNull();
    expect(el.querySelector('a[href="/account"]')).not.toBeNull();
  });
});
