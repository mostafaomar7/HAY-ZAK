import { BookingStatus, TERMINAL_BOOKING_STATUSES } from '../enums/booking-status.enum';
import { UserRole } from '../enums/user-role.enum';

/** A single legal edge of the booking state machine (SRS §6, Figure 2). */
export interface BookingTransition {
  from: BookingStatus;
  to: BookingStatus;
  /** What causes it — matches the "Transition trigger" column of SRS §6. */
  trigger: string;
  /** Empty means the system performs it (timer, gateway webhook), not a person. */
  actors: readonly UserRole[];
}

/**
 * The complete transition table. Nothing outside this list is a legal move —
 * SRS §6 warns that any ambiguity here becomes a financial dispute, so the
 * table is the single source of truth for both the UI and the API contract.
 */
export const BOOKING_TRANSITIONS: readonly BookingTransition[] = [
  {
    from: BookingStatus.Draft,
    to: BookingStatus.AwaitingPayment,
    trigger: 'goods description entered + prohibited-items acknowledged',
    actors: [UserRole.Renter],
  },
  {
    from: BookingStatus.AwaitingPayment,
    to: BookingStatus.PaidPendingApproval,
    trigger: 'payment captured',
    actors: [UserRole.Renter],
  },
  {
    from: BookingStatus.AwaitingPayment,
    to: BookingStatus.Expired,
    trigger: '15-minute hold elapsed without payment',
    actors: [], // system timer
  },
  {
    from: BookingStatus.PaidPendingApproval,
    to: BookingStatus.Approved,
    trigger: 'administration approves within the SLA',
    actors: [UserRole.OperationsSupervisor, UserRole.SystemAdministrator],
  },
  {
    from: BookingStatus.PaidPendingApproval,
    to: BookingStatus.RejectedRefunded,
    trigger: 'administration rejects — full refund is automatic',
    actors: [UserRole.OperationsSupervisor, UserRole.SystemAdministrator],
  },
  {
    from: BookingStatus.Approved,
    to: BookingStatus.Active,
    trigger: 'start date reached',
    actors: [], // system scheduler
  },
  {
    from: BookingStatus.Approved,
    to: BookingStatus.Cancelled,
    trigger: 'renter cancels before start — refund policy applied',
    actors: [UserRole.Renter, UserRole.OperationsSupervisor],
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

/** Guard for any state-changing action, in the UI and mirrored server-side. */
export function canTransition(from: BookingStatus, to: BookingStatus, role?: UserRole): boolean {
  const edge = BOOKING_TRANSITIONS.find((t) => t.from === from && t.to === to);
  if (!edge) return false;
  if (!role) return true;
  return edge.actors.includes(role);
}

export function isTerminal(status: BookingStatus): boolean {
  return TERMINAL_BOOKING_STATUSES.includes(status);
}

/** The unit's dates are held against the marketplace in these states only. */
export function blocksAvailability(status: BookingStatus): boolean {
  return [
    BookingStatus.AwaitingPayment,
    BookingStatus.PaidPendingApproval,
    BookingStatus.Approved,
    BookingStatus.Active,
  ].includes(status);
}

/** FR-LSR-09 / §5: contact details are released on approval, never before. */
export function contactDetailsReleased(status: BookingStatus): boolean {
  return [BookingStatus.Approved, BookingStatus.Active, BookingStatus.Completed].includes(status);
}
