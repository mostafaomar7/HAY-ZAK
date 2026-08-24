import { BookingStatus } from '@core/enums/booking-status.enum';
import type { Booking } from '@core/models/booking.model';
import { canRaiseComplaint, isAddressReleased } from './renter-bookings.service';

function booking(status: BookingStatus): Booking {
  return {
    id: 'b',
    referenceNo: 'HZ-1',
    unitId: 'u',
    renterId: 'r',
    startDate: '2026-08-12',
    endDate: '2026-09-11',
    daysCount: 30,
    dailyPriceSnapshotHalalas: 6000,
    subtotalHalalas: 180000,
    commissionHalalas: 9000,
    vatHalalas: 1350,
    totalHalalas: 180000,
    goodsDescription: 'أثاث',
    prohibitedAck: true,
    status,
    createdAt: '2026-08-12T09:00:00Z',
  };
}

const ALL = Object.values(BookingStatus);

describe('renter booking rules', () => {
  /**
   * The exact address and the counterparty's details are released by
   * confirmation and by nothing earlier — before a booking is paid for, the
   * two parties have no reason to be able to reach each other.
   *
   * Asserted across every state rather than the handful that happen to be
   * allowed, so a state added later fails loudly here instead of quietly
   * leaking an address.
   */
  describe('isAddressReleased', () => {
    const released = [BookingStatus.Confirmed, BookingStatus.Active, BookingStatus.Completed];

    for (const status of ALL) {
      const expected = released.includes(status);

      it(`${expected ? 'releases' : 'withholds'} the address in ${status}`, () => {
        expect(isAddressReleased(booking(status))).toBe(expected);
      });
    }

    it('withholds it while the dates are only held', () => {
      // AWAITING_PAYMENT is a fifteen-minute hold, not a booking. Releasing the
      // address here would let anyone read it by starting a booking they never
      // pay for.
      expect(isAddressReleased(booking(BookingStatus.AwaitingPayment))).toBeFalse();
    });
  });

  /**
   * There is no cancellation on this platform, so there is no
   * `canCancelBooking` to test. "لديّ مشكلة" is what replaced it, and it
   * belongs on everything except a draft.
   */
  describe('canRaiseComplaint', () => {
    for (const status of ALL) {
      const expected = status !== BookingStatus.Draft;

      it(`${expected ? 'offers' : 'hides'} the complaint route in ${status}`, () => {
        expect(canRaiseComplaint(booking(status))).toBe(expected);
      });
    }
  });
});
