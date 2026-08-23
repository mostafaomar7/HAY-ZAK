import {
  BOOKING_TRANSITIONS,
  blocksAvailability,
  canTransition,
  contactDetailsReleased,
  isTerminal,
  nextStatuses,
} from './booking-transitions';
import { BookingStatus } from '../enums/booking-status.enum';
import { UserRole } from '../enums/user-role.enum';

describe('booking state machine (SRS section 6)', () => {
  it('walks the happy path draft to completed', () => {
    let status = BookingStatus.Draft;
    const path = [
      BookingStatus.AwaitingPayment,
      BookingStatus.PaidPendingApproval,
      BookingStatus.Approved,
      BookingStatus.Active,
      BookingStatus.Completed,
    ];

    for (const next of path) {
      expect(canTransition(status, next)).toBeTrue();
      status = next;
    }
    expect(isTerminal(status)).toBeTrue();
  });

  it('rejects any move out of a terminal state', () => {
    const terminals = [
      BookingStatus.Completed,
      BookingStatus.RejectedRefunded,
      BookingStatus.Cancelled,
      BookingStatus.Expired,
    ];
    terminals.forEach((status) => expect(nextStatuses(status)).toEqual([]));
  });

  it('refuses to skip approval: paid cannot jump straight to active', () => {
    expect(canTransition(BookingStatus.PaidPendingApproval, BookingStatus.Active)).toBeFalse();
  });

  it('lets only administration approve or reject a booking (FR-LSR-06)', () => {
    const from = BookingStatus.PaidPendingApproval;
    expect(canTransition(from, BookingStatus.Approved, UserRole.OperationsSupervisor)).toBeTrue();
    expect(canTransition(from, BookingStatus.Approved, UserRole.Lessor)).toBeFalse();
    expect(canTransition(from, BookingStatus.RejectedRefunded, UserRole.Lessor)).toBeFalse();
    expect(canTransition(from, BookingStatus.RejectedRefunded, UserRole.Renter)).toBeFalse();
  });

  it('does not let the renter cancel a booking that is already active', () => {
    expect(
      canTransition(BookingStatus.Active, BookingStatus.Cancelled, UserRole.Renter),
    ).toBeFalse();
  });

  it('holds the dates from the moment payment is pending until completion', () => {
    expect(blocksAvailability(BookingStatus.AwaitingPayment)).toBeTrue();
    expect(blocksAvailability(BookingStatus.PaidPendingApproval)).toBeTrue();
    expect(blocksAvailability(BookingStatus.Approved)).toBeTrue();
    expect(blocksAvailability(BookingStatus.Active)).toBeTrue();

    expect(blocksAvailability(BookingStatus.Expired)).toBeFalse();
    expect(blocksAvailability(BookingStatus.Cancelled)).toBeFalse();
    expect(blocksAvailability(BookingStatus.Completed)).toBeFalse();
  });

  it('withholds contact details until approval (FR-LSR-09)', () => {
    expect(contactDetailsReleased(BookingStatus.PaidPendingApproval)).toBeFalse();
    expect(contactDetailsReleased(BookingStatus.Draft)).toBeFalse();
    expect(contactDetailsReleased(BookingStatus.Approved)).toBeTrue();
  });

  it('declares no duplicate edges', () => {
    const keys = BOOKING_TRANSITIONS.map((t) => t.from + '->' + t.to);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
