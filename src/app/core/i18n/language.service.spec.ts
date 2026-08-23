import { TestBed } from '@angular/core/testing';
import { STORAGE_KEYS } from '@core/constants/storage-keys';
import { LanguageService } from './language.service';
import { DICTIONARIES } from './translations';

describe('LanguageService', () => {
  let service: LanguageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(LanguageService);
    TestBed.tick();
  });

  afterEach(() => localStorage.clear());

  it('starts in Arabic, right to left', () => {
    expect(service.language()).toBe('ar');
    expect(service.direction()).toBe('rtl');
    expect(service.isRtl()).toBeTrue();
  });

  it('flips the document lang and dir when switched', () => {
    service.toggle();
    TestBed.tick();

    const root = document.documentElement;
    expect(service.language()).toBe('en');
    expect(root.getAttribute('lang')).toBe('en');
    expect(root.getAttribute('dir')).toBe('ltr');

    service.toggle();
    TestBed.tick();
    expect(root.getAttribute('dir')).toBe('rtl');
  });

  it('translates into the active language', () => {
    expect(service.t('nav.earnings')).toBe('المستحقات');

    service.set('en');
    expect(service.t('nav.earnings')).toBe('Earnings');
  });

  it('substitutes parameters', () => {
    expect(service.t('units.count', { shown: 3, total: 7 })).toContain('3');
    expect(service.t('units.count', { shown: 3, total: 7 })).toContain('7');
  });

  it('falls back to Arabic rather than showing an empty string', () => {
    service.set('en');
    // Every key resolves to something non-empty even if English is incomplete.
    for (const key of Object.keys(DICTIONARIES.ar) as (keyof typeof DICTIONARIES.ar)[]) {
      expect(service.t(key)).withContext(key).toBeTruthy();
    }
  });

  it('remembers the choice across sessions', () => {
    service.set('en');
    TestBed.tick();

    expect(localStorage.getItem(STORAGE_KEYS.language)).toContain('en');
  });

  it('picks the right side of a bilingual reference record', () => {
    const item = { nameAr: 'مستودع', nameEn: 'Warehouse' };

    expect(service.pick(item)).toBe('مستودع');
    service.set('en');
    expect(service.pick(item)).toBe('Warehouse');
    expect(service.pick(null)).toBe('');
  });
});

describe('translation dictionaries', () => {
  // A key present in Arabic but missing from English silently falls back, which
  // is fine at runtime but hides gaps — this reports them as one list.
  it('covers every Arabic key in English', () => {
    const missing = Object.keys(DICTIONARIES.ar).filter((key) => !(key in DICTIONARIES.en));

    expect(missing)
      .withContext(`untranslated keys: ${missing.join(', ')}`)
      .toEqual([]);
  });
});
