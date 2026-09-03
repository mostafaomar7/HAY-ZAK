import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LanguageService } from '@core/i18n/language.service';
import type { NotificationType } from '@core/services/notification.service';
import { NotificationService } from '@core/services/notification.service';
import { UiIcon } from '../ui-icon/ui-icon';
import type { IconName } from '../ui-icon/ui-icon';

const ICONS: Record<NotificationType, IconName> = {
  success: 'check',
  error: 'warning',
  warning: 'warning',
  info: 'info',
};

/**
 * Where every "it worked" and "it did not" in the product is actually shown.
 *
 * `NotificationService` has always queued them and `errorInterceptor` has
 * always pushed one for every failed request — **and nothing rendered the
 * queue**. Twenty-three screens called `notifications.success(...)` after a
 * save, the server's own error message was pushed on every failure, and all of
 * it went into a signal no template read. An action reported neither outcome:
 * the button stopped spinning and that was the entire answer.
 *
 * Mounted once, in `App`, above the router outlet — so it survives every
 * navigation. A toaster inside a shell would unmount mid-redirect and drop the
 * message for the actions most worth confirming, which are exactly the ones
 * that navigate afterwards.
 *
 * **Announcement is split by severity.** Successes and hints go in a `polite`
 * region: they matter, but interrupting somebody mid-sentence to say a form
 * saved is worse than letting them finish. Errors go in an `assertive` one and
 * carry `role="alert"` — a screen reader user who is not told the save failed
 * will carry on as though it had. Two regions rather than one because
 * `aria-live` is read when the region is created, not when it changes.
 *
 * The container ignores the pointer and each toast takes it back, so the
 * bottom corner of the screen is not dead to clicks while a message is up.
 */
@Component({
  selector: 'app-ui-toaster',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, UiIcon],
  templateUrl: './ui-toaster.html',
  styleUrl: './ui-toaster.scss',
})
export class UiToaster {
  private readonly service = inject(NotificationService);

  protected readonly i18n = inject(LanguageService);

  protected readonly toasts = this.service.notifications;

  protected icon(type: NotificationType): IconName {
    return ICONS[type];
  }

  /** Errors interrupt; everything else waits its turn. */
  protected isUrgent(type: NotificationType): boolean {
    return type === 'error';
  }

  protected dismiss(id: number): void {
    this.service.dismiss(id);
  }
}
