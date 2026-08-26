import { BookingStatus } from '@core/enums/booking-status.enum';
import type { RenterBooking } from '@core/models/renter-booking';
import { canRaiseComplaint, isAddressReleased } from './renter-bookings.service';

/**
 * The renter's own view: no commission, no net-to-lessor, and the contact
 * populated by the server only once the booking is confirmed. The rules below
 * derive the release from the *status* rather than from `contact`, which is
 * why this fixture can carry one in every state without breaking them — and
 * why it should.
 */
function booking(status: BookingStatus): RenterBooking {
  return {
    id: 'b',
    referenceNo: 'HZ-1',
    status,
    unit: { id: 'u', title: 'مستودع', addressLine: 'شارع العليا', city: null },
    startDate: '2026-08-12',
    endDate: '2026-09-11',
    nights: 30,
    price: {
      dailyPriceHalalas: 6000,
      subtotalHalalas: 180000,
      vatHalalas: 0,
      totalHalalas: 180000,
    },
    goodsDescription: 'أثاث منزلي مفكّك وكراتين',
    contact: { fullName: 'خالد', mobile: '+966500000002' },
    confirmedAt: null,
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
   * belongs on everything except a booking still waiting to be paid for —
   * which holds nothing yet to complain about.
   */
  describe('canRaiseComplaint', () => {
    for (const status of ALL) {
      const expected = status !== BookingStatus.AwaitingPayment;

      it(`${expected ? 'offers' : 'hides'} the complaint route in ${status}`, () => {
        expect(canRaiseComplaint(booking(status))).toBe(expected);
      });
    }
  });
});
