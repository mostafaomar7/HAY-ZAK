import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { LanguageService } from '@core/i18n/language.service';
import { ROLE_DISPLAY, statusText } from '@core/constants/status-display';
import { AuthService } from '@core/services/auth.service';
import { RouterLink } from '@angular/router';
import { ClickOutsideDirective } from '@shared/directives/click-outside.directive';
import { UiIcon } from '@shared/components/ui-icon/ui-icon';
import { UiNotificationBell } from '@shared/components/ui-notification-bell/ui-notification-bell';

/**
 * The admin topbar: page title, language switch, the notification bell and the
 * account menu.
 *
 * **There is no global search, and there was never a working one.** The box
 * that used to sit here emitted a `searched` output no parent ever bound, so
 * every operator who typed into it and pressed Enter got nothing back and no
 * reason why. There is no endpoint behind it either: the API has no search
 * across units, bookings and users, and each console screen searches its own
 * list where its own endpoint supports it. A box that cannot answer is worse
 * than no box — it reads as a feature that is broken rather than one that does
 * not exist.
 */
@Component({
  selector: 'app-admin-topbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ClickOutsideDirective, UiIcon, UiNotificationBell],
  host: { '(document:keydown.escape)': 'closeAll()' },
  templateUrl: './admin-topbar.html',
  styleUrl: './admin-topbar.scss',
})
export class AdminTopbar {
  protected readonly i18n = inject(LanguageService);
  protected readonly auth = inject(AuthService);

  readonly title = input.required<string>();

  readonly openMenu = output<void>();
  readonly loggedOut = output<void>();

  protected readonly accountOpen = signal(false);

  protected readonly roleLabel = computed(() =>
    statusText(ROLE_DISPLAY[this.auth.role()], this.i18n.language()),
  );

  protected toggleAccount(): void {
    this.accountOpen.update((open) => !open);
  }

  protected closeAll(): void {
    this.accountOpen.set(false);
  }

  /** Two initials, so an avatar exists before any photo upload does. */
  protected initials(name: string): string {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join(' ');
  }
}
