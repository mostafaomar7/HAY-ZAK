import type {
  LedgerEntryType,
  PaymentMethod,
  PaymentStatus,
  PayoutStatus,
  RefundStatus,
} from '../enums/payment.enum';

/** ERD-4 `payments`. */
export interface Payment {
  id: string;
  bookingId: string;
  amountHalalas: number;
  currency: 'SAR';
  gateway: string;
  gatewayReference: string;
  method: PaymentMethod;
  status: PaymentStatus;
  /** Separate from capturedAt — SRS §6 flags authorize-then-capture as the
   *  operationally better model, pending the gateway decision (§15 item 2). */
  authorizedAt?: string;
  capturedAt?: string;
}

/** What the payment page needs to hand off to the gateway. */
export interface PaymentIntent {
  bookingId: string;
  gatewayReference: string;
  /** Hosted checkout URL or client secret, depending on the provider. */
  redirectUrl?: string;
  clientSecret?: string;
  expiresAt: string;
}

export interface Refund {
  id: string;
  paymentId: string;
  bookingId: string;
  amountHalalas: number;
  reason: string;
  status: RefundStatus;
  processedAt?: string;
}

/** ERD-4 `commissions` — platform revenue per booking. */
export interface Commission {
  bookingId: string;
  rateApplied: number;
  commissionHalalas: number;
  vatOnCommission: number;
  netToLessorHalalas: number;
}

/** ERD-4 `invoices` — FR-PAY-09, ZATCA compliant. */
export interface Invoice {
  id: string;
  bookingId: string;
  invoiceNo: string;
  taxableHalalas: number;
  vatHalalas: number;
  total: number;
  /** ZATCA QR payload. */
  qrCode: string;
  pdfUrl: string;
  issuedAt: string;
}

/** ERD-4 `payouts` / `payout_items` — UC-04. */
export interface Payout {
  id: string;
  lessorId: string;
  lessorName?: string;
  /** Never the full IBAN — the API sends the last four only (NFR-SEC-02). */
  ibanLast4?: string;
  totalHalalas: number;
  status: PayoutStatus;
  bankReference?: string;
  failureReason?: string;
  executedBy?: string;
  executedAt?: string;
  createdAt?: string;
  /** The bookings inside it — present on the detail, not on the list row. */
  items?: PayoutItem[];
}

export interface PayoutItem {
  bookingId: string;
  bookingReferenceNo: string;
  netHalalas: number;
}

/**
 * Why a lessor's releasable money cannot be paid out yet.
 *
 * `null` is the ordinary case. Anything else is shown on the row itself: an
 * operator should see the obstacle before they press a button that fails.
 */
export type PayoutBlockedReason = 'NO_BANK_ACCOUNT';

/** One lessor's releasable total — `/admin/payouts/eligible`. */
export interface EligiblePayout {
  lessorId: string;
  lessorName: string;
  totalHalalas: number;
  bookingsCount?: number;
  ibanLast4?: string;
  blocked: PayoutBlockedReason | null;
}

/**
 * FR-PAY-06 — Phase 1 payouts are manual, evidenced by a bank reference.
 *
 * `bankReference` is required and the server answers 422 without it. A transfer
 * recorded as done with nothing tying it to a bank statement is not a record
 * anybody can audit.
 */
export interface PayoutPaidRequest {
  bankReference: string;
}

export interface PayoutFailedRequest {
  reason: string;
}

/** ERD-4 `ledger_entries` — append-only, never updated or deleted. */
export interface LedgerEntry {
  id: string;
  entryType: LedgerEntryType;
  referenceType: string;
  referenceId: string;
  debit: number;
  credit: number;
  balanceAfter: number;
  createdAt: string;
}

/** The last transfer a lessor received. */
export interface LastPayout {
  executedAt: string;
  totalHalalas: number;
  bankReference: string;
}

/**
 * FR-LSR-08 — the lessor's money, in three buckets.
 *
 * The names are the answer to the only question this screen is ever asked:
 * earned but not yet releasable, releasable but not yet sent, and sent.
 * `releaseRule` says *why* the first bucket is not the second, and belongs on
 * the screen — "why is my money still pending" is the question that becomes a
 * support ticket when nothing on the page answers it.
 */
export interface LessorEarnings {
  pendingHalalas: number;
  pendingBookings: number;
  releasableHalalas: number;
  releasableBookings: number;
  paidHalalas: number;
  paidPayouts: number;
  lastPayout: LastPayout | null;
  /** e.g. `after_booking_start_24h`. Translated by `RELEASE_RULE_TEXT`. */
  releaseRule: string;
}
