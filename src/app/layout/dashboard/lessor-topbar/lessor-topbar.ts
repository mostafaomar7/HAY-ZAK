import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import type { AppNotification } from '@core/models/operations.model';
import { LanguageService } from '@core/i18n/language.service';
import { ThemeService } from '@core/services/theme.service';
import { ClickOutsideDirective } from '@shared/directives/click-outside.directive';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiIcon } from '@shared/components/ui-icon/ui-icon';

/**
 * 72px topbar: page title, the gold "add a space" call to action, language
 * switch, notification bell with unread count, and the notifications dropdown.
 *
 * The bell and language controls are 40px visually but carry a 44px minimum
 * touch target, matching the design and NFR-USB-01.
 */
@Component({
  selector: 'app-lessor-topbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, ClickOutsideDirective, UiButton, UiIcon],
  // Escape closes the dropdown wherever focus currently sits — a keydown handler
  // on the wrapper would only fire while focus is inside it, and putting one on a
  // plain div is an accessibility smell in its own right.
  host: { '(document:keydown.escape)': 'closeNotifications()' },
  templateUrl: './lessor-topbar.html',
  styleUrl: './lessor-topbar.scss',
})
export class LessorTopbar {
  readonly title = input.required<string>();
  readonly unreadCount = input(0);
  /** The five most recent, per the design's dropdown. */
  readonly notifications = input<readonly AppNotification[]>([]);
  /** FR-LSR-03 — publishing is gated on verified mobile and bank details. */
  readonly canAddUnit = input(true);

  readonly openMenu = output<void>();
  readonly toggleLanguage = output<void>();
  readonly openNotification = output<AppNotification>();

  protected readonly theme = inject(ThemeService);
  protected readonly i18n = inject(LanguageService);
  protected readonly notificationsOpen = signal(false);

  protected toggleNotifications(): void {
    this.notificationsOpen.update((open) => !open);
  }

  protected closeNotifications(): void {
    this.notificationsOpen.set(false);
  }
}
