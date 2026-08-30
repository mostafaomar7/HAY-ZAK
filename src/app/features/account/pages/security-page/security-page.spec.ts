import { provideHttpClient, withInterceptors } from '@angular/common/http';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { mockApiInterceptor } from '@core/mock/mock-api.interceptor';
import { SecurityPage } from './security-page';

/**
 * Two properties matter here and neither is cosmetic.
 *
 * The recovery codes are shown once and the server has no route that reissues
 * them, so a screen that renders them anywhere but in front of the user has
 * lost them for that account. And disabling asks for the password *and* a
 * code, because either one alone is exactly what two-factor exists to survive.
 */
describe('SecurityPage', () => {
  let fixture: ComponentFixture<SecurityPage>;
  let el: HTMLElement;

  async function build(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [SecurityPage],
      providers: [provideRouter([]), provideHttpClient(withInterceptors([mockApiInterceptor]))],
    }).compileComponents();

    fixture = TestBed.createComponent(SecurityPage);
    fixture.detectChanges();
    await settle();
  }

  async function settle(): Promise<void> {
    // Outlast the mock interceptor's latency, then render.
    await new Promise((resolve) => setTimeout(resolve, 600));
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  function page(): {
    beginSetup(): void;
    confirmSetup(code: string): void;
    recoveryCodes(): string[] | null;
    step(): string;
    groupedSecret(): string;
    disableForm: { valid: boolean; setValue(v: { password: string; code: string }): void };
  } {
    return fixture.componentInstance as unknown as ReturnType<typeof page>;
  }

  it('offers enrolment when it is off, and enables nothing by asking for a secret', async () => {
    await build();
    expect(el.textContent).toContain('التحقق بخطوتين');

    page().beginSetup();
    await settle();

    // The secret is shown, and the account is still not enrolled — `setup`
    // hands out a provisional secret and turns nothing on.
    expect(page().step()).toBe('scanning');
    expect(el.querySelector('.setup__secret')?.textContent?.trim()).toBeTruthy();
  });

  it('groups the secret so it can be typed, not only scanned', async () => {
    await build();
    page().beginSetup();
    await settle();

    // Somebody enrolling on the phone that is displaying this page cannot scan
    // the screen it is on, so typing is the real path rather than the fallback.
    expect(page().groupedSecret()).toMatch(/^(\w{4} )+\w{1,4}$/);
  });

  it('puts the recovery codes on screen the one time they exist', async () => {
    await build();
    page().beginSetup();
    await settle();

    page().confirmSetup('123456');
    await settle();

    expect(page().step()).toBe('codes');
    expect(page().recoveryCodes()?.length).toBeGreaterThan(0);

    const rendered = el.querySelectorAll('.codes__item');
    expect(rendered.length).toBe(page().recoveryCodes()!.length);
    // The warning is the point of the screen, not decoration on it.
    expect(el.textContent).toContain('مرة واحدة');
  });

  it('refuses to disable on a code alone, or a password alone', async () => {
    await build();
    const form = page().disableForm;

    form.setValue({ password: '', code: '123456' });
    expect(form.valid).withContext('code without a password').toBeFalse();

    form.setValue({ password: 'Hayzak@2026', code: '' });
    expect(form.valid).withContext('password without a code').toBeFalse();

    form.setValue({ password: 'Hayzak@2026', code: '123456' });
    expect(form.valid).withContext('both together').toBeTrue();
  });
});
