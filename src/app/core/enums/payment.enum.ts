/** FR-PAY-01. */
export enum PaymentMethod {
  Mada = 'Mada',
  CreditCard = 'CreditCard',
  ApplePay = 'ApplePay',
  Wallet = 'Wallet',
}

/** payments.status — authorize and capture are separate on purpose (SRS §6 note). */
export enum PaymentStatus {
  Initiated = 'Initiated',
  Authorized = 'Authorized',
  Captured = 'Captured',
  Failed = 'Failed',
  Voided = 'Voided',
}

/**
 * `payout.eligible_after` — when a booking's money may be approved for
 * transfer to the lessor. A policy, not a delay.
 *
 * The three are genuinely different rules rather than three durations: paying
 * out on payment means the money leaves before anybody has confirmed the space
 * exists, which is why the platform is set to the last of them.
 */
export enum PayoutEligibility {
  OnPayment = 'on_payment',
  OnBookingStart = 'on_booking_start',
  AfterBookingStart24h = 'after_booking_start_24h',
}

export enum RefundStatus {
  Pending = 'Pending',
  Processing = 'Processing',
  Completed = 'Completed',
  Failed = 'Failed',
}

/** payouts.status — FR-PAY-06, UC-04. */
/**
 * A payout's life, with the wire values. Three states, not five.
 *
 * "Due" and "on hold" are not among them because they are not states of a
 * payout — they describe money that has no payout yet. That lives in
 * `/admin/payouts/eligible`, where a row is either ready or carries the reason
 * it is not (`blocked`). A payout exists from the moment an operator approves
 * one, and from then on it is only ever paid or failed.
 */
export enum PayoutStatus {
  Approved = 'APPROVED',
  Paid = 'PAID',
  Failed = 'FAILED',
}

/** ledger_entries.entry_type — append-only journal (FR-PAY-10). */
export enum LedgerEntryType {
  Collection = 'Collection',
  Commission = 'Commission',
  Vat = 'Vat',
  Payout = 'Payout',
  Refund = 'Refund',
}
