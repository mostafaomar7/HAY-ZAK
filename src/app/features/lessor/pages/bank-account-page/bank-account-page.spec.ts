import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { errorInterceptor } from '@core/interceptors/error.interceptor';
import { VerificationStatus } from '@core/enums/user-role.enum';
import type { LessorBankAccount } from '@core/models/user.model';
import { environment } from '../../../../../environments/environment';
import { BankAccountPage } from './bank-account-page';

function account(overrides: Partial<LessorBankAccount> = {}): LessorBankAccount {
  return {
    id: 'ba-1',
    accountHolderName: 'خالد سعد العتيبي',
    bankName: 'مصرف الراجحي',
    ibanLast4: '7519',
    verificationStatus: VerificationStatus.Verified,
    isDefault: true,
    ...overrides,
  };
}

/**
 * LSR-08 — the screen that decides where a lessor's money goes.
 *
 * The tests below are about the three things that would be expensive to get
 * wrong rather than about markup: that the full IBAN never appears, that
 * moving the money is confirmed rather than done on one click, and that the
 * server's own reason for refusing a number survives to the screen.
 */
describe('BankAccountPage (LSR-08)', () => {
  let fixture: ComponentFixture<BankAccountPage>;
  let http: HttpTestingController;
  let el: HTMLElement;

  const url = `${environment.apiUrl}${API_ENDPOINTS.me.bankAccounts}`;

  function flush(accounts: LessorBankAccount[]) {
    http
      .expectOne((r) => r.url === url && r.method === 'GET')
      .flush({ data: { items: accounts }, success: true });
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BankAccountPage],
      providers: [
        provideRouter([]),
        // The real error interceptor: it is what turns a 422 into an `ApiError`
        // carrying the server's message, and a spec without it would be
        // testing a path the application never takes.
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BankAccountPage);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => http.verify());

  /**
   * The API returns four digits and has no endpoint that would give up the
   * rest, to anybody, including the owner (NFR-SEC-02). A screen that rendered
   * a fuller number would be rendering something it invented.
   */
  it('shows four digits of the IBAN and never a whole one', () => {
    flush([account()]);

    const text = el.textContent ?? '';
    expect(text).toContain('•••• 7519');
    expect(text).not.toContain('SA');
  });

  it('names the bank the API resolved, since nobody chose it', () => {
    flush([account()]);
    expect(el.textContent).toContain('مصرف الراجحي');
  });

  /** No bank picker: the number says which bank, and a sent one is ignored. */
  it('asks for the holder and the IBAN, and for nothing else', () => {
    flush([]);

    const controls = fixture.componentInstance['form'].controls;
    expect(Object.keys(controls).sort()).toEqual(['accountHolderName', 'iban']);
    expect(el.querySelector('select')).toBeNull();
  });

  /**
   * The spacing a bank prints on a statement, and the one a phone keyboard
   * produces. Rejecting it would be rejecting the format the user was handed.
   */
  it('accepts an IBAN written with the spaces the bank prints', () => {
    flush([]);

    const iban = fixture.componentInstance['form'].controls.iban;
    iban.setValue('SA03 8000 0000 6080 1016 7519');
    expect(iban.valid).toBeTrue();
  });

  /**
   * `UNVERIFIED` means an administrator has not looked yet, not that anything
   * was refused — so it must not take a control away from the lessor while
   * they wait on a queue they cannot see.
   */
  it('disables nothing because an account is still unverified', () => {
    flush([account({ verificationStatus: VerificationStatus.Unverified, isDefault: false })]);

    const buttons = Array.from(el.querySelectorAll('.account__actions button'));
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((button) => !(button as HTMLButtonElement).disabled)).toBeTrue();
  });

  /**
   * Moving the default moves where the money lands. One click is not enough
   * of a decision for that.
   */
  it('confirms before moving where the earnings are sent', () => {
    flush([
      account({ isDefault: true }),
      account({ id: 'ba-2', ibanLast4: '1234', isDefault: false }),
    ]);

    const makeDefault = Array.from(el.querySelectorAll('.account__actions button')).find((b) =>
      b.textContent?.includes('اجعله الافتراضي'),
    ) as HTMLButtonElement;

    makeDefault.click();
    fixture.detectChanges();

    // The dialog is open and nothing has been sent yet.
    expect(el.textContent).toContain('ستُحوَّل مستحقاتك القادمة');
    http.expectNone((r) => r.method === 'PUT');
  });

  /**
   * The API tells a mistyped digit from a foreign account from a duplicate,
   * and says which in Arabic. Replacing that with one generic line would throw
   * away the only part the lessor can act on.
   */
  it("shows the server's own reason for refusing an IBAN", () => {
    flush([]);

    const form = fixture.componentInstance['form'];
    form.setValue({
      accountHolderName: 'خالد سعد العتيبي',
      iban: 'SA0380000000608010167519',
    });
    fixture.componentInstance['submit']();

    http
      .expectOne((r) => r.url === url && r.method === 'POST')
      .flush(
        {
          success: false,
          error: {
            code: 'IBAN_CHECKSUM_FAILED',
            message: 'رقم الآيبان غير صحيح — غالباً هناك رقم مكتوب خطأ.',
          },
          requestId: 'req-1',
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    fixture.detectChanges();

    expect(el.textContent).toContain('غالباً هناك رقم مكتوب خطأ');
  });
});
