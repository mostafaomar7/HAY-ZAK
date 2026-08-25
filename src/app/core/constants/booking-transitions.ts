import { BookingStatus, TERMINAL_BOOKING_STATUSES } from '../enums/booking-status.enum';
import { Permission } from './permissions';

/** A single legal edge of the booking state machine. */
export interface BookingTransition {
  from: BookingStatus;
  to: BookingStatus;
  /** What causes it. */
  trigger: string;
  /**
   * What somebody must hold to perform it. Empty means the system does it
   * (timer, gateway webhook) and no person can.
   *
   * A permission rather than a role: the server issues administration
   * capabilities per account, so "who may cancel a booking" is answered by
   * `complaints:manage` and stays answered when a fourth kind of administrator
   * appears.
   */
  actors: readonly Permission[];
}

/**
 * The complete transition table. Nothing outside this list is a legal move.
 *
 * Two absences are the point of it:
 *
 * - **No lessor anywhere.** The lessor never approves or rejects a booking.
 *   Their screen is view-and-notify, and an accept/reject control on it would
 *   be an affordance the API refuses.
 * - **No renter-initiated cancellation.** `CANCELLED` has one edge and one
 *   actor: an administrator resolving a complaint. A "cancel" button would be
 *   a promise this platform does not make.
 */
export const BOOKING_TRANSITIONS: readonly BookingTransition[] = [
  {
    from: BookingStatus.Draft,
    to: BookingStatus.AwaitingPayment,
    trigger: 'goods description entered + prohibited-items acknowledged',
    actors: [Permission.CreateBooking],
  },
  {
    from: BookingStatus.AwaitingPayment,
    to: BookingStatus.Confirmed,
    trigger: 'payment captured',
    actors: [Permission.CreateBooking],
  },
  {
    from: BookingStatus.AwaitingPayment,
    to: BookingStatus.Expired,
    trigger: '15-minute hold elapsed without payment — the dates are released',
    actors: [], // system timer
  },
  {
    from: BookingStatus.Confirmed,
    to: BookingStatus.Active,
    trigger: 'start date reached',
    actors: [], // system scheduler
  },
  {
    from: BookingStatus.Confirmed,
    to: BookingStatus.Cancelled,
    trigger: 'administration resolves a complaint against the booking',
    actors: [Permission.ManageComplaints],
  },
  {
    from: BookingStatus.Active,
    to: BookingStatus.Cancelled,
    trigger: 'administration resolves a complaint against a running booking',
    actors: [Permission.ManageComplaints],
  },
  {
    from: BookingStatus.Active,
    to: BookingStatus.Completed,
    trigger: 'end date reached — unit released',
    actors: [], // system scheduler
  },
];

/** Every state the booking may legally move to next. */
export function nextStatuses(from: BookingStatus): BookingStatus[] {
  return BOOKING_TRANSITIONS.filter((t) => t.from === from).map((t) => t.to);
}

/**
 * Guard for any state-changing action, in the UI and mirrored server-side.
 *
 * Called with no permissions it answers only "is this edge legal at all",
 * which is what the lifecycle diagram and the status chips need. Pass what the
 * user holds — `PermissionService.permissions()` — to ask whether *they* may
 * perform it.
 */
export function canTransition(
  from: BookingStatus,
  to: BookingStatus,
  held?: Iterable<Permission>,
): boolean {
  const edge = BOOKING_TRANSITIONS.find((t) => t.from === from && t.to === to);
  if (!edge) return false;
  if (!held) return true;

  const granted = new Set(held);
  return edge.actors.some((permission) => granted.has(permission));
}

export function isTerminal(status: BookingStatus): boolean {
  return TERMINAL_BOOKING_STATUSES.includes(status);
}

/** The unit's dates are held against the marketplace in these states only. */
export function blocksAvailability(status: BookingStatus): boolean {
  return [BookingStatus.AwaitingPayment, BookingStatus.Confirmed, BookingStatus.Active].includes(
    status,
  );
}

/**
 * Contact details and the exact address are released on confirmation, never
 * before.
 *
 * Before a booking is paid for, the two parties have no reason to be able to
 * reach each other and every reason not to: a marketplace whose renters can
 * ring the owner before booking is a marketplace people transact around. No
 * screen may imply otherwise while the booking is a draft or awaiting payment.
 */
export function contactDetailsReleased(status: BookingStatus): boolean {
  return [BookingStatus.Confirmed, BookingStatus.Active, BookingStatus.Completed].includes(status);
}

/**
 * Whether the dates are held on a countdown the renter has to beat.
 *
 * The deadline is `Booking.expiresAt`, set by the server — see
 * `countdown.ts` for why a locally started timer is not an option.
 */
export function isHoldingDates(status: BookingStatus): boolean {
  return status === BookingStatus.AwaitingPayment;
}
