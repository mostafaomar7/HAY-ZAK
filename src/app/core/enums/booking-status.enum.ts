/** SRS §6 Booking Lifecycle — the exact nine states, no more. */
export enum BookingStatus {
  Draft = 'Draft',
  AwaitingPayment = 'AwaitingPayment',
  PaidPendingApproval = 'PaidPendingApproval',
  Approved = 'Approved',
  Active = 'Active',
  Completed = 'Completed',
  RejectedRefunded = 'RejectedRefunded',
  Cancelled = 'Cancelled',
  Expired = 'Expired',
}

/** No transition leaves these. */
export const TERMINAL_BOOKING_STATUSES: readonly BookingStatus[] = [
  BookingStatus.Completed,
  BookingStatus.RejectedRefunded,
  BookingStatus.Cancelled,
  BookingStatus.Expired,
] as const;
