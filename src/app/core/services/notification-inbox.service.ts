import { Injectable, computed, effect, inject, signal } from '@angular/core';
import type { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { API_ENDPOINTS } from '../constants/api-endpoints';
import { LanguageService } from '../i18n/language.service';
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
 * What the two read endpoints answer with.
 *
 * The fresh count comes back with the acknowledgement, so the badge is
 * corrected by the same response that did the work — no second request, and no
 * window where the two disagree. `read` is how many rows the call actually
 * changed; nothing here needs it, and the count is what does.
 */
interface MarkReadResult {
  read: number | boolean;
  unreadCount: number;
}

/** `GET /me/notifications` — the rows, the badge and the paging in one. */
interface WireInbox {
  items: WireNotification[];
  unreadCount: number;
  pagination?: Pagination;
}

/** What the list endpoint narrows by. */
export interface InboxQuery {
  page?: number;
  pageSize?: number;
  /** The bell's dropdown wants only what is still waiting. */
  unreadOnly?: boolean;
}

/**
 * The in-app notification inbox (FR-NTF).
 *
 * Distinct from `NotificationService`, which is the transient toast queue —
 * this one is server-backed and persistent. Kept in core because the topbar
 * badge and the notifications page read the same list.
 *
 * **The text is the server's and is never cached.** `title` and `body` come
 * back translated into the account's *stored* locale, not into whatever
 * `Accept-Language` says, so changing the language re-translates the whole
 * history — including notifications sent years ago. Anything held here would
 * be a snapshot in the old language sitting under a screen in the new one,
 * which is why a language change re-reads the list rather than re-rendering it.
 *
 * The bell shows only the in-app copy of an event. Each notification is stored
 * twice on the server — once for this and once for the SMS, so a failure in
 * one channel is not a failure in the other — and the endpoint filters to the
 * in-app row. A short, SMS-shaped duplicate turning up here is a server bug
 * worth reporting rather than something to de-duplicate on this side.
 */
@Injectable({ providedIn: 'root' })
export class NotificationInboxService {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(LanguageService);

  private readonly items = signal<AppNotification[]>([]);
  private readonly loading = signal(false);
  private readonly unread = signal(0);
  private readonly totalCount = signal(0);
  private readonly size = signal(DEFAULT_PAGE_SIZE);
  private readonly current = signal(1);
  private readonly onlyUnread = signal(false);

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

  constructor() {
    let previous = this.i18n.language();

    effect(() => {
      const lang = this.i18n.language();
      if (lang === previous) return;
      previous = lang;

      // The text was translated by the server when it was read. Re-render
      // would leave Arabic titles under an English page, so re-read — but
      // only if something is already loaded, so this never fires a request
      // for a visitor who has not opened the bell.
      if (this.items().length) {
        this.load({ page: this.current(), unreadOnly: this.onlyUnread() }).subscribe({
          error: () => undefined,
        });
      }
    });
  }

  load(query: InboxQuery = {}): Observable<AppNotification[]> {
    const page = query.page ?? 1;
    this.loading.set(true);
    this.current.set(page);
    this.onlyUnread.set(!!query.unreadOnly);

    return this.api
      .get<WireInbox>(API_ENDPOINTS.me.notifications, {
        params: {
          page,
          pageSize: query.pageSize,
          // Only ever sent as `true`: `unreadOnly=false` would be a filter
          // that reads as "the read ones", which is not what it does.
          unreadOnly: query.unreadOnly ? true : undefined,
        },
      })
      .pipe(
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
   * notification is the reading of it, and a badge that lingers while a
   * request is in flight reads as "it did not work".
   *
   * The badge then takes the number **out of the response**, which is
   * authoritative; the local decrement in between is an affordance and never
   * an answer. Two numbers for one fact disagree eventually, and the one on
   * the server is the one that is true — so a failure puts the count back
   * rather than leaving this side holding a figure it made up.
   *
   * Marking twice is a 200, not an error: a double-tap on a phone is not a
   * failure, and the guard below is to save the request, not to avoid one.
   */
  markRead(id: string): void {
    const alreadyRead = this.items().find((n) => n.id === id)?.isRead;
    if (alreadyRead) return;

    const previous = this.unread();
    this.patchRead(id);
    this.unread.update((count) => Math.max(0, count - 1));

    this.api.put<MarkReadResult>(API_ENDPOINTS.me.markNotificationRead(id)).subscribe({
      next: (result) => this.unread.set(result.unreadCount),
      // The count goes back. The row does not: the person has read it either
      // way, and re-bolding it would be arguing with them.
      error: () => this.unread.set(previous),
    });
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
      // Only a lessor is told anything about a unit — approved, rejected,
      // suspended, reinstated — so this is the owner's screen, not the public
      // listing.
      return `/lessor/units/${reference.id}`;
    case 'booking':
      return `/my-bookings/${reference.id}`;
    case 'complaint':
      return `/my-complaints/${reference.id}`;
    case 'payout':
      // There is no page for one payout on the lessor's side; the money that
      // reached them is read on the earnings screen, which is where the
      // transfer reference in the message body can be matched up.
      return '/lessor/earnings';
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
