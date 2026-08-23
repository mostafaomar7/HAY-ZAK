import { Injectable, signal } from '@angular/core';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: number;
  type: NotificationType;
  message: string;
  title?: string;
  durationMs: number;
}

/**
 * UI-library-agnostic toast queue. Render `notifications()` from whatever
 * toast component the project ends up using (Material, PrimeNG, custom).
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private nextId = 0;
  private readonly items = signal<Notification[]>([]);

  readonly notifications = this.items.asReadonly();

  success(message: string, title?: string): void {
    this.push('success', message, title);
  }

  error(message: string, title?: string): void {
    this.push('error', message, title, 6000);
  }

  warning(message: string, title?: string): void {
    this.push('warning', message, title);
  }

  info(message: string, title?: string): void {
    this.push('info', message, title);
  }

  dismiss(id: number): void {
    this.items.update((list) => list.filter((n) => n.id !== id));
  }

  clear(): void {
    this.items.set([]);
  }

  private push(type: NotificationType, message: string, title?: string, durationMs = 4000): void {
    const item: Notification = { id: ++this.nextId, type, message, title, durationMs };
    this.items.update((list) => [...list, item]);
    if (durationMs > 0) setTimeout(() => this.dismiss(item.id), durationMs);
  }
}
