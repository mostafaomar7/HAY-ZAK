import { Injectable, computed, signal } from '@angular/core';

/**
 * Reference-counted global loading flag, driven by the loading interceptor.
 * Counting (rather than a boolean) keeps concurrent requests from turning the
 * spinner off early.
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly pending = signal(0);

  readonly isLoading = computed(() => this.pending() > 0);

  start(): void {
    this.pending.update((n) => n + 1);
  }

  stop(): void {
    this.pending.update((n) => Math.max(0, n - 1));
  }

  reset(): void {
    this.pending.set(0);
  }
}
