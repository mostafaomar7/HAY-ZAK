import type { AvailabilityBlockReason, UnitStatus } from '../enums/unit-status.enum';
import type { PaginationParams } from './api-response.model';

/** ERD-2 `categories` / `cities` / `districts` — bilingual reference data. */
export interface ReferenceItem {
  id: string;
  /**
   * Both languages, on every row.
   *
   * The running server sends `nameAr` and `nameEn` together and the reason is
   * good: a language switch then re-renders instead of re-fetching, and a list
   * cached under one locale can never be shown under the other. Read them
   * through `referenceName()` so no template branches on locale itself.
   */
  nameAr: string;
  nameEn: string;
  sortOrder?: number;
  /**
   * How many published units sit under this entry, for the landing page's
   * category tiles. The server counts it — a client that fetched every unit to
   * count them would be paging the whole catalogue to render four numbers.
   * Absent means "not counted", and the tile simply omits the line.
   */
  unitCount?: number;
}

export interface District extends ReferenceItem {
  cityId: string;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/** 0 = Sunday … 6 = Saturday, matching `Date.getDay()`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * One row of the visiting-hours table — a set of days that share an opening
 * window (FR-UNT-06).
 *
 * Structured rather than free text because three screens read it and one of
 * them writes it: the renter's details page groups the days, the lessor edits
 * them, and a booking carries them. A single string would have meant each
 * screen parsing prose, and no screen able to validate that the close is after
 * the open.
 */
export interface VisitWindow {
  days: Weekday[];
  /** "09:00" — 24-hour, zero-padded, no timezone. The platform runs on one. */
  from: string;
  to: string;
}

export interface UnitImage {
  id: string;
  /**
   * Server-relative, e.g. `/uploads/units/<id>/<file>.jpg`.
   *
   * Served from the API's **origin**, not from under `/api/v1` — resolve it
   * with `fileUrl()` rather than by concatenating `environment.apiUrl`, which
   * would produce a 404 that looks like a missing image.
   */
  url: string;
  sortOrder: number;
  sizeBytes: number;
  contentType?: string;
}

/** ERD-2 `units` — the smallest bookable object. */
export interface Unit {
  id: string;
  lessorId: string;
  lessorName?: string;
  categoryId: string;
  category?: ReferenceItem;
  cityId: string;
  districtId: string;
  city?: ReferenceItem;
  district?: ReferenceItem;

  title: string;
  description: string;
  areaSqm: number;
  dailyPriceHalalas: number;
  /** FR-UNT-05 — derived, shown for guidance only. */
  indicativeMonthlyPriceHalalas?: number;

  /**
   * FR-UNT-11 — before a booking is approved the API returns an approximate
   * point; the exact pin appears only once approval releases it.
   */
  location: GeoPoint;
  isApproximateLocation: boolean;
  /** Metres from the search origin, when the query supplied one. */
  distanceKm?: number;

  /**
   * The design's per-day table (FR-UNT-06).
   *
   * The API stores **one** window for the whole week — `visitHoursFrom` and
   * `visitHoursTo`, minutes since midnight — so a schedule that came from the
   * server is always a single row covering every day. `unit-wire.ts` does the
   * conversion and is the only place that knows about it; the gap is logged in
   * `docs/api/backend-notes.md`.
   */
  visitSchedule: VisitWindow[];
  minDays?: number;
  maxDays?: number;

  /**
   * FR-UNT-11 — the exact street address, released only once a booking on this
   * unit is approved. The API omits the field entirely until then, so
   * `undefined` means "not released to you", never "the lessor left it blank".
   */
  addressLine?: string;
  postalCode?: string;

  /**
   * Optional extras present in the design's step 1 but absent from SRS §4.3.
   * Flagged for confirmation — see the open items list in the README.
   */
  floor?: UnitFloor;
  perks?: string[];

  images: UnitImage[];
  /** The first image, when the list projection sends one instead of them all. */
  coverUrl?: string;
  imageCount?: number;
  status: UnitStatus;
  /**
   * No free dates in the window the marketplace searches (FR-MKT-10).
   *
   * A fact about the calendar rather than a status, which is why it is a flag
   * and not a seventh `UnitStatus`: a unit can be published and unbookable this
   * month and free the next, and nothing about the listing changed.
   *
   * The API does not send it yet, so it is optional and absent reads as "not
   * fully booked" — the badge simply does not appear. Deriving it here is not
   * an option: it would mean fetching the availability of every card in a
   * results page to render a label.
   */
  isFullyBooked?: boolean;
  rejectionReason?: string;
  publishedAt?: string;
  reviewedAt?: string;
  createdAt: string;
}

/** ERD-2 `unit_availability` — date ranges, never a binary flag (FR-UNT-08). */
export interface UnitAvailabilityBlock {
  id: string;
  /**
   * Plain `YYYY-MM-DD`, half-open: `endDate` is the first free day.
   *
   * The server accepts only plain dates and answers 422 for an instant, but
   * *returns* instants at UTC midnight. `unit-wire.ts` narrows them back on the
   * way in — parsing one with `new Date()` and reading its local day is the
   * classic off-by-one, and the platform runs in +03.
   */
  startDate: string;
  endDate: string;
  reason: AvailabilityBlockReason;
  /** The lessor's own note on a manual block. */
  note?: string | null;
  bookingId?: string;
}

/** "الدور" in the add-a-space form. */
export type UnitFloor = 'ground' | 'first' | 'basement' | 'roof' | 'annex';

export interface UnitRequest {
  categoryId: string;
  cityId: string;
  districtId: string;
  title: string;
  description: string;
  areaSqm: number;
  dailyPriceHalalas: number;
  location: GeoPoint;
  /**
   * Mandatory on the way in. The lessor always supplies it; whether a given
   * reader is allowed to see it is decided by the API on the way out
   * (FR-UNT-11), not by whether it was filled in.
   */
  addressLine: string;
  postalCode?: string;
  /**
   * The design's per-day table (FR-UNT-06).
   *
   * The API stores **one** window for the whole week — `visitHoursFrom` and
   * `visitHoursTo`, minutes since midnight — so a schedule that came from the
   * server is always a single row covering every day. `unit-wire.ts` does the
   * conversion and is the only place that knows about it; the gap is logged in
   * `docs/api/backend-notes.md`.
   */
  visitSchedule: VisitWindow[];
  minDays?: number;
  maxDays?: number;
  floor?: UnitFloor;
  perks?: string[];
}

/** FR-MKT-03/04/05/06 — the marketplace query. */
export interface UnitSearchParams extends PaginationParams {
  categoryId?: string;
  /**
   * The results page lets several categories be ticked at once, so the filter
   * panel sends this; `categoryId` stays for the single-category links that come
   * off the landing page tiles.
   */
  categoryIds?: string[];
  cityId?: string;
  districtId?: string;
  /** With `radiusKm`, drives the "nearest to me" query (NFR-PRF-02). */
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  minPriceHalalas?: number;
  maxPriceHalalas?: number;
  minArea?: number;
  maxArea?: number;
  /** FR-MKT-10 — units unavailable in this window are excluded. */
  availableFrom?: string;
  availableTo?: string;
  sortBy?: UnitSortOption;
}

export type UnitSortOption = 'nearest' | 'priceAsc' | 'newest';
