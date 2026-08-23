import { Injectable, computed, inject, signal } from '@angular/core';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { API_ENDPOINTS } from '../constants/api-endpoints';
import type { AppNotification } from '../models/operations.model';
import { ApiService } from './api.service';

/**
 * The in-app notification inbox (FR-NTF).
 *
 * Distinct from NotificationService, which is the transient toast queue — this
 * one is server-backed and persistent. Kept in core because the topbar badge and
 * the notifications page read the same list.
 */
@Injectable({ providedIn: 'root' })
export class NotificationInboxService {
  private readonly api = inject(ApiService);

  private readonly items = signal<AppNotification[]>([]);
  private readonly loading = signal(false);

  readonly notifications = this.items.asReadonly();
  readonly isLoading = this.loading.asReadonly();
  readonly unreadCount = computed(() => this.items().filter((n) => !n.isRead).length);

  load(): Observable<AppNotification[]> {
    this.loading.set(true);
    return this.api.get<AppNotification[]>(API_ENDPOINTS.notifications.base).pipe(
      tap({
        next: (list) => {
          this.items.set(list);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      }),
    );
  }

  markRead(id: string): Observable<void> {
    // Optimistic: the badge should drop the moment the row is opened.
    this.patch(id, true);
    return this.api.post<void>(API_ENDPOINTS.notifications.markRead(id));
  }

  markAllRead(): Observable<void> {
    this.items.update((list) => list.map((n) => ({ ...n, isRead: true })));
    return this.api.post<void>(API_ENDPOINTS.notifications.markAllRead);
  }

  private patch(id: string, isRead: boolean): void {
    this.items.update((list) => list.map((n) => (n.id === id ? { ...n, isRead } : n)));
  }
}
