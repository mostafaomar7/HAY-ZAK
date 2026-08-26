import { AvailabilityBlockReason, UnitStatus } from '../enums/unit-status.enum';
import type { WireUnit } from './unit-wire';
import {
  clockToMinutes,
  minutesToClock,
  blockFromWire,
  scheduleFromWire,
  scheduleToWire,
  unitFromWire,
  unitToWire,
} from './unit-wire';

function wire(overrides: Partial<WireUnit> = {}): WireUnit {
  return {
    id: 'u-1',
    title: 'مستودع مكيّف',
    description: 'وصف',
    areaSqm: 35,
    dailyPriceHalalas: 7500,
    categoryId: 'c-1',
    cityId: 'city-1',
    districtId: null,
    addressLine: 'شارع أنس بن مالك',
    visitHoursFrom: 540,
    visitHoursTo: 1260,
    minDays: 3,
    maxDays: 180,
    status: UnitStatus.Published,
    publishedAt: null,
    rejectionReason: null,
    reviewedAt: null,
    createdAt: '2026-08-05T09:00:00Z',
    updatedAt: '2026-08-05T09:00:00Z',
    ...overrides,
  };
}

describe('unit wire conversion', () => {
  describe('dates', () => {
    /**
     * The server sends plain `YYYY-MM-DD` and refuses an instant on the way in,
     * so the block's dates are carried through untouched. They used to arrive
     * as UTC instants and were sliced back to a date here, because reading one
     * through `new Date()` gives the previous day anywhere west of Greenwich —
     * a bug that passes every test run in Riyadh and fails in production
     * abroad. This asserts nothing reintroduces a conversion.
     */
    it('carries the block dates through exactly as sent', () => {
      const block = blockFromWire({
        id: 'blk-1',
        startDate: '2027-03-01',
        endDate: '2027-03-05',
        reason: AvailabilityBlockReason.ManualBlock,
        note: null,
      });

      expect(block.startDate).toBe('2027-03-01');
      expect(block.endDate).toBe('2027-03-05');
    });
  });

  describe('visiting hours', () => {
    it('reads minutes since midnight as a clock time', () => {
      expect(minutesToClock(540)).toBe('09:00');
      expect(minutesToClock(1260)).toBe('21:00');
      expect(minutesToClock(0)).toBe('00:00');
      expect(minutesToClock(605)).toBe('10:05');
    });

    it('round-trips a clock time', () => {
      for (const clock of ['00:00', '09:00', '10:05', '21:00', '23:59']) {
        expect(minutesToClock(clockToMinutes(clock)))
          .withContext(clock)
          .toBe(clock);
      }
    });

    it('presents the single stored window as covering every day', () => {
      const schedule = scheduleFromWire(540, 1260);

      expect(schedule.length).toBe(1);
      expect(schedule[0].days).toEqual([0, 1, 2, 3, 4, 5, 6]);
      expect(schedule[0].from).toBe('09:00');
    });

    it('has no schedule at all when the server stored no hours', () => {
      expect(scheduleFromWire(null, null)).toEqual([]);
    });

    /**
     * The reduction is lossy and errs outwards on purpose: narrowing to the
     * intersection would close hours the lessor said were open, which turns a
     * visitor away at a door that is unlocked.
     */
    it('sends the widest window several rows describe', () => {
      const sent = scheduleToWire([
        { days: [0, 1, 2, 3, 4], from: '09:00', to: '21:00' },
        { days: [6], from: '08:00', to: '20:00' },
      ]);

      expect(sent).toEqual({ visitHoursFrom: 480, visitHoursTo: 1260 });
    });

    it('sends no hours rather than zeroes when the schedule is empty', () => {
      expect(scheduleToWire([])).toEqual({});
    });
  });

  describe('units', () => {
    it('reads the schedule, the status and the price straight through', () => {
      const unit = unitFromWire(wire());

      expect(unit.status).toBe(UnitStatus.Published);
      expect(unit.dailyPriceHalalas).toBe(7500);
      expect(unit.visitSchedule[0].from).toBe('09:00');
    });

    /**
     * FR-UNT-11 — the exact pin is released with the address. A list row that
     * carries neither must not claim to be showing the real location.
     */
    it('treats a unit with no address as approximately located', () => {
      expect(unitFromWire(wire({ addressLine: null })).isApproximateLocation).toBeTrue();
      expect(unitFromWire(wire()).isApproximateLocation).toBeFalse();
    });

    /**
     * A list row carries a cover and a count instead of the images. A card
     * reading `images[0]` would have shown nothing on every search result.
     */
    it('takes the cover from the list projection', () => {
      const unit = unitFromWire(wire({ coverUrl: '/uploads/units/u-1/a.jpg', imageCount: 3 }));

      expect(unit.coverUrl).toContain('/uploads/units/u-1/a.jpg');
      expect(unit.imageCount).toBe(3);
      expect(unit.images).toEqual([]);
    });

    it('falls back to the first image when the projection carries them', () => {
      const unit = unitFromWire(
        wire({
          images: [{ id: 'i-1', url: '/uploads/units/u-1/b.jpg', sizeBytes: 10, sortOrder: 0 }],
        }),
      );

      expect(unit.coverUrl).toBe(unit.images[0].url);
      expect(unit.imageCount).toBe(1);
    });

    /** `latitude`/`longitude` go in flat and come back nested as `location`. */
    it('flattens the pin on the way out', () => {
      const sent = unitToWire({
        title: 'م',
        location: { latitude: 24.7136, longitude: 46.6753 },
        visitSchedule: [],
      });

      expect(sent.latitude).toBe(24.7136);
      expect(sent.longitude).toBe(46.6753);
    });

    /**
     * The form saves a draft after step 1, long before the later steps are
     * filled in. Requiring a whole unit here would have meant the draft could
     * not be saved until the journey it exists to interrupt was finished.
     */
    it('sends a partial request without inventing the missing fields', () => {
      const sent = unitToWire({ title: 'مستودع', visitSchedule: [] });

      expect(sent.title).toBe('مستودع');
      expect(sent.categoryId).toBeUndefined();
      expect('visitHoursFrom' in sent).toBeFalse();
    });
  });
});
