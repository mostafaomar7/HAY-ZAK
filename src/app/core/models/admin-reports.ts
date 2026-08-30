import type { BookingStatus } from '../enums/booking-status.enum';
import type { ComplaintStatus } from '../enums/complaint.enum';
import type { UnitStatus } from '../enums/unit-status.enum';
import type { AccountStatus, UserRole } from '../enums/user-role.enum';

/**
 * The reports (FR-RPT) — `reports:view`, which all three administrators hold.
 *
 * **The one thing to get right here is which number is revenue.**
 *
 * `grossHalalas` on the bookings report is what renters paid. The platform
 * does not keep it: most of it is owed to lessors, some is VAT owed to ZATCA,
 * and only the commission is income. Writing "الإيرادات" above `grossHalalas`
 * overstates revenue by the value of every booking on the platform, which is
 * the classic marketplace accounting error and the kind that survives all the
 * way to a board pack.
 *
 * `commissionHalalas` on the revenue report is the revenue. It is already net
 * of refunds.
 */

// ── Overview ──────────────────────────────────────────────────────────────

/**
 * The platform as it stands, with **no date filter** — deliberately.
 *
 * "42 listings published in March" is not a sentence that means anything: a
 * listing is published or it is not, today. Counts of what exists cannot be
 * windowed, and offering the control would invite a question the number does
 * not answer.
 *
 * Every bucket carries every key, zeros included, so nothing downstream needs
 * a `?? 0` — and a `?? 0` would hide a block the server stopped sending.
 */
export interface AdminOverview {
  users: {
    byRole: Record<UserRole, number>;
    byStatus: Record<AccountStatus, number>;
  };
  units: Record<UnitStatus, number>;
  bookings: Record<BookingStatus, number>;
  complaints: Record<ComplaintStatus, number> & {
    /** Past their reply deadline — the number an operations lead acts on. */
    overdue: number;
  };
  payouts: {
    APPROVED: PayoutBucket;
    PAID: PayoutBucket;
    FAILED: PayoutBucket;
  };
}

export interface PayoutBucket {
  count: number;
  totalHalalas: number;
}

// ── Dated reports ─────────────────────────────────────────────────────────

/** Both ends are optional and independent. A malformed date is a 422. */
export interface ReportRange {
  /** `YYYY-MM-DD`. */
  from?: string;
  /** `YYYY-MM-DD`. */
  to?: string;
}

export interface BookingsReport {
  count: number;
  /**
   * **What renters paid. Not revenue.** The platform keeps the commission out
   * of this and owes the rest onward — see `RevenueReport`.
   */
  grossHalalas: number;
  byStatus: Record<BookingStatus, number>;
}

/**
 * Where the money actually stands.
 *
 * Two of these are liabilities rather than income, and they are named that way
 * on screen: money held for somebody else is not money earned.
 */
export interface RevenueReport {
  /** Cash sitting with the platform, whoever it ultimately belongs to. */
  netCashHalalas: number;
  /** The revenue, net of refunds. */
  commissionHalalas: number;
  /** A liability — held, not earned. */
  owedToLessorsHalalas: number;
  /** A liability — owed to ZATCA. */
  vatPayableHalalas: number;
  refundedHalalas: number;
  paidOutHalalas: number;
}

export interface LessorReportRow {
  lessorId: string;
  lessorName: string;
  unitsCount: number;
  bookingsCount: number;
  grossHalalas: number;
  commissionHalalas: number;
  netToLessorHalalas: number;
}

// ── Wire ──────────────────────────────────────────────────────────────────

export interface WireOverviewResponse {
  overview: AdminOverview;
}

export interface WireBookingsReportResponse {
  report: BookingsReport;
}

export interface WireRevenueReportResponse {
  report: RevenueReport;
}
