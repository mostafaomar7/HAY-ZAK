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
import { ROLE_DISPLAY, primaryRole, statusText } from '@core/constants/status-display';
import { AuthService } from '@core/services/auth.service';
import { RouterLink } from '@angular/router';
import { ClickOutsideDirective } from '@shared/directives/click-outside.directive';
import { UiIcon } from '@shared/components/ui-icon/ui-icon';

/**
 * The admin topbar: page title, a global search box, language switch, the
 * notification bell and the account menu.
 *
 * Search is an output rather than a route: what "بحث شامل" means differs per
 * screen, and a global box that always jumped to one results page would be
 * wrong on eleven of the fourteen.
 */
@Component({
  selector: 'app-admin-topbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ClickOutsideDirective, UiIcon],
  host: { '(document:keydown.escape)': 'closeAll()' },
  templateUrl: './admin-topbar.html',
  styleUrl: './admin-topbar.scss',
})
export class AdminTopbar {
  protected readonly i18n = inject(LanguageService);
  protected readonly auth = inject(AuthService);

  readonly title = input.required<string>();
  readonly unreadCount = input(0);

  readonly openMenu = output<void>();
  readonly searched = output<string>();
  readonly loggedOut = output<void>();

  protected readonly accountOpen = signal(false);

  protected readonly roleLabel = computed(() =>
    statusText(ROLE_DISPLAY[primaryRole(this.auth.roles())], this.i18n.language()),
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
