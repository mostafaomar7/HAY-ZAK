import { TestBed } from '@angular/core/testing';
import { STORAGE_KEYS } from '@core/constants/storage-keys';
import type { Unit } from '@core/models/unit.model';
import { UnitStatus } from '@core/enums/unit-status.enum';
import { BookingWizardService } from './booking-wizard.service';

const UNIT = {
  id: 'u-1',
  dailyPrice: 75,
  status: UnitStatus.Published,
} as Unit;

describe('BookingWizardService', () => {
  let wizard: BookingWizardService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [BookingWizardService] });
    wizard = TestBed.inject(BookingWizardService);
  });

  afterEach(() => sessionStorage.clear());

  it('starts with nothing', () => {
    expect(wizard.draft()).toBeNull();
    expect(wizard.hasDates()).toBeFalse();
    expect(wizard.hasGoods()).toBeFalse();
  });

  it('records the dates and derives the day count', () => {
    wizard.setDates('u-1', '2026-08-12', '2026-08-22');

    expect(wizard.hasDates()).toBeTrue();
    expect(wizard.draft()?.daysCount).toBe(10);
  });

  it('holds the goods and the acknowledgement together', () => {
    wizard.setDates('u-1', '2026-08-12', '2026-08-22');
    wizard.setGoods('أثاث منزلي مفكّك وصناديق كتب', true);

    expect(wizard.hasGoods()).toBeTrue();
  });

  it('does not treat a description without an acknowledgement as complete', () => {
    // FR-BKG-04 makes the acknowledgement mandatory; the flag must not be
    // inferred from the presence of a description.
    wizard.setDates('u-1', '2026-08-12', '2026-08-22');
    wizard.setGoods('أثاث منزلي', false);

    expect(wizard.hasGoods()).toBeFalse();
  });

  it('clears the goods when the renter switches to a different space', () => {
    wizard.setDates('u-1', '2026-08-12', '2026-08-22');
    wizard.setGoods('أثاث منزلي مفكّك', true);

    wizard.setDates('u-2', '2026-09-01', '2026-09-11');

    // A description written for one space must not be carried onto another.
    expect(wizard.draft()?.goodsDescription).toBe('');
    expect(wizard.draft()?.prohibitedAck).toBeFalse();
  });

  it('keeps the goods when the dates change on the same space', () => {
    wizard.setDates('u-1', '2026-08-12', '2026-08-22');
    wizard.setGoods('أثاث منزلي مفكّك', true);

    wizard.setDates('u-1', '2026-08-14', '2026-08-24');

    expect(wizard.draft()?.goodsDescription).toBe('أثاث منزلي مفكّك');
  });

  /** FR-BKG-05 — the hold the payment screen counts down. */
  it('reports the seconds left on the hold', () => {
    wizard.setDates('u-1', '2026-08-12', '2026-08-22');
    wizard.setHold(new Date(Date.now() + 120_000).toISOString());

    const remaining = wizard.holdSecondsRemaining();
    expect(remaining).toBeGreaterThan(110);
    expect(remaining).toBeLessThanOrEqual(120);
  });

  it('reports no hold before one has started', () => {
    wizard.setDates('u-1', '2026-08-12', '2026-08-22');

    expect(wizard.holdSecondsRemaining()).toBeNull();
  });

  it('floors an elapsed hold at zero rather than going negative', () => {
    wizard.setDates('u-1', '2026-08-12', '2026-08-22');
    wizard.setHold(new Date(Date.now() - 60_000).toISOString());

    expect(wizard.holdSecondsRemaining()).toBe(0);
  });

  /**
   * The design's "register mid-journey" exception: the renter leaves to create
   * an account and must come back to the same step with the same data.
   */
  it('survives a reload of the service through session storage', () => {
    wizard.setUnit(UNIT);
    wizard.setDates('u-1', '2026-08-12', '2026-08-22');
    wizard.setGoods('أثاث منزلي مفكّك', true);
    wizard.setBookingId('bk-1');

    // A fresh instance, as a second page load would build.
    const revived = TestBed.runInInjectionContext(() => new BookingWizardService());

    expect(revived.draft()?.bookingId).toBe('bk-1');
    expect(revived.draft()?.goodsDescription).toBe('أثاث منزلي مفكّك');
    expect(revived.hasDates()).toBeTrue();
  });

  it('forgets everything on clear', () => {
    wizard.setDates('u-1', '2026-08-12', '2026-08-22');
    wizard.clear();

    expect(wizard.draft()).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEYS.bookingDraft)).toBeNull();
  });
});
