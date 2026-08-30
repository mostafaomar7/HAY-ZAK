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
 * The buckets are **partial**, despite the handover saying otherwise: `GUEST`
 * never appears under `byRole`, and only the booking statuses that exist are
 * listed. So every screen iterates what it is given rather than indexing keys
 * it expects — which is also why a missing status shows as an absent row and
 * not as a zero the server never sent.
 */
export interface AdminOverview {
  users: {
    // Partial because the server sends only the roles it has: `GUEST` never
    // appears, and `DELETED` does. A total record would have made a missing
    // key a type error rather than a zero.
    byRole: Partial<Record<UserRole, number>>;
    byStatus: Partial<Record<AccountStatus, number>>;
  };
  units: Partial<Record<UnitStatus, number>>;
  bookings: Partial<Record<BookingStatus, number>>;
  complaints: Partial<Record<ComplaintStatus, number>> & {
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
  bookingsCount: number;
  /**
   * **What renters paid. Not revenue.** The platform keeps the commission out
   * of this and owes the rest onward — see `RevenueReport`.
   */
  grossHalalas: number;
  /**
   * The commission these bookings *should* produce.
   *
   * Still not revenue: it is what is expected on bookings in this window,
   * before refunds. `RevenueReport.commissionHalalas` is the figure net of
   * them, and the two will differ whenever anything was refunded.
   */
  expectedCommissionHalalas: number;
  lessorShareHalalas: number;
  averageBookingHalalas: number;
  /** Nights, averaged — a fraction, not a count. */
  averageDays: number;
  /** Only the statuses actually present, so a partial record. */
  byStatus: Partial<Record<BookingStatus, number>>;
  topCities: CityBookings[];
}

export interface CityBookings {
  id: string;
  nameAr: string;
  nameEn: string;
  bookings: number;
  grossHalalas: number;
}

/**
 * Where the money actually stands.
 *
 * Two of these are liabilities rather than income, and they are named that way
 * on screen: money held for somebody else is not money earned.
 */
export interface RevenueReport {
  /** Everything taken in, before anything was paid back out. */
  collectedHalalas: number;
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
  /** Nested on the wire, and the id is the row's key. */
  lessor: { id: string; fullName: string };
  units: number;
  bookings: number;
  grossHalalas: number;
  /** What this lessor keeps — the platform's commission is already out of it. */
  earnedHalalas: number;
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
