import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Thin typed wrapper over localStorage / sessionStorage that never throws —
 * private-mode browsers and non-browser platforms degrade to no-ops.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  get<T>(key: string, session = false): T | null {
    if (!this.isBrowser) return null;
    try {
      const raw = this.store(session).getItem(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  }

  set<T>(key: string, value: T, session = false): void {
    if (!this.isBrowser) return;
    try {
      this.store(session).setItem(key, JSON.stringify(value));
    } catch {
      /* quota exceeded or storage disabled */
    }
  }

  remove(key: string, session = false): void {
    if (!this.isBrowser) return;
    this.store(session).removeItem(key);
  }

  clear(session = false): void {
    if (!this.isBrowser) return;
    this.store(session).clear();
  }

  private store(session: boolean): Storage {
    return session ? sessionStorage : localStorage;
  }
}
