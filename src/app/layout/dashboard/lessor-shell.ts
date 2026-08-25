import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import type { ActivatedRouteSnapshot } from '@angular/router';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import { LessorSidebar } from './lessor-sidebar/lessor-sidebar';
import { LessorTopbar } from './lessor-topbar/lessor-topbar';
import { LoadingService } from '@core/services/loading.service';
import { LanguageService } from '@core/i18n/language.service';
import type { TranslationKey } from '@core/i18n/translations';
import { NotificationInboxService } from '@core/services/notification-inbox.service';
import type { AppNotification } from '@core/models/operations.model';

/**
 * The lessor portal frame: fixed sidebar plus scrolling content on desktop, and
 * an off-canvas drawer below the `lg` breakpoint.
 *
 * The page title comes from route data rather than from each page setting it,
 * so the topbar and the browser history stay in step. Add
 * `data: { title: '...' }` to a lessor route and it appears here.
 */
@Component({
  selector: 'app-lessor-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, LessorSidebar, LessorTopbar],
  templateUrl: './lessor-shell.html',
  styleUrl: './lessor-shell.scss',
})
export class LessorShell {
  protected readonly loading = inject(LoadingService);
  private readonly inbox = inject(NotificationInboxService);

  protected readonly i18n = inject(LanguageService);

  private readonly router = inject(Router);

  protected readonly drawerOpen = signal(false);

  /**
   * Read from the deepest activated child's `data.title` on every navigation, so
   * a page never has to reach up into the shell to set its own heading.
   */
  private readonly titleKey = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.deepestTitleKey()),
    ),
    { initialValue: null },
  );

  /**
   * Resolved from the key on every render, so a language switch retitles the
   * page without waiting for the next navigation.
   */
  protected readonly title = computed(() => {
    const key = this.titleKey();
    return key ? this.i18n.t(key) : this.i18n.t('nav.dashboard');
  });

  protected readonly unreadCount = this.inbox.unreadCount;

  /** The dropdown shows the five most recent, as in the design. */
  protected readonly recentNotifications = computed(() => this.inbox.notifications().slice(0, 5));

  constructor() {
    // The topbar badge and dropdown both read this list, so the shell loads it
    // once rather than each screen fetching its own copy.
    this.inbox.load().subscribe({ error: () => undefined });
  }

  /** Opening a notification marks it read, so the badge drops immediately. */
  protected onOpenNotification(item: AppNotification): void {
    if (!item.isRead) this.inbox.markRead(item.id);
  }

  protected openDrawer(): void {
    this.drawerOpen.set(true);
  }

  protected closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  /**
   * Walks the snapshot tree, deepest `data.title` wins.
   *
   * Snapshots throughout, deliberately: reading `ActivatedRoute.snapshot` while
   * a child is mid-activation throws, which happens on the very first render
   * because `startWith` evaluates this before any NavigationEnd has fired.
   */
  /** Deepest `data.titleKey` on the activated path, or null if none declares one. */
  private deepestTitleKey(): TranslationKey | null {
    let node: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let key: TranslationKey | undefined;

    while (node) {
      key = (node.data?.['titleKey'] as TranslationKey | undefined) ?? key;
      node = node.firstChild;
    }
    return key ?? null;
  }
}
