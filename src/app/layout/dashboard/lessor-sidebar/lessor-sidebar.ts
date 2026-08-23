import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LESSOR_NAV } from '../nav-items';
import { LanguageService } from '@core/i18n/language.service';
import { PermissionService } from '@core/services/permission.service';
import { UiIcon } from '@shared/components/ui-icon/ui-icon';

/**
 * Teal sidebar, 240px. Items are filtered by permission so a role that cannot
 * reach a route never sees a link to it.
 *
 * The active item's rounded corners are mirrored automatically: the design pins
 * it to the inline-start edge, expressed with logical properties so switching to
 * English LTR needs no override.
 */
@Component({
  selector: 'app-lessor-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, UiIcon],
  templateUrl: './lessor-sidebar.html',
  styleUrl: './lessor-sidebar.scss',
})
export class LessorSidebar {
  private readonly permissions = inject(PermissionService);

  protected readonly i18n = inject(LanguageService);

  /** Emitted when a link is followed, so the mobile drawer can close itself. */
  readonly navigate = output<void>();

  protected readonly items = computed(() =>
    LESSOR_NAV.filter((item) => this.permissions.can(item.permission)),
  );
}
