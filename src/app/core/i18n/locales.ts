import { registerLocaleData } from '@angular/common';
import localeArSa from '@angular/common/locales/ar-SA';
import localeEn from '@angular/common/locales/en';

/**
 * Registers the locale data the date and number pipes need.
 *
 * Imported for its side effect by LanguageService, so locale data travels with
 * the i18n system rather than with application bootstrap. Registering it only in
 * app.config meant any component rendered outside that bootstrap — every unit
 * test, for one — threw NG0701 the moment it formatted a date.
 *
 * `ar-SA` backs LOCALE_ID; the bare codes back the runtime switch, which passes
 * `i18n.language()` straight to DatePipe as its locale argument.
 */
registerLocaleData(localeArSa, 'ar-SA');
registerLocaleData(localeArSa, 'ar');
registerLocaleData(localeEn, 'en');
