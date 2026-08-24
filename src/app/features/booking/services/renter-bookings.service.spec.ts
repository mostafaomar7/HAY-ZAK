import { BookingStatus } from '@core/enums/booking-status.enum';
import type { Booking } from '@core/models/booking.model';
import { canCancelBooking, isAddressReleased } from './renter-bookings.service';

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
   * FR-UNT-11 and SRS §5 — the exact address is released by administration
   * approval and by nothing earlier. Asserted across every state rather than the
   * handful that happen to be allowed, so a state added later fails loudly here
   * instead of quietly leaking an address.
   */
  describe('isAddressReleased', () => {
    const released = [BookingStatus.Approved, BookingStatus.Active, BookingStatus.Completed];

    for (const status of ALL) {
      const expected = released.includes(status);

      it(`${expected ? 'releases' : 'withholds'} the address in ${status}`, () => {
        expect(isAddressReleased(booking(status))).toBe(expected);
      });
    }

    it('withholds it while payment is still pending review', () => {
      // The money has moved but the review has not happened — this is the case
      // the design calls out explicitly on the booking details screen.
      expect(isAddressReleased(booking(BookingStatus.PaidPendingApproval))).toBeFalse();
    });
  });

  /** FR-BKG-07 — a booking with no future has nothing to cancel. */
  describe('canCancelBooking', () => {
    const cancellable = [
      BookingStatus.AwaitingPayment,
      BookingStatus.PaidPendingApproval,
      BookingStatus.Approved,
      BookingStatus.Active,
    ];

    for (const status of ALL) {
      const expected = cancellable.includes(status);

      it(`${expected ? 'offers' : 'hides'} cancellation in ${status}`, () => {
        expect(canCancelBooking(booking(status))).toBe(expected);
      });
    }

    it('offers nothing on a draft, which holds no dates and no money', () => {
      expect(canCancelBooking(booking(BookingStatus.Draft))).toBeFalse();
    });
  });
});
