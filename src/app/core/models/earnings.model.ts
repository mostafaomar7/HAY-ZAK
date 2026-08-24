import type { PayoutStatus } from '../enums/payment.enum';

/**
 * Lives in core, not the lessor feature: it is an API contract, core must not
 * depend on features, and the mock backend needs it too.
 *
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
  payoutStatus: PayoutStatus;
  /** Present once the transfer has executed. */
  bankReference?: string;
  transferredAt?: string;
  /** Why a payout is frozen — shown inline under the row (UC-04). */
  holdReason?: string;
}

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
