import {
  BOOKING_TRANSITIONS,
  blocksAvailability,
  canTransition,
  contactDetailsReleased,
  isHoldingDates,
  isTerminal,
  nextStatuses,
} from './booking-transitions';
import { BookingStatus } from '../enums/booking-status.enum';
import { Permission, ROLE_PERMISSIONS } from './permissions';
import { UserRole } from '../enums/user-role.enum';

describe('booking state machine', () => {
  it('walks the happy path draft to completed', () => {
    let status = BookingStatus.Draft;
    const path = [
      BookingStatus.AwaitingPayment,
      BookingStatus.Confirmed,
      BookingStatus.Active,
      BookingStatus.Completed,
    ];

    for (const next of path) {
      expect(canTransition(status, next)).withContext(`${status} -> ${next}`).toBeTrue();
      status = next;
    }
    expect(isTerminal(status)).toBeTrue();
  });

  it('rejects any move out of a terminal state', () => {
    const terminals = [BookingStatus.Completed, BookingStatus.Cancelled, BookingStatus.Expired];
    terminals.forEach((status) => expect(nextStatuses(status)).toEqual([]));
  });

  /**
   * Payment is the confirmation. There is no review step to skip, and no
   * approval anybody grants.
   */
  it('confirms a booking on payment, with nothing in between', () => {
    expect(canTransition(BookingStatus.AwaitingPayment, BookingStatus.Confirmed)).toBeTrue();
    expect(canTransition(BookingStatus.AwaitingPayment, BookingStatus.Active)).toBeFalse();
  });

  /**
   * The rule the whole lifecycle turns on: nobody cancels their own booking.
   * `CANCELLED` is reachable only by an administrator resolving a complaint.
   */
  it('lets nobody but administration cancel a booking', () => {
    for (const from of [BookingStatus.Confirmed, BookingStatus.Active]) {
      expect(canTransition(from, BookingStatus.Cancelled, ROLE_PERMISSIONS[UserRole.Renter]))
        .withContext(`renter from ${from}`)
        .toBeFalse();
      expect(canTransition(from, BookingStatus.Cancelled, ROLE_PERMISSIONS[UserRole.Lessor]))
        .withContext(`lessor from ${from}`)
        .toBeFalse();
      expect(canTransition(from, BookingStatus.Cancelled, [Permission.ManageComplaints]))
        .withContext(`operations from ${from}`)
        .toBeTrue();
    }
  });

  /**
   * The lessor has no verb in this machine at all — asserted against what the
   * role actually grants, so adding a lessor permission to an edge fails here
   * rather than quietly shipping an accept/reject button the API refuses.
   */
  it('gives the lessor no transition anywhere in the table', () => {
    const lessorGrants = new Set(ROLE_PERMISSIONS[UserRole.Lessor]);
    const lessorEdges = BOOKING_TRANSITIONS.filter((t) =>
      t.actors.some((permission) => lessorGrants.has(permission)),
    );
    expect(lessorEdges).toEqual([]);
  });

  it('holds the dates from the moment of the hold until completion', () => {
    expect(blocksAvailability(BookingStatus.AwaitingPayment)).toBeTrue();
    expect(blocksAvailability(BookingStatus.Confirmed)).toBeTrue();
    expect(blocksAvailability(BookingStatus.Active)).toBeTrue();

    expect(blocksAvailability(BookingStatus.Draft)).toBeFalse();
    expect(blocksAvailability(BookingStatus.Expired)).toBeFalse();
    expect(blocksAvailability(BookingStatus.Cancelled)).toBeFalse();
    expect(blocksAvailability(BookingStatus.Completed)).toBeFalse();
  });

  it('withholds contact details until the booking is confirmed', () => {
    expect(contactDetailsReleased(BookingStatus.Draft)).toBeFalse();
    expect(contactDetailsReleased(BookingStatus.AwaitingPayment)).toBeFalse();

    expect(contactDetailsReleased(BookingStatus.Confirmed)).toBeTrue();
    expect(contactDetailsReleased(BookingStatus.Active)).toBeTrue();
    expect(contactDetailsReleased(BookingStatus.Completed)).toBeTrue();
  });

  it('counts down only while the dates are held unpaid', () => {
    expect(isHoldingDates(BookingStatus.AwaitingPayment)).toBeTrue();

    for (const status of Object.values(BookingStatus)) {
      if (status === BookingStatus.AwaitingPayment) continue;
      expect(isHoldingDates(status)).withContext(status).toBeFalse();
    }
  });

  it('declares no duplicate edges', () => {
    const keys = BOOKING_TRANSITIONS.map((t) => t.from + '->' + t.to);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
