import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { UserRole } from '@core/enums/user-role.enum';
import { LanguageService } from '@core/i18n/language.service';
import { AuthService } from '@core/services/auth.service';
import type { AppNotification } from '@core/models/operations.model';
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
   * Where "إضافة مساحتك الآن" goes, or nothing at all.
   *
   * One account holds one role (FR-AUTH-12), and `/auth/account-type` is behind
   * `guestGuard` — so a signed-in renter who pressed this was bounced straight
   * back to the page they were already on. It looked like a broken button
   * because it was one.
   *
   * A lessor gets the screen the words actually name. A renter and an
   * administrator get no button: they cannot list a space on this account, and
   * a control that leads nowhere is worse than an absent one.
   */
  protected readonly listSpaceUrl = computed(() => {
    if (!this.isAuthenticated()) return '/auth/account-type';
    return this.user()?.role === UserRole.Lessor ? '/lessor/units/new' : null;
  });

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
    // A short list, and only what is still waiting: the dropdown answers "what
    // needs me", and the full history is one link away at the bottom of it.
    if (this.notificationsOpen()) {
      this.inbox.load({ pageSize: 10, unreadOnly: true }).subscribe({ error: () => undefined });
    }
  }

  /**
   * Opening a notification is the reading of it.
   *
   * Marked here rather than on the destination screen, because a notification
   * with no `reference` goes nowhere and still has to stop counting — and
   * because the same tap should not have to be made twice.
   */
  protected openNotification(item: AppNotification): void {
    if (!item.isRead) this.inbox.markRead(item.id);
    this.closeNotifications();
  }

  protected closeNotifications(): void {
    this.notificationsOpen.set(false);
  }

  protected markAllRead(): void {
    this.inbox.markAllRead();
  }
}
