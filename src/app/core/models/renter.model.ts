import type { PaymentMethod } from '../enums/payment.enum';
import type { Booking } from './booking.model';

/** The renter's own record on the account screen (RNT-09). */
export interface RenterProfile {
  fullName: string;
  /** Masked — the renter may read the last four digits, never the whole number. */
  idNumberMasked: string;
  address: string;
  mobile: string;
  mobileVerifiedAt?: string;
  email: string;
  emailVerifiedAt?: string;
}

/** Only the fields the renter is allowed to change. */
export interface RenterProfileRequest {
  fullName: string;
  address: string;
  mobile: string;
  email: string;
}

/**
 * FR-NTF — the four switches on the account page. Keyed by a stable code so the
 * backend can add a fifth without a front-end release.
 */
export type NotificationPreferenceKey =
  'bookingStatus' | 'paymentsAndInvoices' | 'endOfTermReminder' | 'email';

export interface NotificationPreference {
  key: NotificationPreferenceKey;
  enabled: boolean;
}

/**
 * FR-BKG-08 — what the renter gets back, computed by the server before the
 * cancellation is confirmed.
 *
 * The figure is never derived on the client: the design shows it inside a final
 * confirmation dialog, and a number that disagrees with the server would be a
 * refund dispute. The client only renders what this returns.
 */
export interface CancellationQuote {
  bookingId: string;
  /** Which tier of the published policy applies. */
  appliedRule: CancellationRuleCode;
  daysBeforeStart: number;
  totalPaid: number;
  refundHalalas: number;
  /** 0–1. */
  refundPercentage: number;
  /** Masked destination, e.g. "مدى ••8130". */
  refundDestination: string;
  refundEtaBusinessDays: number;
}

export type CancellationRuleCode =
  /** Administration rejected the request — always a full refund, no fee. */
  | 'adminRejection'
  /** More than seven days before the start date. */
  | 'earlyCancellation'
  /** Seven days or fewer before the start date. */
  | 'lateCancellation'
  /** After the term has begun. */
  | 'afterStart';

export interface CancellationRequest {
  /** Optional in the design — the renter may cancel without giving a reason. */
  reasonCode?: CancellationReasonCode;
  note?: string;
}

export type CancellationReasonCode = 'planChanged' | 'foundCloser' | 'postponed' | 'other';

/** FR-PAY-01 — the three methods the payment step offers. */
export interface PaymentOption {
  method: PaymentMethod;
  /** Whether the gateway currently accepts it. */
  enabled: boolean;
}

/**
 * The exception the design calls "حُجزت هذه الفترة لعميل آخر": another renter
 * completed payment for the same window first (SRS §6, concurrent hold).
 */
export interface AlternativePeriod {
  startDate: string;
  endDate: string;
  daysCount: number;
  totalHalalas: number;
}

/** What `/bookings/mine` returns, split the way the two tabs need it. */
export interface RenterBookingList {
  current: Booking[];
  previous: Booking[];
}
