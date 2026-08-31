import type { BookingStatus } from '../enums/booking-status.enum';
import type { LegalDocumentType } from '../enums/operations.enum';
import type { AccountStatus, AdminRole, UserRole } from '../enums/user-role.enum';

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
  /**
   * When the lessor submitted it — the server's own column, not `updatedAt`.
   *
   * That distinction is the whole reason it exists: any edit to a listing
   * already in the queue moves `updatedAt`, so a client reading that would
   * have quietly reset every deadline the moment somebody fixed a typo.
   *
   * `null` on anything that is not awaiting review.
   */
  submittedAt: string | null;
  /** When a decision is owed by. `null` unless the row is awaiting review. */
  slaDueAt: string | null;
  /**
   * Past that deadline — **the server's answer**, from the same definition
   * that decides `operations.approval_sla_hours`. Not the client comparing an
   * elapsed hour count against a setting it fetched separately.
   *
   * `null` wherever `slaDueAt` is: "not late" is an answer about a deadline,
   * and a published listing does not have one. Three states, and only one of
   * them paints a row red.
   */
  isOverdue: boolean | null;
  /**
   * Whole hours waiting, counted here from the server's `submittedAt`.
   *
   * A label, not a verdict: "منذ ٦ ساعات" is arithmetic anybody can check, and
   * whether that is *late* is `isOverdue`. `null` when nothing was submitted.
   */
  waitingHours: number | null;
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
/**
 * A booking as payment tracking reads it (FR-PAY-08) — one row of
 * `GET /admin/bookings`.
 *
 * It replaced `PaymentTrackingRow`, which was modelled on `/admin/payments` —
 * an endpoint that has never existed, so the screen showed "تعذّر تحميل
 * المعاملات" and nothing else for as long as it has been there. Every figure it
 * needed is on this row instead.
 *
 * `isRefunded` and the payout bucket are **not** here and are not invented.
 * Whether money went back out is on the booking's own detail, and which bucket
 * a lessor's share sits in is a property of a payout run — which covers several
 * bookings and does not exist until an operator approves one. That question is
 * answered on the transfers screen, where the payout is.
 */
export interface AdminBookingRow {
  id: string;
  referenceNo: string;
  status: BookingStatus;
  startDate: string;
  /** Half-open — the day of departure, not the last night. */
  endDate: string;
  nights: number;
  /** What the renter paid. Not revenue: most of it is owed onward. */
  totalHalalas: number;
  commissionHalalas: number;
  netToLessorHalalas: number;
  /** The lessor's share is frozen — an open complaint, usually. */
  payoutHeld: boolean;
  unit: { id: string; title: string };
  renter: AdminBookingParty;
  lessor: AdminBookingParty;
  createdAt: string;
  /** Null until it is paid for; payment is what confirms a booking. */
  confirmedAt: string | null;
}

export interface AdminBookingParty {
  id: string;
  fullName: string;
  mobile: string;
}

/** What `/admin/bookings` narrows by, and nothing else — a fifth is a 422. */
export interface AdminBookingQuery {
  status?: BookingStatus;
  /** Reference number, either party, or the listing's title. */
  search?: string;
  from?: string;
  to?: string;
  page?: number;
}

// ── Wire ──────────────────────────────────────────────────────────────────

export interface WireAdminBooking {
  id: string;
  referenceNo: string;
  status: BookingStatus;
  startDate: string;
  endDate: string;
  /** Nights. Renamed on the way in, as everywhere else. */
  daysCount: number;
  totalHalalas: number;
  commissionHalalas: number;
  netToLessorHalalas: number;
  payoutHeld?: boolean | null;
  unit: { id: string; title: string };
  renter: AdminBookingParty;
  lessor: AdminBookingParty;
  createdAt: string;
  confirmedAt?: string | null;
}

export function adminBookingFromWire(wire: WireAdminBooking): AdminBookingRow {
  return {
    id: wire.id,
    referenceNo: wire.referenceNo,
    status: wire.status,
    startDate: wire.startDate,
    endDate: wire.endDate,
    nights: wire.daysCount,
    totalHalalas: wire.totalHalalas,
    commissionHalalas: wire.commissionHalalas,
    netToLessorHalalas: wire.netToLessorHalalas,
    // A hold is a fact about money and reads as false only when the server
    // said so; a missing key is the same as no hold on this endpoint.
    payoutHeld: wire.payoutHeld ?? false,
    unit: { ...wire.unit },
    renter: { ...wire.renter },
    lessor: { ...wire.lessor },
    createdAt: wire.createdAt,
    confirmedAt: wire.confirmedAt ?? null,
  };
}

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
  /** Which kind of administrator. Absent on a renter or a lessor. */
  adminRole?: AdminRole | null;
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

/*
 * Complaints — FR-ADM-08 — are in `complaint.ts`, with the wire types and the
 * adapters beside them. What used to be here was drawn before the endpoints
 * shipped and had a `DisputeStatus` of four values, one `resolution` string
 * and a boolean for cancelling the booking. The real thing has five statuses,
 * six resolutions, attachments, a reply deadline and a permission split inside
 * the resolution — none of which a screen can be talked into by a shape.
 */

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
  /** Which kind of administrator acted. Absent when it was not one. */
  actorAdminRole?: AdminRole | null;
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
