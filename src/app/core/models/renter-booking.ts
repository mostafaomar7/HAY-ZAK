import type { BookingStatus } from '../enums/booking-status.enum';
import type { ReferenceItem } from './unit.model';

/**
 * A booking as the two party-scoped endpoints send it (FR-BKG, FR-PAY).
 *
 * `GET /renter/bookings` and `GET /lessor/bookings` answer with the same
 * object, and the difference between them is the point: the lessor's `price`
 * carries the commission and what they will actually receive, and the renter's
 * does not carry those fields at all. The commission is deducted from the
 * lessor rather than added to the renter — 100 ﷼/day × 4 is 400 charged and 340
 * received — so a renter who saw either number would be reading somebody
 * else's arithmetic about a total they already paid in full.
 *
 * That is why `commission` is a separate optional branch rather than optional
 * fields on one price: a template that reaches for it has to acknowledge it
 * might not be there, and the renter's screens cannot silently render zero.
 *
 * There is no approval step. Payment confirms the booking, so there is no
 * "awaiting approval" screen to build, no approve/reject control for the
 * lessor — their screen is read-only — and no cancel button for anybody. A
 * problem with a booking is a complaint an administrator resolves.
 */

// ── Domain ────────────────────────────────────────────────────────────────

export interface BookingPrice {
  dailyPriceHalalas: number;
  subtotalHalalas: number;
  vatHalalas: number;
  /** What the renter is charged. The commission comes out of the lessor's side. */
  totalHalalas: number;
}

/** The lessor's half of the money. Never present on a renter's response. */
export interface BookingCommission {
  rateBps: number;
  commissionHalalas: number;
  netToLessorHalalas: number;
}

/**
 * The counterparty, released by confirmation and by nothing earlier.
 *
 * `null` until `CONFIRMED`, along with the unit's `addressLine`. Not an
 * oversight to be worked around: before payment the two parties have no
 * relationship, and the transaction has to stay inside the platform.
 */
export interface BookingContact {
  fullName: string;
  mobile: string;
}

export interface BookingUnitRef {
  id: string;
  title: string;
  /** Released with the contact, at `CONFIRMED`. */
  addressLine: string | null;
  city: ReferenceItem | null;
}

export interface RenterBooking {
  id: string;
  /** FR-BKG-09 — quoted in all correspondence. */
  referenceNo: string;
  status: BookingStatus;
  unit: BookingUnitRef;
  /** Plain `YYYY-MM-DD`, half-open: `endDate` is the day of departure. */
  startDate: string;
  endDate: string;
  /**
   * **Nights, not days.** 1 → 8 is seven of them, and the API counts it that
   * way. Every screen says "ليالٍ" for the same reason a hotel does: "٧ أيام"
   * next to dates a day apart is the kind of disagreement somebody notices
   * after they have paid.
   */
  nights: number;
  price: BookingPrice;
  /** Present only on the lessor's own view of a booking. */
  commission?: BookingCommission;
  goodsDescription: string;
  contact: BookingContact | null;
  confirmedAt: string | null;
  createdAt: string;
}

/** What `POST /renter/bookings` takes — the whole booking in one call. */
export interface CreateBookingRequest {
  unitId: string;
  startDate: string;
  /** Half-open. The day of departure, not the last night. */
  endDate: string;
  /** Refused under roughly ten characters — it is read before money moves. */
  goodsDescription: string;
  /** Must be `true`; `false` is a 422 on the field (FR-BKG-04). */
  prohibitedAck: true;
}

/**
 * A booking plus the deadline attached to it.
 *
 * `holdExpiresAt` sits beside the booking rather than inside it, on create and
 * on read alike, and it is `null` once there is nothing left to hold. Read it
 * from the response every time: a fifteen-minute timer started in the browser
 * outlives the hold on a slow connection, and somebody then walks into a
 * payment page for dates that are no longer theirs.
 */
export interface BookingWithHold {
  booking: RenterBooking;
  holdExpiresAt: string | null;
}

// ── Wire ──────────────────────────────────────────────────────────────────

interface WireBookingPrice {
  dailyPriceHalalas: number;
  subtotalHalalas: number;
  vatHalalas: number;
  totalHalalas: number;
  // Lessor only.
  commissionRateBps?: number;
  commissionHalalas?: number;
  netToLessorHalalas?: number;
}

export interface WireBooking {
  id: string;
  referenceNo: string;
  status: BookingStatus;
  unit: { id: string; title: string; addressLine: string | null; city: ReferenceItem | null };
  startDate: string;
  endDate: string;
  /** The API's name for the count. It is nights; renamed on the way in. */
  daysCount: number;
  price: WireBookingPrice;
  goodsDescription: string;
  contact: BookingContact | null;
  confirmedAt: string | null;
  createdAt: string;
}

export interface WireBookingWithHold {
  booking: WireBooking;
  holdExpiresAt: string | null;
}

/** `POST /renter/bookings/:id/pay`. */
export interface WirePaymentSession {
  redirectUrl: string;
}

// ── Adapter ───────────────────────────────────────────────────────────────

export function bookingFromWire(wire: WireBooking): RenterBooking {
  const price = wire.price;

  return {
    id: wire.id,
    referenceNo: wire.referenceNo,
    status: wire.status,
    unit: { ...wire.unit },
    startDate: wire.startDate,
    endDate: wire.endDate,
    // `daysCount` is the wire's word for it; the domain says what it counts.
    nights: wire.daysCount,
    price: {
      dailyPriceHalalas: price.dailyPriceHalalas,
      subtotalHalalas: price.subtotalHalalas,
      vatHalalas: price.vatHalalas,
      totalHalalas: price.totalHalalas,
    },
    // Only when the server actually sent it. Defaulting to zero would put
    // "عمولة المنصة: 0.00" on a lessor's screen during an outage.
    commission:
      price.commissionHalalas !== undefined && price.netToLessorHalalas !== undefined
        ? {
            rateBps: price.commissionRateBps ?? 0,
            commissionHalalas: price.commissionHalalas,
            netToLessorHalalas: price.netToLessorHalalas,
          }
        : undefined,
    goodsDescription: wire.goodsDescription,
    contact: wire.contact,
    confirmedAt: wire.confirmedAt,
    createdAt: wire.createdAt,
  };
}

export function bookingWithHoldFromWire(wire: WireBookingWithHold): BookingWithHold {
  return {
    booking: bookingFromWire(wire.booking),
    // `?? null` rather than passed through: on a booking that has already
    // EXPIRED the server omits the field entirely, and `undefined` reaching a
    // countdown reads as "no deadline set" in some places and as a deadline of
    // NaN in others.
    holdExpiresAt: wire.holdExpiresAt ?? null,
  };
}

/**
 * Nights between two plain dates, half-open — the same count the server does.
 *
 * String arithmetic through UTC midnight rather than local parsing: the
 * platform runs in +03, and `new Date('2028-03-01')` read as a local day is
 * the classic off-by-one that turns four nights into three.
 */
export function nightsBetween(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86_400_000));
}
