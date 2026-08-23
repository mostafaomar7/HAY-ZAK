import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import type { ActivatedRouteSnapshot } from '@angular/router';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import { LanguageService } from '@core/i18n/language.service';
import type { TranslationKey } from '@core/i18n/translations';
import { AuthService } from '@core/services/auth.service';
import { LoadingService } from '@core/services/loading.service';
import { AdminSessionService } from '@features/admin/services/admin-session.service';
import { AdminQueueCountsService } from '@features/admin/services/admin-queue-counts.service';
import { AdminSettingsStore } from '@features/admin/services/admin-settings.store';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiCountdown } from '@shared/components/ui-countdown/ui-countdown';
import { UiModal } from '@shared/components/ui-modal/ui-modal';
import { AdminSidebar } from './admin-sidebar/admin-sidebar';
import { AdminTopbar } from './admin-topbar/admin-topbar';

/**
 * The operations console frame: teal rail, sticky topbar, scrolling content.
 *
 * It also owns the two things that belong to the session rather than to any one
 * screen — the idle-timeout warning and the logout confirmation. Both are
 * dialogs, so a page underneath keeps its state while they are open.
 *
 * The queue counters feeding the sidebar badges are fetched once here rather
 * than by each queue page, so the badge and the table cannot disagree about how
 * much work is waiting.
 */
@Component({
  selector: 'app-admin-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminSessionService],
  imports: [RouterOutlet, AdminSidebar, AdminTopbar, UiButton, UiCountdown, UiModal],
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.scss',
})
export class AdminShell {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  protected readonly i18n = inject(LanguageService);
  protected readonly loading = inject(LoadingService);
  protected readonly session = inject(AdminSessionService);
  protected readonly queues = inject(AdminQueueCountsService);
  protected readonly settings = inject(AdminSettingsStore);

  protected readonly drawerOpen = signal(false);
  protected readonly logoutOpen = signal(false);

  private readonly titleKey = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.deepestTitleKey()),
    ),
    { initialValue: null },
  );

  protected readonly title = computed(() => {
    const key = this.titleKey();
    return key ? this.i18n.t(key) : this.i18n.t('adminNav.dashboard');
  });

  constructor() {
    // The console's two shared reads, once, on the way in.
    this.settings.load();
    this.queues.refresh();

    // Reaching the limit ends the session outright — the dialog is a courtesy,
    // not the enforcement.
    effect(() => {
      if (this.session.expired()) this.logout();
    });
  }

  protected openDrawer(): void {
    this.drawerOpen.set(true);
  }

  protected closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  protected askLogout(): void {
    this.logoutOpen.set(true);
  }

  /** The console has its own entrance, so it has its own exit (design §login). */
  protected logout(): void {
    this.logoutOpen.set(false);
    this.auth.logout(false);
    void this.router.navigateByUrl('/admin/login');
  }

  private deepestTitleKey(): TranslationKey | null {
    let route: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let key: TranslationKey | null = null;

    while (route) {
      const candidate = route.data['titleKey'] as TranslationKey | undefined;
      if (candidate) key = candidate;
      route = route.firstChild;
    }
    return key;
  }
}
