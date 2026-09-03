import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { errorInterceptor } from '@core/interceptors/error.interceptor';
import { NotificationService } from '@core/services/notification.service';
import { UiToaster } from './ui-toaster';

describe('UiToaster', () => {
  let fixture: ComponentFixture<UiToaster>;
  let notifications: NotificationService;
  let el: HTMLElement;

  function render(): void {
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UiToaster],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UiToaster);
    notifications = TestBed.inject(NotificationService);
    el = fixture.nativeElement as HTMLElement;
    render();
  });

  afterEach(() => notifications.clear());

  it('shows nothing until something is queued', () => {
    expect(el.querySelectorAll('.toast').length).toBe(0);
  });

  it('shows the message it was given', () => {
    notifications.success('تم حفظ التعديلات.');
    render();

    expect(el.querySelectorAll('.toast').length).toBe(1);
    expect(el.textContent).toContain('تم حفظ التعديلات.');
    expect(el.querySelector('.toast--success')).not.toBeNull();
  });

  /**
   * A screen reader user who is not told the save failed carries on as though
   * it succeeded, so an error interrupts where a success waits its turn.
   */
  it('announces an error assertively and a success politely', () => {
    notifications.success('تم الحفظ.');
    notifications.error('تعذّر الحفظ.');
    render();

    const polite = el.querySelector('[aria-live="polite"]')!;
    const assertive = el.querySelector('[aria-live="assertive"]')!;

    expect(polite.textContent).toContain('تم الحفظ.');
    expect(assertive.textContent).toContain('تعذّر الحفظ.');
    expect(assertive.querySelector('.toast')!.getAttribute('role')).toBe('alert');
    expect(polite.querySelector('.toast')!.getAttribute('role')).toBe('status');
  });

  it('can be dismissed by hand', () => {
    notifications.error('تعذّر الحفظ.');
    render();

    el.querySelector<HTMLButtonElement>('.toast__close')!.click();
    render();

    expect(el.querySelectorAll('.toast').length).toBe(0);
  });

  it('stacks several at once', () => {
    notifications.success('واحد');
    notifications.warning('اتنين');
    notifications.info('تلاتة');
    render();

    expect(el.querySelectorAll('.toast').length).toBe(3);
  });

  /**
   * The whole point of the component. `errorInterceptor` has always pushed the
   * server's own message on every failure, and nothing rendered the queue — so
   * a failed action reported nothing at all.
   */
  it('shows the server’s own message when a request fails', () => {
    const http = TestBed.inject(HttpClient);
    const controller = TestBed.inject(HttpTestingController);

    http.post('/api/v1/admin/units/u-1/reject', {}).subscribe({ error: () => undefined });
    controller.expectOne('/api/v1/admin/units/u-1/reject').flush(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'سبب الرفض مطلوب.' },
        requestId: 'req-1',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    render();

    expect(el.querySelector('.toast--error')).not.toBeNull();
    expect(el.textContent).toContain('سبب الرفض مطلوب.');
    controller.verify();
  });
});
