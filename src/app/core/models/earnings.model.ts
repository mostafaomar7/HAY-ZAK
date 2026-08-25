/**
 * Lives in core, not the lessor feature: it is an API contract, core must not
 * depend on features, and the mock backend needs it too.
 */

/**
 * Where one booking's money sits — the same three buckets the summary uses.
 *
 * Not `PayoutStatus`: that describes a transfer, which several bookings share
 * and which does not exist at all until an operator approves one. Borrowing it
 * here meant a booking could read "APPROVED" before any payout covered it.
 *
 * Provisional: `/lessor/earnings/rows` is not shipped, so these names follow
 * the summary's rather than being read off a response.
 */
export type EarningsBucket = 'PENDING' | 'RELEASABLE' | 'PAID';

/**
 * One row of the dues table (LSR-07). Flattened for display: the API joins the
 * booking, its commission and its payout so the table needs no client-side
 * stitching.
 */
export interface EarningsRow {
  bookingId: string;
  bookingReferenceNo: string;
  unitTitle: string;
  startDate: string;
  endDate: string;
  /** Gross booking value. */
  grossHalalas: number;
  commissionHalalas: number;
  netHalalas: number;
  bucket: EarningsBucket;
  /** Present once the transfer has executed. */
  bankReference?: string;
  transferredAt?: string;
  /** Why this booking's money is not releasable yet — shown inline (UC-04). */
  holdReason?: string;
}

/** Riyals, unlike the halalas on the rows — this is the legacy table's own shape. */
export interface EarningsSummary {
  totalEarnings: number;
  transferred: number;
  pending: number;
  onHold: number;
}

export interface EarningsResponse {
  summary: EarningsSummary;
  rows: EarningsRow[];
}
