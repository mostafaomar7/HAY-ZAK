import type { ReferenceItem, UnitImage } from './unit.model';
import { fileUrl, minutesToClock } from './unit-wire';

/**
 * The public catalogue — `GET /public/units` and `GET /public/units/:id`.
 *
 * A separate model from `Unit` on purpose. What a visitor is shown is not a
 * thinner `Unit`; it is a different object. It has no `lessorId`, no `status`,
 * no `createdAt` and no `addressLine`, and it carries one field `Unit` has no
 * room for — the radius of the circle the space is somewhere inside. Reusing
 * `Unit` would have meant inventing an owner and a status for every card, and
 * the first screen to trust one of those invented values would be wrong in a
 * way nothing here could catch.
 *
 * Both endpoints are open. They must be called **without** a bearer token even
 * when one is available: a signed-in visitor and a guest have to receive
 * byte-identical answers, and a token on this route is how that stops being
 * true.
 */

// ── The circle ────────────────────────────────────────────────────────────

/**
 * Where a space is, approximately — FR-UNT-11.
 *
 * This is **not** the location. The point is deliberately displaced from the
 * true one and the space sits somewhere inside the circle, not at its centre,
 * so the only honest drawing is the circle itself. A pin here is wrong by up
 * to `radiusMeters` while looking exact, which is worse than showing nothing.
 *
 * The displacement is stable per unit, so the circle does not shuffle between
 * pages and may be cached. The real point is released only after a booking is
 * confirmed, and there is no parameter on these endpoints that returns it.
 */
export interface ApproximateArea {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  /** Always true on the public catalogue. Kept so a reader has to acknowledge it. */
  isApproximate: boolean;
}

// ── Domain ────────────────────────────────────────────────────────────────

/** One card in the results (FR-MKT-08). */
export interface PublicUnitSummary {
  id: string;
  title: string;
  areaSqm: number;
  dailyPriceHalalas: number;
  /**
   * `dailyPriceHalalas × 30`, computed by the server and stored nowhere.
   *
   * Nobody is charged this and no unit is let by the month; it exists so a
   * daily rate can be compared against the monthly ones people are used to.
   * Every screen showing it must label it as indicative.
   */
  indicativeMonthlyHalalas: number;
  minDays: number | null;
  maxDays: number | null;
  category: ReferenceItem | null;
  city: ReferenceItem | null;
  district: ReferenceItem | null;
  /** Absolute, already resolved against the API origin. */
  coverUrl: string | null;
  area: ApproximateArea;
  /**
   * From the search origin, **rounded to the nearest 100 m** — and `null`
   * whenever the query carried no `lat`/`lng`. Present it as approximate;
   * printing "1,743 m" from a figure that is only accurate to 100 would be
   * claiming a precision the number does not have.
   */
  distanceMeters: number | null;
  /** FR-MKT-10 — listed but unbookable in the searched window. */
  isFullyBooked: boolean;
  publishedAt: string;
}

/** The details page (FR-MKT-09). */
export interface PublicUnit extends PublicUnitSummary {
  description: string;
  /**
   * A daily window, repeated every day, in Riyadh time — not an instant, and
   * not a per-day table. `null` when the lessor entered none.
   */
  visitWindow: { from: string; to: string } | null;
  images: UnitImage[];
}

// ── Query ─────────────────────────────────────────────────────────────────

export type PublicUnitSort = 'newest' | 'nearest' | 'priceAsc' | 'priceDesc';

/**
 * Every parameter `GET /public/units` accepts, and nothing else.
 *
 * The list is exhaustive by necessity: an unrecognised query parameter is a
 * 422, not something quietly dropped, so a stray key fails the whole search.
 * That is the good behaviour — it is what caught `limit` — but it means this
 * interface is the contract rather than a convenience.
 */
export interface PublicUnitQuery {
  cityId?: string;
  districtId?: string;
  /** One category. The API takes a single value; repeating it is a 422. */
  categoryId?: string;
  /** Free text, 2–80 characters. Shorter is a 422. */
  q?: string;
  /** Halalas, both of them. `minPrice=1000` is ten riyals. */
  minPrice?: number;
  maxPrice?: number;
  minArea?: number;
  maxArea?: number;
  /** Both or neither, and `radiusKm` means nothing without them. */
  lat?: number;
  lng?: number;
  /** Minimum 0.5; the server defaults to 25 when a point is given. */
  radiusKm?: number;
  /** Both or neither. Excludes anything booked in `[startDate, endDate)`. */
  startDate?: string;
  endDate?: string;
  sort?: PublicUnitSort;
  page?: number;
  /** Maximum 50. */
  pageSize?: number;
}

// ── Wire ──────────────────────────────────────────────────────────────────

interface WireArea {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isApproximate: boolean;
}

export interface WirePublicUnit {
  id: string;
  title: string;
  areaSqm: number;
  dailyPriceHalalas: number;
  indicativeMonthlyHalalas: number;
  minDays: number | null;
  maxDays: number | null;
  category: ReferenceItem | null;
  city: ReferenceItem | null;
  district: ReferenceItem | null;
  coverUrl: string | null;
  location: WireArea;
  distanceMeters: number | null;
  isFullyBooked: boolean;
  publishedAt: string;

  // Detail only.
  description?: string;
  visitHours?: { fromMinutes: number; toMinutes: number } | null;
  images?: {
    id: string;
    url: string;
    width: number | null;
    height: number | null;
    sortOrder: number;
  }[];
}

/** `GET /public/units/:id` wraps its answer. */
export interface WirePublicUnitDetail {
  unit: WirePublicUnit;
}

// ── Adapters ──────────────────────────────────────────────────────────────

/**
 * `location` is renamed to `area` on the way in.
 *
 * A field called `location` invites `[point]="unit.location"` and a pin; a
 * field called `area` does not read as a position, which is the whole point.
 */
export function publicUnitSummaryFromWire(wire: WirePublicUnit): PublicUnitSummary {
  return {
    id: wire.id,
    title: wire.title,
    areaSqm: wire.areaSqm,
    dailyPriceHalalas: wire.dailyPriceHalalas,
    indicativeMonthlyHalalas: wire.indicativeMonthlyHalalas,
    minDays: wire.minDays,
    maxDays: wire.maxDays,
    category: wire.category,
    city: wire.city,
    district: wire.district,
    // Served from the API's origin, not from under /api/v1.
    coverUrl: wire.coverUrl ? fileUrl(wire.coverUrl) : null,
    area: { ...wire.location },
    distanceMeters: wire.distanceMeters,
    isFullyBooked: wire.isFullyBooked,
    publishedAt: wire.publishedAt,
  };
}

export function publicUnitFromWire(wire: WirePublicUnit): PublicUnit {
  const hours = wire.visitHours;

  return {
    ...publicUnitSummaryFromWire(wire),
    description: wire.description ?? '',
    // Minutes since midnight, Riyadh. Formatted by arithmetic rather than by a
    // date library: there is no day to attach these to, and giving them one
    // invents a timezone conversion that then goes wrong twice a year.
    visitWindow: hours
      ? { from: minutesToClock(hours.fromMinutes), to: minutesToClock(hours.toMinutes) }
      : null,
    images: (wire.images ?? []).map((image) => ({
      id: image.id,
      url: fileUrl(image.url),
      sortOrder: image.sortOrder,
      // The catalogue does not send it, and a card has no use for it.
      sizeBytes: 0,
    })),
  };
}
