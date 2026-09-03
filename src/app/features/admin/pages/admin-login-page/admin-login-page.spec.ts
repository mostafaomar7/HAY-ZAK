import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { environment } from '../../../../../environments/environment';
import { AdminLoginPage } from './admin-login-page';

/**
 * The console door took an email and nothing else —
 * `Validators.pattern(REGEX.email)` on the only identifier field.
 *
 * `/auth/login` takes one `identifier` and works out for itself whether it was
 * handed a mobile number or an address, and the seeded operations accounts sign
 * in with a mobile. So every one of them was refused here with "القيمة غير
 * صحيحة" on a credential the server accepts, and the console could not be
 * reached at all.
 */
describe('AdminLoginPage — what counts as a credential', () => {
  let fixture: ComponentFixture<AdminLoginPage>;
  let http: HttpTestingController;
  let el: HTMLElement;

  const url = `${environment.apiUrl}${API_ENDPOINTS.auth.login}`;

  function type(value: string, password = 'Hayzak@2026'): void {
    const input = el.querySelector<HTMLInputElement>('#adm-identifier')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));

    const pw = el.querySelector<HTMLInputElement>('#adm-password')!;
    pw.value = password;
    pw.dispatchEvent(new Event('input'));

    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminLoginPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminLoginPage);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => http.verify());

  /** The regression: a mobile number is a credential the API accepts. */
  it('accepts a mobile number', () => {
    type('0500000004');
    el.querySelector('form')!.dispatchEvent(new Event('submit'));

    const request = http.expectOne(url);
    expect((request.request.body as { identifier: string }).identifier).toBe('0500000004');
    request.flush({ success: true, data: null }, { status: 401, statusText: 'Unauthorized' });
  });

  it('accepts an email just the same', () => {
    type('admin@hayzak.example.com');
    el.querySelector('form')!.dispatchEvent(new Event('submit'));

    const request = http.expectOne(url);
    expect((request.request.body as { identifier: string }).identifier).toBe(
      'admin@hayzak.example.com',
    );
    request.flush({ success: true, data: null }, { status: 401, statusText: 'Unauthorized' });
  });

  /**
   * Required stays. It is the one rule this screen can hold without being able
   * to be wrong — anything narrower is a guess at what the server accepts, and
   * a wrong guess locks somebody out of their own console.
   */
  it('still refuses an empty field, without asking the server', () => {
    type('');
    el.querySelector('form')!.dispatchEvent(new Event('submit'));

    http.expectNone(url);
  });

  /** The label has to say so, or a mobile looks like the wrong thing to type. */
  it('says both are allowed', () => {
    expect(el.textContent).toContain('الجوال');
  });
});
