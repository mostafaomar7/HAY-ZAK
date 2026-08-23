import type {
  DisputeStatus,
  LegalDocumentType,
  NotificationChannel,
  NotificationType,
} from '../enums/operations.enum';
import type { CommissionBearer, VatBase } from '../constants/app.constants';

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
  type: NotificationType;
  title: string;
  body: string;
  channel: NotificationChannel;
  isRead: boolean;
  /** Deep link into the related booking or unit. */
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
  commissionRate: number;
  commissionBearer: CommissionBearer;
  vatRate: number;
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
  pendingBookings: number;
  /** Bookings past the approval SLA (UC-03 alternate flow). */
  slaBreaches: number;
}

/** FR-LSR-01 — the lessor dashboard. */
export interface LessorDashboard {
  totalUnits: number;
  availableUnits: number;
  bookedUnits: number;
  activeBookings: number;
  totalReceivable: number;
  recentNotifications: AppNotification[];
}
