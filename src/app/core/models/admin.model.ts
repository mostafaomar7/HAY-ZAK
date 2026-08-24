import type { BookingStatus } from '../enums/booking-status.enum';
import type { DisputeStatus, LegalDocumentType } from '../enums/operations.enum';
import type { PayoutStatus } from '../enums/payment.enum';
import type { AccountStatus, UserRole } from '../enums/user-role.enum';

/**
 * The admin panel's read models (FR-ADM, FR-RPT).
 *
 * These live in core rather than the feature: they are API contracts, core must
 * not depend on a feature, and the mock backend needs them too.
 *
 * Every row is flattened for display — the API joins what a table column shows
 * so the client never stitches two responses together to fill one cell.
 */

// ── Review queues (FR-UNT-06, FR-BKG-05) ─────────────────────────────────

/** One row of "مراجعة الإعلانات". */
export interface ListingReviewRow {
  id: string;
  unitTitle: string;
  ownerName: string;
  categoryName: string;
  cityName: string;
  dailyPriceHalalas: number;
  areaSqm: number;
  /** ISO date the lessor submitted it for review. */
  submittedAt: string;
  /** Whole hours waiting, from `submittedAt` to now, computed server-side. */
  waitingHours: number;
  /** True for a re-submitted listing rather than a first publication. */
  isEdit: boolean;
}

/** One row of "مراجعة الحجوزات" — paid, awaiting a human decision. */
export interface BookingReviewRow {
  id: string;
  referenceNo: string;
  renterName: string;
  lessorName: string;
  unitTitle: string;
  startDate: string;
  endDate: string;
  totalHalalas: number;
  /** Hours since payment. Past `approvalSlaHours` the row is flagged late. */
  waitingHours: number;
}

/** The slide-over on a listing row (FR-UNT-06). */
export interface ListingReviewDetail extends ListingReviewRow {
  description: string;
  imageUrls: string[];
  districtName: string;
  owner: AdminContact;
}

/** The slide-over on a booking row (FR-BKG-05). */
export interface BookingReviewDetail extends BookingReviewRow {
  /** FR-BKG-03 — what the renter said they are storing. */
  goodsDescription: string;
  daysCount: number;
  commissionHalalas: number;
  vatHalalas: number;
  netToLessorHalalas: number;
  paidAt: string;
  renter: AdminContact;
  lessor: AdminContact;
}

export interface AdminContact {
  name: string;
  mobile: string;
  email?: string;
  isVerified: boolean;
}

/**
 * A rejection carries a coded reason, never only free text: the code is what the
 * audit trail, the notification template and any later report can group by. The
 * note is an addition for the recipient, not a substitute (FR-ADM-09).
 */
export interface ReviewDecision {
  reasonCode: RejectionReasonCode;
  note?: string;
}

export enum RejectionReasonCode {
  UnclearPhotos = 'UnclearPhotos',
  IncompleteDescription = 'IncompleteDescription',
  PriceOutOfRange = 'PriceOutOfRange',
  ProhibitedGoods = 'ProhibitedGoods',
  IncompleteLessorData = 'IncompleteLessorData',
  Other = 'Other',
}

// ── Payments and payouts (FR-PAY) ────────────────────────────────────────

/** One row of "متابعة المدفوعات" — a collected booking and its onward transfer. */
export interface PaymentTrackingRow {
  id: string;
  bookingReferenceNo: string;
  renterName: string;
  lessorName: string;
  unitTitle: string;
  totalHalalas: number;
  commissionHalalas: number;
  netHalalas: number;
  /** Whether the money reached the platform, and whether it left again. */
  isRefunded: boolean;
  payoutStatus: PayoutStatus;
  bankReference?: string;
}

/**
 * Dues are grouped by lessor, because that is the unit a transfer is executed
 * in — one bank instruction per lessor per cycle, not one per booking.
 */
export interface PayoutGroup {
  lessorId: string;
  lessorName: string;
  bankName?: string;
  accountHolder?: string;
  /** Masked to the last four digits until the operator reveals it. */
  ibanMasked?: string;
  totalDue: number;
  rowCount: number;
  /** FR-PAY-06 — no transfer can be executed while this is true. */
  bankDetailsMissing: boolean;
  rows: PayoutRow[];
}

export interface PayoutRow {
  id: string;
  bookingReferenceNo: string;
  unitTitle: string;
  dueDate: string;
  netHalalas: number;
  status: PayoutStatus;
  bankReference?: string;
  /** Why it is frozen or why the last attempt failed (UC-04). */
  note?: string;
}

/** What the operator types to record an executed transfer. */
export interface PayoutExecution {
  bankReference: string;
  executedOn: string;
}

export interface PayoutReschedule {
  scheduledFor: string;
  reason: string;
}

/** The full IBAN, fetched only when the operator asks to see it. */
export interface LessorBankDetails {
  bankName: string;
  accountHolder: string;
  iban: string;
}

// ── Reports (FR-RPT) ─────────────────────────────────────────────────────

export type ReportKind = 'bookings' | 'revenue' | 'payouts' | 'occupancy';

export interface ReportFilters {
  from: string;
  to: string;
  cityId?: string;
  categoryId?: string;
  lessorId?: string;
  status?: string;
}

/** FR-RPT-01 — paid bookings per month. */
export interface BookingsReportRow {
  /** First day of the month, ISO. The client formats both calendars from it. */
  month: string;
  count: number;
  totalValue: number;
}

/** FR-RPT-02 — revenue against the commission taken from it. */
export interface RevenueReportRow {
  month: string;
  revenue: number;
  commission: number;
  vat: number;
  netToLessors: number;
}

/** FR-RPT-03 — how much of what each lessor is owed has actually gone out. */
export interface PayoutReportRow {
  lessorId: string;
  lessorName: string;
  totalDue: number;
  transferred: number;
  remaining: number;
}

/** FR-RPT-04 — occupancy by city and category. */
export interface OccupancyReportRow {
  cityName: string;
  categoryName: string;
  unitCount: number;
  bookedDays: number;
  /** 0–100. */
  occupancyRate: number;
}

// ── Financial settings (FR-ADM-06, FR-ADM-12) ────────────────────────────

/**
 * FR-ADM-06 — a rate that overrides the general one for a single lessor or a
 * single unit. The narrower scope wins when both match.
 */
export interface CommissionException {
  id: string;
  scope: 'unit' | 'lessor';
  targetId: string;
  targetName: string;
  rateBps: number;
}

export interface CommissionExceptionRequest {
  scope: 'unit' | 'lessor';
  targetId: string;
  rateBps: number;
}

// ── Users (FR-ADM-04) ────────────────────────────────────────────────────

export interface AdminUserRow {
  id: string;
  fullName: string;
  role: UserRole;
  mobile: string;
  email: string;
  registeredAt: string;
  status: AccountStatus;
}

export interface AdminUserDetail extends AdminUserRow {
  nationalId?: string;
  /** Titles only — the panel lists them, it does not manage them. */
  units: AdminUserUnit[];
  bookings: AdminUserBooking[];
}

export interface AdminUserUnit {
  id: string;
  title: string;
}

export interface AdminUserBooking {
  id: string;
  referenceNo: string;
  unitTitle: string;
  status: BookingStatus;
}

// ── Reference lists (FR-ADM-05) ──────────────────────────────────────────

export type ReferenceListKind = 'categories' | 'cities' | 'districts' | 'prohibitedItems';

export interface ReferenceListRow {
  id: string;
  nameAr: string;
  nameEn: string;
  /** Display order, editable by dragging the row. */
  sortOrder: number;
  /** How many live records point at this entry — deleting one is refused. */
  linkedCount: number;
}

export interface ReferenceListRequest {
  nameAr: string;
  nameEn: string;
  /** Only for districts. */
  cityId?: string;
}

// ── CMS and legal documents (FR-CMS-01, FR-ADM-07) ───────────────────────

export interface CmsPageDetail {
  slug: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  seoTitle: string;
  seoDescription: string;
  updatedAt: string;
}

/** FR-ADM-07 — a legal version and the consent recorded against it. */
export interface TermsVersionRow {
  id: string;
  documentType: LegalDocumentType;
  versionNo: string;
  publishedAt?: string;
  status: TermsVersionStatus;
  /** How many users have accepted this exact version. */
  approvalCount: number;
  changeNote: string;
}

export enum TermsVersionStatus {
  Draft = 'Draft',
  Published = 'Published',
  Archived = 'Archived',
}

/** One recorded acceptance — the proof half of FR-ADM-07. */
export interface TermsApprovalRow {
  userId: string;
  fullName: string;
  role: UserRole;
  acceptedAt: string;
}

// ── Complaints (FR-ADM-08) ───────────────────────────────────────────────

export interface ComplaintRow {
  id: string;
  referenceNo: string;
  bookingReferenceNo: string;
  raisedByName: string;
  subject: string;
  status: DisputeStatus;
  openedAt: string;
}

export interface ComplaintDetail extends ComplaintRow {
  bookingId: string;
  raisedByRole: UserRole;
  bookingHalalas: number;
  /** True while a payout is held against this dispute (UC-04). */
  payoutFrozen: boolean;
  messages: ComplaintMessage[];
  resolution?: string;
}

export interface ComplaintMessage {
  id: string;
  authorName: string;
  body: string;
  sentAt: string;
}

// ── Audit trail (FR-ADM-09) ──────────────────────────────────────────────

/**
 * The list projection of `AuditLogEntry`. Old and new values arrive already
 * rendered as text: the log stores what changed, and only the writer knows how
 * to say it — the reader must not have to guess a shape per action.
 */
export interface AuditRow {
  id: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  occurredAt: string;
  oldValue: string;
  newValue: string;
}

export interface AuditDetail extends AuditRow {
  entityType: string;
  entityId: string;
  ipAddress: string;
  userAgent?: string;
}
