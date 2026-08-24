/**
 * The booking lifecycle, as the backend defines it.
 *
 * ```
 * DRAFT → AWAITING_PAYMENT → CONFIRMED → ACTIVE → COMPLETED
 *              │                 │
 *              ↓                 ↓
 *          EXPIRED           CANCELLED   (administration only, via a complaint)
 * ```
 *
 * Payment confirms the booking. There is no approval step between the two and
 * no rejection: an earlier draft of this client had `PaidPendingApproval`,
 * `Approved` and `RejectedRefunded`, which described a platform that took money
 * and then decided whether to honour it. It does not.
 *
 * `CANCELLED` is reachable only by an administrator resolving a complaint —
 * neither party can cancel a booking themselves. Every screen that shows a
 * booking offers "لديّ مشكلة" instead.
 */
export enum BookingStatus {
  Draft = 'DRAFT',
  AwaitingPayment = 'AWAITING_PAYMENT',
  Confirmed = 'CONFIRMED',
  Active = 'ACTIVE',
  Completed = 'COMPLETED',
  Expired = 'EXPIRED',
  Cancelled = 'CANCELLED',
}

/** No transition leaves these. */
export const TERMINAL_BOOKING_STATUSES: readonly BookingStatus[] = [
  BookingStatus.Completed,
  BookingStatus.Cancelled,
  BookingStatus.Expired,
] as const;
