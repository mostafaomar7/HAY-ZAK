import { BookingStatus } from '../enums/booking-status.enum';
import { TermsVersionStatus } from '../models/admin.model';
import {
  ComplaintCategory,
  ComplaintResolution,
  ComplaintStatus,
  RefundMethod,
} from '../enums/complaint.enum';
import { PayoutStatus } from '../enums/payment.enum';
import type { EarningsBucket } from '../models/earnings.model';
import type { PayoutBlockedReason } from '../models/payment.model';
import { UnitStatus } from '../enums/unit-status.enum';
import { AccountStatus, AdminRole, UserRole, VerificationStatus } from '../enums/user-role.enum';

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

/** FR-UNT-09 — the six unit states the API stores. */
export const UNIT_STATUS_DISPLAY: Readonly<Record<UnitStatus, StatusDisplay>> = {
  [UnitStatus.Draft]: { ar: 'مسودة', en: 'Draft', tone: 'neutral' },
  [UnitStatus.PendingReview]: { ar: 'قيد المراجعة', en: 'Pending review', tone: 'warning' },
  [UnitStatus.Rejected]: { ar: 'مرفوضة', en: 'Rejected', tone: 'danger' },
  [UnitStatus.Published]: { ar: 'منشورة', en: 'Published', tone: 'success' },
  [UnitStatus.Suspended]: { ar: 'موقوفة', en: 'Suspended', tone: 'warning' },
  [UnitStatus.Archived]: { ar: 'مؤرشفة', en: 'Archived', tone: 'neutral' },
};

/**
 * Shown beside the status, not instead of it.
 *
 * "Fully booked" is not one of the six: a unit with no free dates is still
 * published, and it is bookable again the moment a window opens. Reading
 * `Unit.isFullyBooked` rather than the status is what keeps that true.
 */
export const FULLY_BOOKED_DISPLAY: StatusDisplay = {
  ar: 'محجوزة بالكامل',
  en: 'Fully booked',
  tone: 'info',
};

/** SRS §6 — the nine booking states. */
export const BOOKING_STATUS_DISPLAY: Readonly<Record<BookingStatus, StatusDisplay>> = {
  [BookingStatus.Draft]: { ar: 'مسودة', en: 'Draft', tone: 'neutral' },
  [BookingStatus.AwaitingPayment]: {
    ar: 'بانتظار الدفع',
    en: 'Awaiting payment',
    tone: 'warning',
  },
  [BookingStatus.Confirmed]: { ar: 'مؤكَّد', en: 'Confirmed', tone: 'success' },
  [BookingStatus.Active]: { ar: 'ساري', en: 'Active', tone: 'success' },
  [BookingStatus.Completed]: { ar: 'منتهي', en: 'Completed', tone: 'neutral' },
  // Cancelled only ever means "administration cancelled it", so the label says
  // so — a bare "ملغي" reads as something the renter or the lessor did.
  [BookingStatus.Cancelled]: {
    ar: 'ملغي من الإدارة',
    en: 'Cancelled by administration',
    tone: 'danger',
  },
  [BookingStatus.Expired]: { ar: 'انتهت مهلة الحجز', en: 'Hold expired', tone: 'neutral' },
};

/** FR-LSR-08 — a payout's three states. */
export const PAYOUT_STATUS_DISPLAY: Readonly<Record<PayoutStatus, StatusDisplay>> = {
  [PayoutStatus.Approved]: { ar: 'معتمد — بانتظار التنفيذ', en: 'Approved', tone: 'info' },
  [PayoutStatus.Paid]: { ar: 'محوّل', en: 'Paid', tone: 'success' },
  [PayoutStatus.Failed]: { ar: 'فشل التحويل', en: 'Failed', tone: 'danger' },
};

/**
 * Why releasable money has no payout yet, in the operator's words.
 *
 * On the row itself, never in a toast after the fact: the point is that the
 * obstacle is visible before anybody presses a button that cannot work.
 */
export const PAYOUT_BLOCKED_DISPLAY: Readonly<Record<PayoutBlockedReason, StatusDisplay>> = {
  NO_BANK_ACCOUNT: {
    ar: 'لا يوجد حساب بنكي للمؤجّر',
    en: 'The lessor has no bank account',
    tone: 'warning',
  },
};

/**
 * Whether an administrator has checked a bank account or an identity.
 *
 * Informational, and deliberately so: `UNVERIFIED` means "not looked at yet",
 * not "refused", and gating a control on it would stop somebody working while
 * they wait on a queue they cannot see.
 */
export const ACCOUNT_VERIFICATION_DISPLAY: Readonly<Record<VerificationStatus, StatusDisplay>> = {
  [VerificationStatus.Unverified]: {
    ar: 'بانتظار المراجعة',
    en: 'Awaiting review',
    tone: 'neutral',
  },
  [VerificationStatus.Pending]: { ar: 'قيد المراجعة', en: 'Under review', tone: 'info' },
  [VerificationStatus.Verified]: { ar: 'موثّق', en: 'Verified', tone: 'success' },
  [VerificationStatus.Failed]: { ar: 'تعذّر التوثيق', en: 'Could not verify', tone: 'danger' },
};

/** Where one booking's money sits, on the dues table (LSR-07). */
export const EARNINGS_BUCKET_DISPLAY: Readonly<Record<EarningsBucket, StatusDisplay>> = {
  PENDING: { ar: 'قيد الانتظار', en: 'Pending', tone: 'warning' },
  RELEASABLE: { ar: 'جاهز للتحويل', en: 'Releasable', tone: 'info' },
  PAID: { ar: 'محوّل', en: 'Paid', tone: 'success' },
};

/**
 * What decides when earned money becomes releasable.
 *
 * Shown on the lessor's earnings screen rather than kept in the backend's head.
 * "Why is my money still pending" is the question that becomes a support ticket
 * when nothing on the page answers it, and the server names the rule precisely
 * so that it can be answered. An unknown rule renders nothing — inventing a
 * sentence for a policy this build has not heard of would be worse than silence.
 */
export const RELEASE_RULE_TEXT: Readonly<Record<string, StatusDisplay>> = {
  after_booking_start_24h: {
    ar: 'تصبح المستحقات جاهزة للتحويل بعد ٢٤ ساعة من بداية الحجز.',
    en: 'Earnings become releasable 24 hours after the booking starts.',
    tone: 'neutral',
  },
};

/** FR-ADM-08 — the complaints queue. */
/**
 * FR-ADM-08 — the shipped complaint vocabulary.
 *
 * "بانتظار ردّك" is `warning` rather than `info` on purpose: it is the one
 * state where nothing moves until the person reading the screen does
 * something, and it should not look like a state they can leave alone.
 */
export const COMPLAINT_STATUS_DISPLAY: Readonly<Record<ComplaintStatus, StatusDisplay>> = {
  [ComplaintStatus.Open]: { ar: 'مفتوحة', en: 'Open', tone: 'warning' },
  [ComplaintStatus.InProgress]: { ar: 'قيد المعالجة', en: 'In progress', tone: 'info' },
  [ComplaintStatus.AwaitingUser]: {
    ar: 'بانتظار ردّك',
    en: 'Awaiting your reply',
    tone: 'warning',
  },
  [ComplaintStatus.Resolved]: { ar: 'تم الحسم', en: 'Resolved', tone: 'success' },
  [ComplaintStatus.Closed]: { ar: 'مغلقة', en: 'Closed', tone: 'neutral' },
};

/**
 * The console's view of the same statuses.
 *
 * "بانتظار المستخدم" is `neutral` here and `warning` on the user's screen —
 * the same fact, and whose move it is flips between the two readers.
 */
export const COMPLAINT_STATUS_ADMIN_DISPLAY: Readonly<Record<ComplaintStatus, StatusDisplay>> = {
  ...COMPLAINT_STATUS_DISPLAY,
  [ComplaintStatus.AwaitingUser]: {
    ar: 'بانتظار المستخدم',
    en: 'Awaiting the user',
    tone: 'neutral',
  },
};

export const COMPLAINT_CATEGORY_DISPLAY: Readonly<Record<ComplaintCategory, StatusDisplay>> = {
  [ComplaintCategory.CancellationRequest]: {
    ar: 'طلب إلغاء أو استرداد',
    en: 'Cancellation or refund request',
    tone: 'warning',
  },
  [ComplaintCategory.SpaceNotAsDescribed]: {
    ar: 'المساحة ليست كما وُصفت',
    en: 'Space not as described',
    tone: 'warning',
  },
  [ComplaintCategory.AccessProblem]: {
    ar: 'تعذّر الدخول إلى المساحة',
    en: 'Could not get in',
    tone: 'warning',
  },
  [ComplaintCategory.PaymentIssue]: { ar: 'مشكلة في الدفع', en: 'Payment issue', tone: 'danger' },
  [ComplaintCategory.PayoutIssue]: {
    ar: 'مشكلة في التحويل المستحق',
    en: 'Payout issue',
    tone: 'danger',
  },
  [ComplaintCategory.GoodsDamage]: { ar: 'تلف في البضاعة', en: 'Damage to goods', tone: 'danger' },
  [ComplaintCategory.ProhibitedGoods]: {
    ar: 'بضاعة ممنوعة',
    en: 'Prohibited goods',
    tone: 'danger',
  },
  [ComplaintCategory.Other]: { ar: 'أخرى', en: 'Other', tone: 'neutral' },
};

/**
 * What was decided, written as the outcome rather than the verb.
 *
 * The user reads these on their own complaint, so they say what happened to
 * them — "أُلغي الحجز" — not what an operator pressed.
 */
export const COMPLAINT_RESOLUTION_DISPLAY: Readonly<Record<ComplaintResolution, StatusDisplay>> = {
  [ComplaintResolution.NoAction]: {
    ar: 'لا يوجد إجراء',
    en: 'No action',
    tone: 'neutral',
  },
  [ComplaintResolution.PayoutHold]: {
    ar: 'تجميد تحويل المؤجّر',
    en: 'Payout held',
    tone: 'warning',
  },
  [ComplaintResolution.BookingCancelled]: {
    ar: 'أُلغي الحجز',
    en: 'Booking cancelled',
    tone: 'info',
  },
  [ComplaintResolution.UnitSuspended]: {
    ar: 'أُوقف الإعلان',
    en: 'Listing suspended',
    tone: 'warning',
  },
  [ComplaintResolution.Refund]: { ar: 'استرداد مبلغ', en: 'Refund issued', tone: 'success' },
  [ComplaintResolution.RefundAndCancel]: {
    ar: 'استرداد مبلغ وإلغاء الحجز',
    en: 'Refunded and cancelled',
    tone: 'success',
  },
};

export const REFUND_METHOD_DISPLAY: Readonly<Record<RefundMethod, StatusDisplay>> = {
  [RefundMethod.Gateway]: {
    ar: 'عبر بوابة الدفع',
    en: 'Through the gateway',
    tone: 'success',
  },
  [RefundMethod.ManualTransfer]: {
    ar: 'تحويل بنكي يدوي',
    en: 'Manual bank transfer',
    tone: 'info',
  },
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
  [UserRole.Admin]: { ar: 'إدارة', en: 'Administration', tone: 'info' },
};

/**
 * The three kinds of administrator, by name.
 *
 * Separate from `ROLE_DISPLAY` because they are a separate field: the API
 * sends one `ADMIN` role and an `adminRole` beside it. Use `userRoleText()`
 * rather than either map — a user row wants "مشرف العمليات", not "إدارة".
 */
export const ADMIN_ROLE_DISPLAY: Readonly<Record<AdminRole, StatusDisplay>> = {
  [AdminRole.SystemAdmin]: { ar: 'مدير النظام', en: 'System administrator', tone: 'info' },
  [AdminRole.Operations]: { ar: 'مشرف العمليات', en: 'Operations supervisor', tone: 'info' },
  [AdminRole.Finance]: { ar: 'المسؤول المالي', en: 'Finance officer', tone: 'info' },
};

/** What to call this account: the administrator's kind when there is one. */
export function userRoleDisplay(role: UserRole, adminRole?: AdminRole | null): StatusDisplay {
  return (adminRole && ADMIN_ROLE_DISPLAY[adminRole]) || ROLE_DISPLAY[role];
}
