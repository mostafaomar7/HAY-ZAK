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

export enum RefundStatus {
  Pending = 'Pending',
  Processing = 'Processing',
  Completed = 'Completed',
  Failed = 'Failed',
}

/** payouts.status — FR-PAY-06, UC-04. */
export enum PayoutStatus {
  Due = 'Due',
  OnHold = 'OnHold',
  Processing = 'Processing',
  Paid = 'Paid',
  Failed = 'Failed',
}

/** ledger_entries.entry_type — append-only journal (FR-PAY-10). */
export enum LedgerEntryType {
  Collection = 'Collection',
  Commission = 'Commission',
  Vat = 'Vat',
  Payout = 'Payout',
  Refund = 'Refund',
}
