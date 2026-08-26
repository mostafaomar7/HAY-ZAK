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
/*
 * What the renter writes is `CreateComplaintRequest` in `complaint.ts`. It
 * still has no "desired outcome" field — the writer says what happened and an
 * administrator decides what follows — but it now carries the category and the
 * attachments the shipped endpoint takes, and goes as multipart.
 */

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
