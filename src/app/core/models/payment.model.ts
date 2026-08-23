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
  amount: number;
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
  amount: number;
  reason: string;
  status: RefundStatus;
  processedAt?: string;
}

/** ERD-4 `commissions` — platform revenue per booking. */
export interface Commission {
  bookingId: string;
  rateApplied: number;
  commissionAmount: number;
  vatOnCommission: number;
  netToLessor: number;
}

/** ERD-4 `invoices` — FR-PAY-09, ZATCA compliant. */
export interface Invoice {
  id: string;
  bookingId: string;
  invoiceNo: string;
  taxableAmount: number;
  vatAmount: number;
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
  bankAccountIbanMasked: string;
  totalAmount: number;
  status: PayoutStatus;
  bankReference?: string;
  failureReason?: string;
  executedBy?: string;
  executedAt?: string;
  items: PayoutItem[];
}

export interface PayoutItem {
  bookingId: string;
  bookingReferenceNo: string;
  netAmount: number;
}

/** FR-PAY-06 — Phase 1 payouts are manual, evidenced by a bank reference. */
export interface PayoutExecuteRequest {
  bankReference: string;
  executedAt: string;
  note?: string;
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

/** FR-LSR-08 — the lessor's earnings page. */
export interface LessorEarnings {
  totalPaidBookings: number;
  grossAmount: number;
  commissionDeducted: number;
  netReceivable: number;
  netTransferred: number;
  netOutstanding: number;
}
