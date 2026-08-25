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
   * Marks one as read.
   *
   * **The API has no endpoint for this yet** — `/me/notifications/:id/read` and
   * `/read-all` both answer 404, so a notification's `readAt` is set by nothing
   * and the badge cannot be cleared. Raised with the backend.
   *
   * Until it exists this is local only: the row dims and the badge drops for
   * this session, and both come back on reload. That is the honest behaviour —
   * pretending to persist it would be worse than visibly not persisting it.
   */
  markRead(id: string): void {
    this.items.update((list) =>
      list.map((n) => (n.id === id ? { ...n, isRead: true, readAt: n.readAt ?? null } : n)),
    );
    this.unread.update((count) => Math.max(0, count - 1));
  }

  markAllRead(): void {
    this.items.update((list) => list.map((n) => ({ ...n, isRead: true })));
    this.unread.set(0);
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
