import type { BookingUnitRef } from './renter-booking';

/**
 * The ZATCA tax invoice a paid booking produces (FR-PAY-09, RNT-07).
 *
 * `GET /renter/bookings/:id/invoice` answers with it, and only once the
 * booking is CONFIRMED: before payment there is nothing to invoice and the
 * endpoint is a 404 `INVOICE_NOT_FOUND`, which is the page's "not ready yet"
 * state rather than an error to report.
 *
 * There is **no PDF**. `Accept: application/pdf` comes back as this same JSON,
 * so the page renders the document from the figures and prints through the
 * browser. That reads correctly on a phone, in RTL, and to a screen reader —
 * but the legal artefact is still owed, and it is open item 21 with the
 * backend. Nothing here should link to a file that does not exist.
 */
/**
 * Which of the two documents a booking produces.
 *
 * `BOOKING` is what the renter paid; `COMMISSION` is what the platform billed
 * the lessor out of it. **The same booking has one of each**, with different
 * totals, and `/me/invoices` returns both to whichever party they are addressed
 * to — so a screen that lists invoices without rendering this shows two
 * conflicting amounts for one reference number and explains neither.
 */
export type InvoiceType = 'BOOKING' | 'COMMISSION';

export interface TaxInvoice {
  id: string;
  /** `INV-2026-000041`. Quoted on correspondence about the payment. */
  invoiceNo: string;
  type: InvoiceType;
  /** An instant, not a plain date — the moment of issue. */
  issuedAt: string;
  /** The amount VAT is charged on, before it. */
  taxableHalalas: number;
  vatHalalas: number;
  totalHalalas: number;
  /**
   * The rate this document was issued under, in basis points.
   *
   * Carried on the invoice rather than read from configuration on the way to
   * the screen: the platform's VAT setting is an administrator's to change,
   * and an invoice re-rendered next year must still state the rate that was
   * actually applied to it. Currently `0` on this server.
   */
  vatRateBps: number;
  /** The ZATCA QR payload. `null` until the backend generates it — item 22. */
  qrCode: string | null;
  /** Enough of the booking to render the document without a second call. */
  booking: TaxInvoiceBooking;
}

/**
 * The booking as the invoice carries it — thinner than `RenterBooking`.
 *
 * No status, no contact, no address: an invoice is between the renter and the
 * platform, and the owner is not identified to the renter (SRS §5).
 */
export interface TaxInvoiceBooking {
  id: string;
  referenceNo: string;
  startDate: string;
  /** Half-open, as everywhere else — the day of departure. */
  endDate: string;
  /** Nights. `daysCount` on the wire; renamed on the way in, as on a booking. */
  nights: number;
  unit: Pick<BookingUnitRef, 'id' | 'title'>;
}

// ── Wire ──────────────────────────────────────────────────────────────────

export interface WireTaxInvoice {
  id: string;
  invoiceNo: string;
  type: InvoiceType;
  issuedAt: string;
  taxableHalalas: number;
  vatHalalas: number;
  totalHalalas: number;
  vatRateBps: number;
  qrCode: string | null;
  booking: {
    id: string;
    referenceNo: string;
    startDate: string;
    endDate: string;
    daysCount: number;
    unit: { id: string; title: string };
  };
}

/** The endpoint wraps it. */
export interface WireTaxInvoiceResponse {
  invoice: WireTaxInvoice;
}

// ── Adapter ───────────────────────────────────────────────────────────────

export function taxInvoiceFromWire(wire: WireTaxInvoice): TaxInvoice {
  return {
    id: wire.id,
    invoiceNo: wire.invoiceNo,
    type: wire.type,
    issuedAt: wire.issuedAt,
    taxableHalalas: wire.taxableHalalas,
    vatHalalas: wire.vatHalalas,
    totalHalalas: wire.totalHalalas,
    vatRateBps: wire.vatRateBps,
    qrCode: wire.qrCode,
    booking: {
      id: wire.booking.id,
      referenceNo: wire.booking.referenceNo,
      startDate: wire.booking.startDate,
      endDate: wire.booking.endDate,
      nights: wire.booking.daysCount,
      unit: { ...wire.booking.unit },
    },
  };
}
