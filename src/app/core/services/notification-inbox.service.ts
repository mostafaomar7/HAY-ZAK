import { Injectable, computed, inject, signal } from '@angular/core';
import type { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { API_ENDPOINTS } from '../constants/api-endpoints';
import type { Pagination } from '../models/api-response.model';
import type { AppNotification } from '../models/operations.model';
import { ApiService } from './api.service';

/** One notification exactly as the API sends it. */
interface WireNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  reference?: { type: string; id: string } | null;
  /** Null until it is read. There is no `isRead` on the wire. */
  readAt: string | null;
  createdAt: string;
}

/**
 * What the read endpoints answer with.
 *
 * The fresh count comes back with the acknowledgement, so the badge is
 * corrected by the same response that did the work — no second request, and no
 * window where the two disagree.
 */
interface MarkReadResult {
  unreadCount: number;
}

/** `GET /me/notifications` — the rows, the badge and the paging in one. */
interface WireInbox {
  items: WireNotification[];
  unreadCount: number;
  pagination?: Pagination;
}

/**
 * The in-app notification inbox (FR-NTF).
 *
 * Distinct from `NotificationService`, which is the transient toast queue —
 * this one is server-backed and persistent. Kept in core because the topbar
 * badge and the notifications page read the same list.
 */
@Injectable({ providedIn: 'root' })
export class NotificationInboxService {
  private readonly api = inject(ApiService);

  private readonly items = signal<AppNotification[]>([]);
  private readonly loading = signal(false);
  private readonly unread = signal(0);
  private readonly totalCount = signal(0);
  private readonly size = signal(DEFAULT_PAGE_SIZE);
  private readonly current = signal(1);

  readonly notifications = this.items.asReadonly();
  readonly isLoading = this.loading.asReadonly();

  /** How many the account has in total — a hundred-odd is normal, so it pages. */
  readonly total = this.totalCount.asReadonly();
  /** The size the server used, not the one asked for: it caps at fifty. */
  readonly pageSize = this.size.asReadonly();
  readonly page = this.current.asReadonly();

  /**
   * The server's count, not a count of the rows on screen.
   *
   * Counting the loaded page was wrong the moment the inbox paged: ninety-one
   * notifications with two unread among them would have shown a badge of
   * whatever happened to be in the first twelve. The API sends `unreadCount`
   * beside the rows for exactly this reason, which is also why there is no
   * separate count endpoint to poll — two responses could disagree.
   */
  readonly unreadCount = this.unread.asReadonly();

  readonly hasUnread = computed(() => this.unread() > 0);

  load(page = 1): Observable<AppNotification[]> {
    this.loading.set(true);
    this.current.set(page);

    return this.api.get<WireInbox>(API_ENDPOINTS.me.notifications, { params: { page } }).pipe(
      map((inbox) => {
        this.unread.set(inbox.unreadCount);
        this.totalCount.set(inbox.pagination?.total ?? inbox.items?.length ?? 0);
        this.size.set(inbox.pagination?.pageSize || DEFAULT_PAGE_SIZE);
        return (inbox.items ?? []).map(fromWire);
      }),
      tap({
        next: (list) => {
          this.items.set(list);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      }),
    );
  }

  /**
   * Marks one as read, on the server.
   *
   * The row dims immediately rather than after the round trip — opening a
   * notification is the reading of it, and a badge that lingers while a request
   * is in flight reads as "it did not work". The count then comes from the
   * response, which is authoritative and cheap: the endpoint returns the fresh
   * `unreadCount`, so nothing has to re-fetch to learn it.
   *
   * A failure rolls the count back. It does not roll the row back: the person
   * has read it either way, and re-bolding it would be arguing with them.
   */
  markRead(id: string): void {
    const alreadyRead = this.items().find((n) => n.id === id)?.isRead;
    if (alreadyRead) return;

    this.patchRead(id);
    this.unread.update((count) => Math.max(0, count - 1));

    this.api
      .put<MarkReadResult>(API_ENDPOINTS.me.markNotificationRead(id))
      .subscribe({ next: (result) => this.unread.set(result.unreadCount), error: () => undefined });
  }

  markAllRead(): void {
    const previous = this.unread();
    this.items.update((list) =>
      list.map((n) => ({ ...n, isRead: true, readAt: n.readAt ?? null })),
    );
    this.unread.set(0);

    this.api.put<MarkReadResult>(API_ENDPOINTS.me.markAllNotificationsRead).subscribe({
      next: (result) => this.unread.set(result.unreadCount),
      error: () => this.unread.set(previous),
    });
  }

  private patchRead(id: string): void {
    this.items.update((list) =>
      list.map((n) => (n.id === id ? { ...n, isRead: true, readAt: n.readAt ?? null } : n)),
    );
  }
}

/** What the endpoint pages by when it says nothing. */
const DEFAULT_PAGE_SIZE = 20;

/**
 * Where a notification points.
 *
 * The API sends what it is *about* — `{ type: 'unit', id }` — rather than a
 * URL, which is right: the routes are the client's business and a server that
 * held them would have to be redeployed to rename a screen.
 */
function targetUrlFor(reference: WireNotification['reference']): string | undefined {
  if (!reference) return undefined;

  switch (reference.type) {
    case 'unit':
      return `/lessor/units/${reference.id}`;
    case 'booking':
      return `/my-bookings/${reference.id}`;
    default:
      // An unknown kind gets no link rather than a guessed one: a notification
      // that does nothing when clicked beats one that opens the wrong screen.
      return undefined;
  }
}

function fromWire(notification: WireNotification): AppNotification {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    readAt: notification.readAt,
    isRead: !!notification.readAt,
    reference: notification.reference ?? undefined,
    targetUrl: targetUrlFor(notification.reference),
    createdAt: notification.createdAt,
  };
}
