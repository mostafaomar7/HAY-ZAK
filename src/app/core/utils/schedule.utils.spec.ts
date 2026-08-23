import type { VisitWindow, Weekday } from '../models/unit.model';
import {
  formatTimeRange,
  formatWeekdays,
  isValidWindow,
  summariseSchedule,
  uncoveredDays,
  weekdayName,
} from './schedule.utils';

const window = (days: Weekday[], from = '09:00', to = '21:00'): VisitWindow => ({ days, from, to });

describe('schedule utils', () => {
  describe('weekdayName', () => {
    it('names the days from Intl, in Arabic', () => {
      expect(weekdayName(0, 'ar-SA')).toContain('أحد');
      expect(weekdayName(6, 'ar-SA')).toContain('سبت');
    });

    it('follows the language rather than a second hard-coded table', () => {
      expect(weekdayName(0, 'en-GB')).toBe('Sunday');
      expect(weekdayName(5, 'en-GB')).toBe('Friday');
    });
  });

  describe('formatWeekdays', () => {
    it('collapses a run of three or more into a range', () => {
      // The design's own grouping: الأحد — الخميس.
      const label = formatWeekdays([0, 1, 2, 3, 4], 'ar-SA');

      expect(label).toContain('—');
      expect(label).toContain('أحد');
      expect(label).toContain('خميس');
    });

    it('names both days of a pair rather than ranging them', () => {
      // "Friday — Saturday" is no shorter than naming them, and reads worse.
      const label = formatWeekdays([5, 6], 'en-GB');

      expect(label).toBe('Friday and Saturday');
    });

    it('lists a non-contiguous set using the conjunction of the locale', () => {
      // en-GB, so no Oxford comma — the point of using ListFormat rather than
      // joining with a hard-coded separator.
      expect(formatWeekdays([0, 2, 4], 'en-GB')).toBe('Sunday, Tuesday and Thursday');
    });

    it('names a single day plainly', () => {
      expect(formatWeekdays([5], 'en-GB')).toBe('Friday');
    });

    it('sorts and de-duplicates whatever it is handed', () => {
      expect(formatWeekdays([4, 0, 4, 2] as Weekday[], 'en-GB')).toBe(
        'Sunday, Tuesday and Thursday',
      );
    });

    it('returns nothing for an empty set', () => {
      expect(formatWeekdays([], 'ar-SA')).toBe('');
    });
  });

  describe('formatTimeRange', () => {
    it('drops the leading zero the way the design writes it', () => {
      expect(formatTimeRange('09:00', '21:00')).toBe('9:00 — 21:00');
    });

    it('leaves a two-digit hour alone', () => {
      expect(formatTimeRange('16:00', '21:30')).toBe('16:00 — 21:30');
    });
  });

  describe('isValidWindow', () => {
    it('accepts a window with days and a close after the open', () => {
      expect(isValidWindow(window([0, 1]))).toBeTrue();
    });

    it('rejects a window with no days', () => {
      expect(isValidWindow(window([]))).toBeFalse();
    });

    it('rejects a close that is not after the open', () => {
      expect(isValidWindow(window([0], '21:00', '09:00'))).toBeFalse();
      expect(isValidWindow(window([0], '09:00', '09:00'))).toBeFalse();
    });

    it('compares zero-padded times lexically, which is why they are padded', () => {
      // "09:00" < "10:00" as strings as well as as times.
      expect(isValidWindow(window([0], '09:00', '10:00'))).toBeTrue();
    });
  });

  describe('uncoveredDays', () => {
    it('reports the days no window covers', () => {
      expect(uncoveredDays([window([0, 1, 2, 3, 4])])).toEqual([5, 6]);
    });

    it('reports nothing when the week is covered', () => {
      expect(uncoveredDays([window([0, 1, 2, 3, 4]), window([5, 6])])).toEqual([]);
    });

    it('reports the whole week for an empty schedule', () => {
      expect(uncoveredDays([])).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });
  });

  describe('summariseSchedule', () => {
    it('joins the windows into the one line the small places show', () => {
      const line = summariseSchedule(
        [window([0, 1, 2, 3, 4]), window([5], '16:00', '21:00')],
        'en-GB',
      );

      expect(line).toBe('Sunday — Thursday 9:00 — 21:00 · Friday 16:00 — 21:00');
    });
  });
});
