import type { Lang } from '@core/i18n/translations';

/**
 * Month labels for the report charts and tables.
 *
 * The API sends the first day of the month as an ISO date; both calendars are
 * derived from it here rather than sent as two strings, so a chart axis and the
 * table beneath it cannot disagree, and switching language relabels both without
 * another request.
 */
export function monthLabel(isoDate: string, lang: Lang): string {
  return new Intl.DateTimeFormat(locale(lang), { month: 'long', year: 'numeric' }).format(
    new Date(isoDate),
  );
}

/** The Umm al-Qura month, printed under the Gregorian one as the design does. */
export function hijri(isoDate: string, lang: Lang): string {
  return new Intl.DateTimeFormat(`${locale(lang)}-u-ca-islamic-umalqura`, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(isoDate));
}

function locale(lang: Lang): string {
  return lang === 'en' ? 'en-GB' : 'ar-SA';
}
