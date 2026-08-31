import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Permission } from '@core/constants/permissions';
import { LanguageService } from '@core/i18n/language.service';
import type { AppNotification } from '@core/models/operations.model';
import { NotificationInboxService } from '@core/services/notification-inbox.service';
import { PermissionService } from '@core/services/permission.service';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiPager } from '@shared/components/ui-pager/ui-pager';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';

interface NotificationGroup {
  key: string;
  label: string;
  hijri: string;
  items: AppNotification[];
}

/**
 * The renter's notification inbox (RNT-10).
 *
 * Grouped by day, because the list is read as "what happened today" rather than
 * as an undifferentiated feed. The grouping is computed from `createdAt` and
 * labelled with today/yesterday where that applies, matching the design.
 */
@Component({
  selector: 'app-renter-notifications-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, RouterLink, UiButton, UiEmptyState, UiSkeleton, UiPager],
  templateUrl: './notifications-page.html',
  styleUrl: './notifications-page.scss',
})
export class RenterNotificationsPage {
  private readonly inbox = inject(NotificationInboxService);
  private readonly permissions = inject(PermissionService);

  protected readonly i18n = inject(LanguageService);

  /** Whether the empty state's "browse spaces" is this reader's next step. */
  protected readonly canBrowse = computed(() => this.permissions.can(Permission.CreateBooking));

  protected readonly isLoading = this.inbox.isLoading;
  protected readonly unreadCount = this.inbox.unreadCount;
  protected readonly total = this.inbox.total;
  protected readonly pageSize = this.inbox.pageSize;
  protected readonly page = this.inbox.page;
  protected readonly shown = computed(() => this.inbox.notifications().length);

  protected readonly groups = computed<NotificationGroup[]>(() => {
    const byDay = new Map<string, AppNotification[]>();

    for (const item of this.inbox.notifications()) {
      const key = item.createdAt.slice(0, 10);
      byDay.set(key, [...(byDay.get(key) ?? []), item]);
    }

    return [...byDay.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, items]) => ({
        key,
        label: this.dayLabel(key),
        hijri: this.hijri(key),
        items,
      }));
  });

  constructor() {
    this.load();
  }

  protected onPage(page: number): void {
    this.load(page);
    // The groups are tall; paging without this leaves the reader at the bottom
    // of a list they have not seen the top of.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private load(page = 1): void {
    // Everything, read and unread: this screen is the history. The bell's
    // dropdown is the one that narrows to what still needs somebody.
    this.inbox.load({ page }).subscribe({ error: () => undefined });
  }

  protected markAllRead(): void {
    this.inbox.markAllRead();
  }

  protected open(item: AppNotification): void {
    if (!item.isRead) this.inbox.markRead(item.id);
  }

  private locale(): string {
    return this.i18n.language() === 'en' ? 'en-GB' : 'ar-SA';
  }

  private dayLabel(iso: string): string {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const formatted = new Intl.DateTimeFormat(this.locale(), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(iso));

    if (iso === toKey(today)) return `${this.i18n.t('common.day')} — ${formatted}`;
    if (iso === toKey(yesterday)) return formatted;
    return formatted;
  }

  private hijri(iso: string): string {
    try {
      return new Intl.DateTimeFormat(`${this.locale()}-u-ca-islamic-umalqura`, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(iso));
    } catch {
      return '';
    }
  }
}

function toKey(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}
