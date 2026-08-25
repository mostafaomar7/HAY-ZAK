import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { AppNotification } from '@core/models/operations.model';
import { NotificationInboxService } from '@core/services/notification-inbox.service';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiPager } from '@shared/components/ui-pager/ui-pager';

interface NotificationGroup {
  label: string;
  items: AppNotification[];
}

/**
 * LSR-10 — "الإشعارات".
 *
 * Grouped by recency ("اليوم / أمس / أقدم") the way the design does, because a
 * flat list of timestamps is hard to scan. Grouping is derived from createdAt
 * rather than sent by the API, so the boundaries stay correct in the user's own
 * timezone.
 */
@Component({
  selector: 'app-notifications-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiButton, UiEmptyState, UiPager],
  templateUrl: './notifications-page.html',
  styleUrl: './notifications-page.scss',
})
export class NotificationsPage {
  private readonly inbox = inject(NotificationInboxService);
  private readonly router = inject(Router);

  protected readonly isLoading = this.inbox.isLoading;
  protected readonly unreadCount = this.inbox.unreadCount;
  protected readonly total = this.inbox.total;
  protected readonly pageSize = this.inbox.pageSize;
  protected readonly page = this.inbox.page;
  protected readonly shown = computed(() => this.inbox.notifications().length);
  protected readonly failed = signal(false);

  protected readonly groups = computed<NotificationGroup[]>(() => {
    const buckets: NotificationGroup[] = [
      { label: 'اليوم', items: [] },
      { label: 'أمس', items: [] },
      { label: 'أقدم', items: [] },
    ];

    for (const item of this.inbox.notifications()) {
      buckets[bucketFor(item.createdAt)].items.push(item);
    }

    return buckets.filter((group) => group.items.length > 0);
  });

  protected readonly isEmpty = computed(() => this.inbox.notifications().length === 0);

  constructor() {
    this.fetch();
  }

  /** Time of day for today and yesterday, a date for anything older. */
  protected timeLabel(item: AppNotification): string {
    const date = new Date(item.createdAt);
    const options: Intl.DateTimeFormatOptions =
      bucketFor(item.createdAt) < 2
        ? { hour: 'numeric', minute: '2-digit' }
        : { day: 'numeric', month: 'long' };
    return new Intl.DateTimeFormat('ar-SA', options).format(date);
  }

  protected open(item: AppNotification): void {
    if (!item.isRead) this.inbox.markRead(item.id);
    if (item.targetUrl) void this.router.navigateByUrl(item.targetUrl);
  }

  protected markAllRead(): void {
    this.inbox.markAllRead();
  }

  protected fetch(page = this.page()): void {
    this.failed.set(false);
    this.inbox.load(page).subscribe({ error: () => this.failed.set(true) });
  }

  protected onPage(page: number): void {
    this.fetch(page);
    // The groups are tall; paging without this leaves the reader at the bottom
    // of a list they have not seen the top of.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/** 0 = today, 1 = yesterday, 2 = older. */
function bucketFor(iso: string): 0 | 1 | 2 {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / 86_400_000);

  if (days <= 0) return 0;
  if (days === 1) return 1;
  return 2;
}
