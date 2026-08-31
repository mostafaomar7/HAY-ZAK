import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import type { AppNotification } from '@core/models/operations.model';
import { NotificationInboxService } from '@core/services/notification-inbox.service';
import { ClickOutsideDirective } from '@shared/directives/click-outside.directive';
import { UiIcon } from '@shared/components/ui-icon/ui-icon';

/**
 * The notification bell and its dropdown, for every shell that has one.
 *
 * It lived in the public topbar and the lessor one, and the administration
 * console had an imitation of it: an icon linking to the dashboard, with a
 * badge counting **pending review work** rather than notifications. It looked
 * like a bell, it was labelled "الإشعارات", and it had never shown one — an
 * administrator whose account was mentioned in a notification had no way to
 * find out. Extracted here so the three shells share the real one and none of
 * them can drift into having its own.
 *
 * `unreadOnly` on open, deliberately. The bell answers "what still needs me",
 * and the full history is the inbox screen behind `allRoute`.
 */
@Component({
  selector: 'app-ui-notification-bell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ClickOutsideDirective, UiIcon],
  templateUrl: './ui-notification-bell.html',
  styleUrl: './ui-notification-bell.scss',
})
export class UiNotificationBell {
  private readonly inbox = inject(NotificationInboxService);

  protected readonly i18n = inject(LanguageService);

  /**
   * Where "عرض كل الإشعارات" goes. Omitted where no such screen exists yet —
   * the footer link is then not drawn, rather than pointing somewhere that
   * would take the reader out of the portal they are working in.
   */
  readonly allRoute = input<string>();

  protected readonly unreadCount = this.inbox.unreadCount;
  protected readonly notifications = this.inbox.notifications;
  protected readonly open = signal(false);

  /** The count rides on the label; the badge itself is `aria-hidden`. */
  protected readonly label = computed(() =>
    this.unreadCount() > 0
      ? this.i18n.t('topbar.unread', { count: this.unreadCount() })
      : this.i18n.t('topbar.notifications'),
  );

  protected toggle(): void {
    this.open.update((open) => !open);

    // Loaded on open rather than on every page: a bell that polls is a bell
    // that costs a request per screen for a number that rarely changes.
    if (this.open()) {
      this.inbox.load({ pageSize: 10, unreadOnly: true }).subscribe({ error: () => undefined });
    }
  }

  protected close(): void {
    this.open.set(false);
  }

  /**
   * Opening a notification is the reading of it.
   *
   * Marked here rather than on the destination screen, because a notification
   * about something with no screen behind it is still one the reader has seen.
   */
  protected openNotification(item: AppNotification): void {
    if (!item.isRead) this.inbox.markRead(item.id);
    this.close();
  }

  protected markAllRead(): void {
    this.inbox.markAllRead();
  }
}
