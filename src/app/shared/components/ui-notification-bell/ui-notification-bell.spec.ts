import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { environment } from '../../../../environments/environment';
import { UiNotificationBell } from './ui-notification-bell';

const NOTIFICATIONS = {
  success: true,
  data: {
    items: [
      {
        id: 'n-1',
        title: 'تمت الموافقة على إعلانك',
        body: '',
        isRead: false,
        createdAt: '2026-08-31T09:00:00.000Z',
        reference: { type: 'unit', id: 'u-1' },
      },
      {
        id: 'n-2',
        title: 'وصلتك رسالة على شكوى',
        body: '',
        isRead: false,
        createdAt: '2026-08-31T08:00:00.000Z',
        reference: null,
      },
    ],
    unreadCount: 2,
    pagination: {
      page: 1,
      pageSize: 10,
      total: 2,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    },
  },
};

/**
 * The bell shared by the three shells.
 *
 * The console had an imitation of this: an icon that linked to the dashboard
 * and badged the count of listings awaiting review. It was labelled
 * "الإشعارات" and had never shown one.
 */
describe('UiNotificationBell', () => {
  let fixture: ComponentFixture<UiNotificationBell>;
  let http: HttpTestingController;
  let el: HTMLElement;

  const url = `${environment.apiUrl}${API_ENDPOINTS.me.notifications}`;

  function openBell() {
    (el.querySelector('.bell__trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    http.expectOne((r) => r.url === url).flush(NOTIFICATIONS);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UiNotificationBell],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(UiNotificationBell);
    fixture.detectChanges();
    http = TestBed.inject(HttpTestingController);
    el = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => http.verify());

  /** A bell that polls costs a request per screen for a rarely-changing number. */
  it('asks for nothing until it is opened', () => {
    http.expectNone((r) => r.url === url);
    expect(el.querySelector('.dropdown')).toBeNull();
  });

  it('lists what is still waiting, and only that', () => {
    openBell();

    const request = http.match(() => false); // nothing further
    expect(request.length).toBe(0);
    expect(el.querySelectorAll('.notif').length).toBe(2);
    expect(el.textContent).toContain('تمت الموافقة على إعلانك');
  });

  /**
   * A notification about nothing is still one the reader has seen. It used to
   * fall back to `/my-bookings`, which sent a lessor whose listing was approved
   * to a screen they do not have.
   */
  it('renders a link only for a notification that points somewhere', () => {
    openBell();

    const items = Array.from(el.querySelectorAll('.notif'));
    expect(items[0].tagName).toBe('A');
    expect(items[0].getAttribute('href')).toBe('/lessor/units/u-1');
    expect(items[1].tagName).toBe('BUTTON');
  });

  /**
   * The console has no inbox route of its own at every shell, so the footer
   * link is drawn only where one was given — never pointing out of the portal.
   */
  it('draws the "view all" link only when a route was given', () => {
    openBell();
    expect(el.querySelector('.dropdown__all')).toBeNull();

    fixture.componentRef.setInput('allRoute', '/admin/notifications');
    fixture.detectChanges();
    expect(el.querySelector('.dropdown__all')?.getAttribute('href')).toBe('/admin/notifications');
  });

  it('says so rather than showing an empty box when there is nothing', () => {
    (el.querySelector('.bell__trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === url)
      .flush({
        success: true,
        data: { items: [], unreadCount: 0, pagination: NOTIFICATIONS.data.pagination },
      });
    fixture.detectChanges();

    expect(el.querySelector('.dropdown__empty')).not.toBeNull();
    expect(el.querySelector('.bell__count')).toBeNull();
  });
});
