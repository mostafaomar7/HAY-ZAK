import {
  fromHijriParts,
  hijriMonthLength,
  hijriMonthName,
  hijriSupported,
  hijriToday,
  toHijriParts,
} from './hijri.utils';

describe('hijri.utils', () => {
  it('has the Umm al-Qura table in this browser', () => {
    expect(hijriSupported()).toBeTrue();
  });

  it('round-trips every day of a year without drifting', () => {
    // The estimate-then-scan is the part that could silently be off by one, and
    // one wrong day here is a booking that starts on the wrong date.
    const start = Date.UTC(2026, 0, 1);
    for (let day = 0; day < 365; day++) {
      const iso = new Date(start + day * 86_400_000).toISOString().slice(0, 10);
      const parts = toHijriParts(iso);
      expect(parts).withContext(iso).toBeTruthy();
      expect(fromHijriParts(parts!)).withContext(iso).toBe(iso);
    }
  });

  it('refuses a day the calendar does not have', () => {
    // Ramadan 1448 is twenty-nine days. A 30th has to come back null rather
    // than roll forward into Shawwal.
    expect(hijriMonthLength(1448, 9)).toBe(29);
    expect(fromHijriParts({ year: 1448, month: 9, day: 30 })).toBeNull();
  });

  it('rejects out-of-range parts instead of guessing', () => {
    expect(fromHijriParts({ year: 1448, month: 13, day: 1 })).toBeNull();
    expect(fromHijriParts({ year: 1448, month: 0, day: 1 })).toBeNull();
    expect(fromHijriParts({ year: 1448, month: 1, day: 31 })).toBeNull();
    expect(fromHijriParts({ year: 1448, month: 1, day: 0 })).toBeNull();
  });

  it('reads only a plain date, not an instant', () => {
    expect(toHijriParts('2026-08-30')).toBeTruthy();
    expect(toHijriParts('2026-08-30T00:00:00Z')).toBeNull();
    expect(toHijriParts('')).toBeNull();
  });

  it('gives every month a name in both languages', () => {
    expect(hijriMonthName(1, 'ar')).toBe('محرم');
    expect(hijriMonthName(9, 'ar')).toBe('رمضان');
    expect(hijriMonthName(9, 'en')).toBe('Ramadan');
    expect(hijriMonthName(13, 'ar')).toBe('');
  });

  it('knows today', () => {
    const today = hijriToday();
    expect(today).toBeTruthy();
    expect(today!.year).toBeGreaterThan(1400);
    expect(today!.month).toBeGreaterThanOrEqual(1);
    expect(today!.month).toBeLessThanOrEqual(12);
  });
});
