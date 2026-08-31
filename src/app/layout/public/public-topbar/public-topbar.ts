import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { UserRole } from '@core/enums/user-role.enum';
import { LanguageService } from '@core/i18n/language.service';
import { AuthService } from '@core/services/auth.service';
import { ClickOutsideDirective } from '@shared/directives/click-outside.directive';
import { UiNotificationBell } from '@shared/components/ui-notification-bell/ui-notification-bell';
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
  imports: [
    RouterLink,
    RouterLinkActive,
    ClickOutsideDirective,
    UiButton,
    UiIcon,
    UiNotificationBell,
  ],
  templateUrl: './public-topbar.html',
  styleUrl: './public-topbar.scss',
})
export class PublicTopbar {
  private readonly auth = inject(AuthService);

  protected readonly i18n = inject(LanguageService);

  readonly toggleLanguage = output<void>();

  protected readonly isAuthenticated = this.auth.isAuthenticated;
  protected readonly user = this.auth.user;

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
}
