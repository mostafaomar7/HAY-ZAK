import { BookingStatus } from '../enums/booking-status.enum';
import { TermsVersionStatus } from '../models/admin.model';
import { DisputeStatus } from '../enums/operations.enum';
import { PayoutStatus } from '../enums/payment.enum';
import { UnitStatus } from '../enums/unit-status.enum';
import { AccountStatus, UserRole } from '../enums/user-role.enum';

/**
 * Semantic weight of a status, not a colour. Components map a tone to whatever
 * the design system calls for — so a palette change never touches this file.
 */
export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface StatusDisplay {
  ar: string;
  en: string;
  tone: StatusTone;
}

/**
 * Picks the label for the active language. Status text lives here rather than in
 * the translation dictionary because it is domain vocabulary keyed by an enum —
 * keeping both halves next to the tone means a new status cannot be added with
 * only one language filled in.
 */
export function statusText(display: StatusDisplay, lang: 'ar' | 'en'): string {
  return lang === 'en' ? display.en : display.ar;
}

/** FR-UNT-09 — the seven unit states. */
export const UNIT_STATUS_DISPLAY: Readonly<Record<UnitStatus, StatusDisplay>> = {
  [UnitStatus.Draft]: { ar: 'مسودة', en: 'Draft', tone: 'neutral' },
  [UnitStatus.PendingReview]: { ar: 'قيد المراجعة', en: 'Pending review', tone: 'warning' },
  [UnitStatus.Rejected]: { ar: 'مرفوضة', en: 'Rejected', tone: 'danger' },
  [UnitStatus.Published]: { ar: 'منشورة', en: 'Published', tone: 'success' },
  [UnitStatus.FullyBooked]: { ar: 'محجوزة بالكامل', en: 'Fully booked', tone: 'info' },
  [UnitStatus.Suspended]: { ar: 'موقوفة', en: 'Suspended', tone: 'warning' },
  [UnitStatus.Archived]: { ar: 'مؤرشفة', en: 'Archived', tone: 'neutral' },
};

/** SRS §6 — the nine booking states. */
export const BOOKING_STATUS_DISPLAY: Readonly<Record<BookingStatus, StatusDisplay>> = {
  [BookingStatus.Draft]: { ar: 'مسودة', en: 'Draft', tone: 'neutral' },
  [BookingStatus.AwaitingPayment]: {
    ar: 'بانتظار الدفع',
    en: 'Awaiting payment',
    tone: 'warning',
  },
  [BookingStatus.PaidPendingApproval]: {
    ar: 'مدفوع — بانتظار الموافقة',
    en: 'Paid, pending approval',
    tone: 'info',
  },
  [BookingStatus.Approved]: { ar: 'مقبول', en: 'Approved', tone: 'success' },
  [BookingStatus.Active]: { ar: 'ساري', en: 'Active', tone: 'success' },
  [BookingStatus.Completed]: { ar: 'منتهي', en: 'Completed', tone: 'neutral' },
  [BookingStatus.RejectedRefunded]: {
    ar: 'مرفوض ومُسترد',
    en: 'Rejected and refunded',
    tone: 'danger',
  },
  [BookingStatus.Cancelled]: { ar: 'ملغي', en: 'Cancelled', tone: 'danger' },
  [BookingStatus.Expired]: { ar: 'منتهية صلاحيته', en: 'Expired', tone: 'neutral' },
};

/** FR-LSR-08 — the transfer status column on the earnings page. */
export const PAYOUT_STATUS_DISPLAY: Readonly<Record<PayoutStatus, StatusDisplay>> = {
  [PayoutStatus.Due]: { ar: 'مستحق', en: 'Due', tone: 'info' },
  [PayoutStatus.OnHold]: { ar: 'معلّق', en: 'On hold', tone: 'warning' },
  [PayoutStatus.Processing]: { ar: 'جاري التحويل', en: 'Processing', tone: 'info' },
  [PayoutStatus.Paid]: { ar: 'محوّل', en: 'Paid', tone: 'success' },
  [PayoutStatus.Failed]: { ar: 'فشل التحويل', en: 'Failed', tone: 'danger' },
};

/** FR-ADM-08 — the complaints queue. */
export const DISPUTE_STATUS_DISPLAY: Readonly<Record<DisputeStatus, StatusDisplay>> = {
  [DisputeStatus.Open]: { ar: 'مفتوحة', en: 'Open', tone: 'warning' },
  [DisputeStatus.UnderReview]: { ar: 'تحت المراجعة', en: 'Under review', tone: 'info' },
  [DisputeStatus.Resolved]: { ar: 'محلولة', en: 'Resolved', tone: 'success' },
  [DisputeStatus.Closed]: { ar: 'مغلقة', en: 'Closed', tone: 'success' },
};

/** FR-ADM-04 — the status column on the users table. */
export const ACCOUNT_STATUS_DISPLAY: Readonly<Record<AccountStatus, StatusDisplay>> = {
  [AccountStatus.PendingVerification]: {
    ar: 'بانتظار التوثيق',
    en: 'Pending verification',
    tone: 'warning',
  },
  [AccountStatus.Active]: { ar: 'نشط', en: 'Active', tone: 'info' },
  [AccountStatus.Suspended]: { ar: 'موقوف', en: 'Suspended', tone: 'neutral' },
  [AccountStatus.Locked]: { ar: 'مقفل', en: 'Locked', tone: 'danger' },
};

/** FR-ADM-07 — the legal-document version table. */
export const TERMS_STATUS_DISPLAY: Readonly<Record<TermsVersionStatus, StatusDisplay>> = {
  [TermsVersionStatus.Draft]: { ar: 'مسودة', en: 'Draft', tone: 'warning' },
  [TermsVersionStatus.Published]: { ar: 'منشور', en: 'Published', tone: 'success' },
  [TermsVersionStatus.Archived]: { ar: 'مؤرشف', en: 'Archived', tone: 'neutral' },
};

/**
 * The role names the client uses. Kept here with the other domain vocabulary
 * rather than in the translation dictionary: adding a role must not be possible
 * with only one language filled in.
 *
 * The tone is unused for roles today — a role is not a status — but the shape is
 * shared so `statusText` works on it unchanged.
 */
export const ROLE_DISPLAY: Readonly<Record<UserRole, StatusDisplay>> = {
  [UserRole.Guest]: { ar: 'زائر', en: 'Guest', tone: 'neutral' },
  [UserRole.Renter]: { ar: 'مستأجر', en: 'Renter', tone: 'neutral' },
  [UserRole.Lessor]: { ar: 'مؤجر', en: 'Lessor', tone: 'neutral' },
  [UserRole.OperationsSupervisor]: {
    ar: 'مشرف العمليات',
    en: 'Operations supervisor',
    tone: 'info',
  },
  [UserRole.FinanceOfficer]: { ar: 'المسؤول المالي', en: 'Finance officer', tone: 'info' },
  [UserRole.SystemAdministrator]: {
    ar: 'مدير النظام',
    en: 'System administrator',
    tone: 'info',
  },
};

/** The role a signed-in user is acting as — the most privileged one they hold. */
export function primaryRole(roles: readonly UserRole[]): UserRole {
  const order = [
    UserRole.SystemAdministrator,
    UserRole.FinanceOfficer,
    UserRole.OperationsSupervisor,
    UserRole.Lessor,
    UserRole.Renter,
  ];
  return order.find((role) => roles.includes(role)) ?? UserRole.Guest;
}
