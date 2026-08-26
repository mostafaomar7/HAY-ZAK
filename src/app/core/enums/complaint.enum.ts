/**
 * Complaints — the only exception path in the product (FR-ADM-08).
 *
 * There is no cancel button anywhere, no self-service refund, and no editing a
 * booking after payment. "I want to cancel", "the space was locked", "it was
 * nothing like the listing" — every one of them is a complaint, and an
 * administrator decides the outcome. That is why `ComplaintResolution` below
 * carries actions like cancelling a booking and suspending a listing: this
 * enum is not a status vocabulary, it is the set of things the platform can
 * actually do about a problem.
 */

/**
 * What the complaint is about, chosen by the person raising it.
 *
 * `CancellationRequest` is deliberately a category and not a button. Wanting
 * out of a booking is a thing to ask for, not a thing to do.
 */
export enum ComplaintCategory {
  CancellationRequest = 'CANCELLATION_REQUEST',
  SpaceNotAsDescribed = 'SPACE_NOT_AS_DESCRIBED',
  AccessProblem = 'ACCESS_PROBLEM',
  PaymentIssue = 'PAYMENT_ISSUE',
  PayoutIssue = 'PAYOUT_ISSUE',
  GoodsDamage = 'GOODS_DAMAGE',
  ProhibitedGoods = 'PROHIBITED_GOODS',
  Other = 'OTHER',
}

/**
 * ```
 * OPEN → IN_PROGRESS ⇄ AWAITING_USER → RESOLVED
 *                    ↘                → CLOSED
 * ```
 *
 * `AwaitingUser` returns to `InProgress` on its own the moment the user
 * replies — the server does it, and no screen should try to.
 */
export enum ComplaintStatus {
  /** Raised; nobody has answered yet. */
  Open = 'OPEN',
  InProgress = 'IN_PROGRESS',
  /** The team has replied and the ball is with the user. */
  AwaitingUser = 'AWAITING_USER',
  /** Settled by a decision — see `resolution`. */
  Resolved = 'RESOLVED',
  /** Ended without one: a duplicate, or the person withdrew it. */
  Closed = 'CLOSED',
}

/** Nothing leaves these two, and a second attempt at either is a 409. */
export const SETTLED_COMPLAINT_STATUSES: readonly ComplaintStatus[] = [
  ComplaintStatus.Resolved,
  ComplaintStatus.Closed,
] as const;

/**
 * What an administrator decided.
 *
 * `BookingCancelled` and `RefundAndCancel` are the only edges into a cancelled
 * booking in the entire system — neither party can walk one — which is why
 * they live here rather than on any screen either of them can reach.
 */
export enum ComplaintResolution {
  /** Talked through; nothing to change. */
  NoAction = 'NO_ACTION',
  /** Freeze the lessor's transfer while it is looked at. */
  PayoutHold = 'PAYOUT_HOLD',
  /** Cancel the booking and release its dates. */
  BookingCancelled = 'BOOKING_CANCELLED',
  UnitSuspended = 'UNIT_SUSPENDED',
  Refund = 'REFUND',
  RefundAndCancel = 'REFUND_AND_CANCEL',
}

/**
 * The two that move money, and therefore need `refunds:issue` on top of
 * `complaints:manage`.
 *
 * An operations supervisor may cancel a booking, suspend a listing and freeze
 * a transfer — and may not move a single halala. Screens read this list to
 * disable the option rather than let somebody fill in a refund form and meet a
 * 403 at the end of it.
 */
export const REFUNDING_RESOLUTIONS: readonly ComplaintResolution[] = [
  ComplaintResolution.Refund,
  ComplaintResolution.RefundAndCancel,
] as const;

export function isRefundingResolution(resolution: ComplaintResolution): boolean {
  return REFUNDING_RESOLUTIONS.includes(resolution);
}

/** How the money goes back. `ManualTransfer` requires a bank reference. */
export enum RefundMethod {
  Gateway = 'GATEWAY',
  ManualTransfer = 'MANUAL_TRANSFER',
}
