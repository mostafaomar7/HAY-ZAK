import type { BookingStatus } from '../enums/booking-status.enum';
import type { PaginationParams } from './api-response.model';
import type { Unit } from './unit.model';

/** ERD-3 `bookings` — the core commercial transaction. */
export interface Booking {
  id: string;
  /** FR-BKG-09 — used in all correspondence and support. */
  referenceNo: string;

  unitId: string;
  /**
   * `addressLine` is present only once the booking is approved — the API applies
   * FR-UNT-11 by omitting it, so the renter's screen has nothing to leak.
   */
  unit?: Pick<
    Unit,
    'id' | 'title' | 'images' | 'city' | 'district' | 'visitSchedule' | 'addressLine' | 'postalCode'
  >;
  renterId: string;

  startDate: string;
  endDate: string;
  daysCount: number;

  /**
   * The price at the moment of booking. A later edit by the lessor must never
   * change the value of an existing booking (SRS §7.7 design decision).
   */
  dailyPriceSnapshotHalalas: number;
  subtotalHalalas: number;
  commissionHalalas: number;
  vatHalalas: number;
  totalHalalas: number;
  netToLessorHalalas?: number;

  goodsDescription: string;
  prohibitedAck: boolean;

  status: BookingStatus;
  /** Only populated once the state releases them (§5, FR-LSR-09). */
  counterpartyContact?: CounterpartyContact;

  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  /** FR-BKG-05 — when the 15-minute payment hold lapses. */
  holdExpiresAt?: string;
  createdAt: string;
}

/** Released to both sides only after approval — never before. */
export interface CounterpartyContact {
  fullName: string;
  mobile: string;
}

/** ERD-3 `booking_status_history` — the evidence trail in any dispute. */
export interface BookingStatusHistoryEntry {
  fromStatus: BookingStatus | null;
  toStatus: BookingStatus;
  changedBy?: string;
  reason?: string;
  changedAt: string;
}

export interface BookingDraftRequest {
  unitId: string;
  startDate: string;
  daysCount: number;
}

/** FR-BKG-03/04 — both are mandatory before payment. */
export interface BookingConfirmRequest {
  goodsDescription: string;
  prohibitedAck: true;
}

export interface BookingSearchParams extends PaginationParams {
  status?: BookingStatus;
  fromDate?: string;
  toDate?: string;
  cityId?: string;
  categoryId?: string;
  lessorId?: string;
}

/** FR-ADM-04 — a rejection reason is mandatory. */
export interface BookingDecisionRequest {
  approved: boolean;
  reason?: string;
}
