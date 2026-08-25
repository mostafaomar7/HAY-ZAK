import type {
  DisputeStatus,
  LegalDocumentType,
  NotificationChannel,
  NotificationType,
} from '../enums/operations.enum';
import type { CommissionBearer, VatBase } from '../constants/app.constants';
import type { BookingStatus } from '../enums/booking-status.enum';
import type { UnitStatus } from '../enums/unit-status.enum';
import type { LessorEarnings } from './payment.model';

/** ERD-5 `disputes`. */
export interface Dispute {
  id: string;
  bookingId: string;
  bookingReferenceNo: string;
  raisedBy: string;
  description: string;
  status: DisputeStatus;
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  attachments: DisputeAttachment[];
  createdAt: string;
}

export interface DisputeAttachment {
  id: string;
  url: string;
  fileName: string;
}

/** ERD-5 `notifications` — the in-app inbox. */
export interface AppNotification {
  id: string;
  /**
   * Widened past the enum on purpose: the server adds a type whenever a module
   * ships, and a value this build has not heard of must still render. The title
   * and body arrive already written, so nothing needs to recognise it.
   */
  type: NotificationType | string;
  title: string;
  body: string;
  /** In-app only for now; the API sends no channel on the inbox. */
  channel?: NotificationChannel;
  /**
   * When it was read, or null.
   *
   * `readAt` rather than `isRead` because that is what the API stores, and
   * because "read at 09:14" is a fact a boolean throws away. `isRead` below is
   * derived from it.
   */
  readAt?: string | null;
  isRead: boolean;
  /** What it is about — the deep link is built from this, not sent. */
  reference?: { type: string; id: string };
  /** Deep link into the related booking or unit, resolved by the client. */
  targetUrl?: string;
  createdAt: string;
}

/** ERD-5 `audit_logs` — append-only (FR-ADM-09). */
export interface AuditLogEntry {
  id: string;
  actorUserId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress: string;
  createdAt: string;
}

/** ERD-5 `cms_pages` — FR-CMS-01. */
export interface CmsPage {
  slug: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
}

/** ERD-5 `terms_versions` — FR-ADM-07, versioned for provable consent. */
export interface TermsVersion {
  id: string;
  versionNo: string;
  documentType: LegalDocumentType;
  content: string;
  effectiveFrom: string;
}

/**
 * ERD-5 `settings` — the runtime configuration FR-ADM-06 exposes. Read this
 * at bootstrap rather than trusting the compiled-in defaults.
 */
export interface PlatformSettings {
  commissionRateBps: number;
  commissionBearer: CommissionBearer;
  vatRateBps: number;
  vatBase: VatBase;
  payoutCycleHours: number;
  approvalSlaHours: number;
  /** FR-ADM-12 — the auto-approval switch, built in from day one (SRS §2.1). */
  autoApproveBookings: boolean;
  cancellationPolicy: CancellationRule[];
}

/** FR-BKG-08 — refund tiers, configurable from the admin panel. */
export interface CancellationRule {
  /** Cancelling at least this many days before the start date… */
  minDaysBeforeStart: number;
  /** …refunds this share of the booking value (0–1). */
  refundPercentage: number;
}

/** FR-ADM-01 — the operations KPI dashboard. */
export interface AdminDashboardKpis {
  usersByRole: Record<string, number>;
  unitsByStatus: Record<string, number>;
  bookingsCount: number;
  grossCollection: number;
  totalCommission: number;
  occupancyRate: number;
  pendingListings: number;
  /** Bookings past the approval SLA (UC-03 alternate flow). */
  slaBreaches: number;
}

/**
 * FR-LSR-01 — the lessor's landing screen, in one request.
 *
 * Every status key is always present, zero included. Nothing here may be read
 * with `?? 0`: a missing key would mean the server changed its vocabulary, and
 * quietly rendering nought would hide that behind a plausible number.
 */
export interface LessorDashboard {
  units: Record<UnitStatus, number>;
  bookings: Record<BookingStatus, number>;
  earnings: LessorEarnings;
  unreadNotifications: number;
}
