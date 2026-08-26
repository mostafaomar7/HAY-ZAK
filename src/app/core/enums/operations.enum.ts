/*
 * `DisputeStatus` was this file's guess at a complaint's states, written
 * before the endpoints shipped. The real vocabulary is `ComplaintStatus` in
 * `complaint.enum.ts` — five values, not four, and the difference is the one
 * that matters: `AWAITING_USER`, which is the state where nothing moves until
 * the person reading the screen answers.
 */

/** FR-NTF-01 notification matrix. */
export enum NotificationChannel {
  Sms = 'Sms',
  Email = 'Email',
  InApp = 'InApp',
}

/**
 * The `type` on a notification, dotted as the API sends it.
 *
 * **Open, not closed.** The four unit types were read off the running server;
 * the rest follow its convention but have not been seen yet, because only the
 * units module has shipped. Nothing branches on the value — the server sends the
 * title and body already written and translated — so an unknown type renders
 * correctly, and the model's field is widened to `string` to say so.
 */
export enum NotificationType {
  // Verified against the API.
  ListingApproved = 'unit.approved',
  ListingRejected = 'unit.rejected',
  ListingSuspended = 'unit.suspended',
  ListingReinstated = 'unit.reinstated',

  // Provisional — the modules that raise these are not shipped.
  AccountOtp = 'account.otp',
  BookingPaid = 'booking.paid',
  BookingApproved = 'booking.approved',
  BookingRejected = 'booking.rejected',
  BookingStartReminder = 'booking.start_reminder',
  BookingEndReminder = 'booking.end_reminder',
  BookingCancelled = 'booking.cancelled',
  PayoutExecuted = 'payout.executed',
}

export enum OtpChannel {
  Sms = 'Sms',
  Email = 'Email',
}

/** terms_versions.document_type (FR-ADM-07). */
export enum LegalDocumentType {
  TermsOfUse = 'TermsOfUse',
  PrivacyPolicy = 'PrivacyPolicy',
  RefundPolicy = 'RefundPolicy',
}
