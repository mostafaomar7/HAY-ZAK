import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { PermissionService } from '@core/services/permission.service';
import { ADMIN_NAV } from '../admin-nav-items';

/** The pending-work counters the sidebar badges read from. */
export interface AdminBadgeCounts {
  listings: number;
  complaints: number;
}

/**
 * The 240px teal rail. Groups whose every item is hidden by permission drop out
 * with their heading, so the finance officer is not shown an empty divider.
 */
@Component({
  selector: 'app-admin-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './admin-sidebar.html',
  styleUrl: './admin-sidebar.scss',
})
export class AdminSidebar {
  private readonly permissions = inject(PermissionService);

  protected readonly i18n = inject(LanguageService);

  readonly counts = input<AdminBadgeCounts>({ listings: 0, complaints: 0 });

  /** Emitted when a link is followed, so the mobile drawer can close itself. */
  readonly navigate = output<void>();

  protected readonly groups = computed(() =>
    ADMIN_NAV.map((group) => ({
      titleKey: group.titleKey,
      items: group.items.filter((item) => this.permissions.can(item.permission)),
    })).filter((group) => group.items.length > 0),
  );

  protected badgeOf(key: 'listings' | 'complaints' | undefined): number {
    return key ? this.counts()[key] : 0;
  }
}
