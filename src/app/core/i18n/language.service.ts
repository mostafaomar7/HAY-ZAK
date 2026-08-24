import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { STORAGE_KEYS } from '../constants/storage-keys';
// Side-effect import: registers the locale data the date/number pipes need.
import './locales';
import { StorageService } from '../services/storage.service';
import { DICTIONARIES, type Lang, type TranslationKey } from './translations';

/**
 * Runtime language switching (FR-CMS-02).
 *
 * Arabic is the default and the document direction is RTL; English is a
 * functionally identical version, not an abridged one (SRS §2.5). Switching is
 * instant — no reload — because the whole UI reads `t()`, which depends on the
 * `language` signal.
 *
 * Build-time i18n (`@angular/localize`) was the alternative. It produces one
 * bundle per locale and cannot switch at runtime, which contradicts the
 * "persistent language switch in the header" the design and FR-CMS-02 require.
 *
 * OPEN: SRS §15 item 9 — whether English ships in Phase 1 is the client's call.
 * The machinery is here either way; dropping English later means deleting one
 * dictionary, not unpicking the app.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly storage = inject(StorageService);
  private readonly document = inject(DOCUMENT);

  private readonly current = signal<Lang>(this.storage.get<Lang>(STORAGE_KEYS.language) ?? 'ar');

  readonly language = this.current.asReadonly();
  readonly direction = computed<'rtl' | 'ltr'>(() => (this.current() === 'ar' ? 'rtl' : 'ltr'));
  readonly isRtl = computed(() => this.direction() === 'rtl');

  /** Label for the switch button — shows the code you are currently in. */
  readonly label = computed(() => (this.current() === 'ar' ? 'AR' : 'EN'));

  constructor() {
    effect(() => {
      const lang = this.current();
      const root = this.document.documentElement;

      // Both attributes matter: `dir` drives every logical property in the
      // stylesheets, `lang` drives font shaping, hyphenation and screen readers.
      root.setAttribute('lang', lang);
      root.setAttribute('dir', this.direction());
      this.storage.set(STORAGE_KEYS.language, lang);
    });
  }

  set(lang: Lang): void {
    this.current.set(lang);
  }

  toggle(): void {
    this.current.update((lang) => (lang === 'ar' ? 'en' : 'ar'));
  }

  /**
   * Look up a string in the active language.
   *
   * Reads the `language` signal, so any template calling it re-renders on a
   * switch without needing a subscription or an impure pipe.
   *
   * A missing key returns the key itself rather than an empty string — a visible
   * `dues.title` in the UI is a bug report; a blank space is a silent one.
   */
  t(key: TranslationKey, params?: Record<string, string | number>): string {
    const table = DICTIONARIES[this.current()];
    const value = table[key] ?? DICTIONARIES.ar[key] ?? key;

    if (!params) return value;

    return Object.entries(params).reduce(
      (text, [name, replacement]) => text.replaceAll(`{${name}}`, String(replacement)),
      value,
    );
  }
}
