import { Injectable, effect, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { STORAGE_KEYS } from '../constants/storage-keys';
import { StorageService } from './storage.service';

export type Theme = 'light' | 'dark';

/** Toggles a `data-theme` attribute on <html>; SCSS reads it for tokens. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storage = inject(StorageService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly current = signal<Theme>(this.storage.get<Theme>(STORAGE_KEYS.theme) ?? 'light');

  readonly theme = this.current.asReadonly();

  constructor() {
    effect(() => {
      const theme = this.current();
      if (!this.isBrowser) return;
      document.documentElement.setAttribute('data-theme', theme);
      this.storage.set(STORAGE_KEYS.theme, theme);
    });
  }

  set(theme: Theme): void {
    this.current.set(theme);
  }

  toggle(): void {
    this.current.update((t) => (t === 'light' ? 'dark' : 'light'));
  }
}
