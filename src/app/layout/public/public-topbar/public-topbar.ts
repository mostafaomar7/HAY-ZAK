import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { AuthService } from '@core/services/auth.service';
import { NotificationInboxService } from '@core/services/notification-inbox.service';
import { ClickOutsideDirective } from '@shared/directives/click-outside.directive';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiIcon } from '@shared/components/ui-icon/ui-icon';

/**
 * Public header for the renter side.
 *
 * Browsing and search are open to guests (FR-MKT-02 and design rule 1), so this
 * bar has two shapes: a guest sees sign-in and the "list your space" call to
 * action; a signed-in renter sees their bookings and the notification bell. It
 * never blocks the page behind a login.
 */
@Component({
  selector: 'app-public-topbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, ClickOutsideDirective, UiButton, UiIcon],
  host: { '(document:keydown.escape)': 'closeNotifications()' },
  templateUrl: './public-topbar.html',
  styleUrl: './public-topbar.scss',
})
export class PublicTopbar {
  private readonly auth = inject(AuthService);
  private readonly inbox = inject(NotificationInboxService);

  protected readonly i18n = inject(LanguageService);

  readonly toggleLanguage = output<void>();

  protected readonly isAuthenticated = this.auth.isAuthenticated;
  protected readonly user = this.auth.user;
  protected readonly unreadCount = this.inbox.unreadCount;
  protected readonly notifications = this.inbox.notifications;

  protected readonly notificationsOpen = signal(false);

  /**
   * "٦ إشعارات غير مقروءة" when there are any, the plain name otherwise — the
   * whole meaning of the control in the one place a screen reader reads.
   */
  protected readonly bellLabel = computed(() =>
    this.unreadCount() > 0
      ? this.i18n.t('topbar.unread', { count: this.unreadCount() })
      : this.i18n.t('topbar.notifications'),
  );

  protected toggleNotifications(): void {
    this.notificationsOpen.update((open) => !open);
    if (this.notificationsOpen()) this.inbox.load().subscribe({ error: () => undefined });
  }

  protected closeNotifications(): void {
    this.notificationsOpen.set(false);
  }

  protected markAllRead(): void {
    this.inbox.markAllRead().subscribe({ error: () => undefined });
  }
}
