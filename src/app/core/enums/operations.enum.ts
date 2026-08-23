export enum DisputeStatus {
  Open = 'Open',
  UnderReview = 'UnderReview',
  Resolved = 'Resolved',
  Closed = 'Closed',
}

/** FR-NTF-01 notification matrix. */
export enum NotificationChannel {
  Sms = 'Sms',
  Email = 'Email',
  InApp = 'InApp',
}

export enum NotificationType {
  AccountOtp = 'AccountOtp',
  ListingApproved = 'ListingApproved',
  ListingRejected = 'ListingRejected',
  BookingPaid = 'BookingPaid',
  BookingApproved = 'BookingApproved',
  BookingRejected = 'BookingRejected',
  BookingStartReminder = 'BookingStartReminder',
  BookingEndReminder = 'BookingEndReminder',
  BookingCancelled = 'BookingCancelled',
  PayoutExecuted = 'PayoutExecuted',
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
