import { environment } from '../../../environments/environment';
import type { AvailabilityBlockReason, UnitStatus } from '../enums/unit-status.enum';
import type {
  GeoPoint,
  ReferenceItem,
  Unit,
  UnitAvailabilityBlock,
  UnitImage,
  UnitRequest,
  VisitWindow,
  Weekday,
} from './unit.model';

/**
 * The boundary between what the API sends and what the application models.
 *
 * Three things differ, and each is handled here rather than in the screens that
 * would otherwise each have to know:
 *
 * 1. **Dates.** The server takes plain `YYYY-MM-DD` and returns instants at UTC
 *    midnight. Parsing one of those with `new Date()` and reading its local day
 *    is right in +03 and wrong in the Americas, and the bug only ever appears
 *    on somebody else's machine.
 * 2. **Visiting hours.** The API stores one window for the whole week as
 *    minutes since midnight; the design (FR-UNT-06) has a row per group of
 *    days. Converting is lossy in one direction, which is stated at the
 *    function that loses it.
 * 3. **Files.** Image URLs are relative to the API's *origin*, not to
 *    `/api/v1`.
 *
 * Everything else passes through unchanged: money is already integer halalas
 * and identifiers are already strings.
 */

/** A unit exactly as the API sends one. Nothing outside this file reads it. */
export interface WireUnit {
  id: string;
  title: string;
  description: string;
  areaSqm: number;
  dailyPriceHalalas: number;
  categoryId: string;
  cityId: string;
  districtId: string | null;
  addressLine: string | null;
  /** Minutes since midnight — 540 is 09:00. */
  visitHoursFrom: number | null;
  visitHoursTo: number | null;
  minDays: number | null;
  maxDays: number | null;
  status: UnitStatus;
  publishedAt: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;

  // Present on the detail projection.
  location?: GeoPoint | null;
  images?: WireUnitImage[];
  availability?: WireAvailabilityBlock[];

  // Present on the list projection instead of the images themselves.
  coverUrl?: string | null;
  imageCount?: number;

  // Present on the administration projection, already resolved.
  lessor?: { id: string; fullName: string; mobile: string } | null;
  category?: ReferenceItem | null;
  city?: ReferenceItem | null;
  district?: ReferenceItem | null;
}

export interface WireUnitImage {
  id: string;
  url: string;
  contentType?: string;
  sizeBytes: number;
  sortOrder: number;
}

export interface WireAvailabilityBlock {
  id: string;
  /** An instant at UTC midnight, despite being a date. */
  startDate: string;
  endDate: string;
  reason: AvailabilityBlockReason;
  note?: string | null;
  bookingId?: string | null;
}

/** What `POST` and `PATCH /lessor/units` accept. */
export interface WireUnitRequest {
  title: string;
  description: string;
  areaSqm: number;
  dailyPriceHalalas: number;
  categoryId: string;
  cityId: string;
  districtId?: string;
  addressLine?: string;
  visitHoursFrom?: number;
  visitHoursTo?: number;
  minDays?: number;
  maxDays?: number;
  /** Flat on the way in, nested as `location` on the way out. */
  latitude?: number;
  longitude?: number;
}

const EVERY_DAY: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

// ── Dates ────────────────────────────────────────────────────────────────────
//
// Availability and bookings send plain `YYYY-MM-DD` in both directions now, and
// an instant on the way in is a 422 — so there is nothing left to convert. A
// `plainFromWire` used to take the date part of an instant here; it is gone
// rather than kept as a defensive slice, because a coercion that silently
// accepts the wrong shape is how a broken contract stays invisible.

// ── Visiting hours ───────────────────────────────────────────────────────────

/** 540 becomes "09:00". */
export function minutesToClock(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** "09:00" becomes 540. */
export function clockToMinutes(clock: string): number {
  const [hours = '0', minutes = '0'] = clock.split(':');
  return Number(hours) * 60 + Number(minutes);
}

/**
 * The single stored window, as a schedule the screens can render.
 *
 * Always one row covering every day, because that is all the API holds. A unit
 * whose lessor entered "Sunday to Thursday" reads back as "all week" — the
 * information was never stored, so this reports the gap rather than causing it.
 */
export function scheduleFromWire(from: number | null, to: number | null): VisitWindow[] {
  if (from === null || to === null) return [];
  return dailySchedule(minutesToClock(from), minutesToClock(to));
}

/**
 * One window, every day — the only schedule the API can hold.
 *
 * The editor builds its answer through here rather than assembling a
 * `VisitWindow` itself, so the one place that knows the storage is lossy is
 * also the one place that decides what the days are.
 */
export function dailySchedule(from: string, to: string): VisitWindow[] {
  if (!from || !to) return [];
  return [{ days: [...EVERY_DAY], from, to }];
}

/**
 * The widest window the schedule describes — earliest open, latest close.
 *
 * **Lossy, and the only honest reduction available.** The API stores one window
 * for the week, so a schedule of several rows has to become one, and narrowing
 * to the intersection would silently close hours the lessor said were open.
 * Widening errs towards a visit being possible, which the lessor can refuse; the
 * other way round turns visitors away at a door that is unlocked.
 */
export function scheduleToWire(schedule: readonly VisitWindow[]): {
  visitHoursFrom?: number;
  visitHoursTo?: number;
} {
  const valid = schedule.filter((window) => window.from && window.to);
  if (valid.length === 0) return {};

  return {
    visitHoursFrom: Math.min(...valid.map((window) => clockToMinutes(window.from))),
    visitHoursTo: Math.max(...valid.map((window) => clockToMinutes(window.to))),
  };
}

// ── Files ────────────────────────────────────────────────────────────────────

/**
 * An uploaded file's absolute URL.
 *
 * `/uploads/…` hangs off the API's origin, not off `/api/v1`, so appending it
 * to `environment.apiUrl` yields a 404 that renders as a broken image and gets
 * blamed on the upload.
 */
export function fileUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (/^(https?:|data:|blob:)/.test(path)) return path;

  try {
    return new URL(path, new URL(environment.apiUrl).origin).toString();
  } catch {
    // A relative `apiUrl` — the mock, and any same-origin deployment — means
    // the path already resolves against the document.
    return path;
  }
}

// ── Units ────────────────────────────────────────────────────────────────────

export function imageFromWire(image: WireUnitImage): UnitImage {
  return {
    id: image.id,
    url: fileUrl(image.url),
    sortOrder: image.sortOrder,
    sizeBytes: image.sizeBytes,
    contentType: image.contentType,
  };
}

export function blockFromWire(block: WireAvailabilityBlock): UnitAvailabilityBlock {
  return {
    id: block.id,
    startDate: block.startDate,
    endDate: block.endDate,
    reason: block.reason,
    note: block.note ?? null,
    bookingId: block.bookingId ?? undefined,
  };
}

export function unitFromWire(wire: WireUnit): Unit {
  const images = (wire.images ?? []).map(imageFromWire);

  return {
    id: wire.id,
    lessorId: wire.lessor?.id ?? '',
    lessorName: wire.lessor?.fullName,
    categoryId: wire.categoryId,
    category: wire.category ?? undefined,
    cityId: wire.cityId,
    districtId: wire.districtId ?? '',
    city: wire.city ?? undefined,
    district: wire.district ?? undefined,

    title: wire.title,
    description: wire.description,
    areaSqm: wire.areaSqm,
    dailyPriceHalalas: wire.dailyPriceHalalas,

    location: wire.location ?? { latitude: 0, longitude: 0 },
    // The API releases the exact pin together with the address, so one being
    // absent means the other is approximate too (FR-UNT-11).
    isApproximateLocation: !wire.addressLine,

    visitSchedule: scheduleFromWire(wire.visitHoursFrom, wire.visitHoursTo),
    minDays: wire.minDays ?? undefined,
    maxDays: wire.maxDays ?? undefined,
    addressLine: wire.addressLine ?? undefined,

    images,
    // The list projection sends a cover instead of the images; a card that read
    // `images[0]` would show nothing on every search result.
    coverUrl: wire.coverUrl ? fileUrl(wire.coverUrl) : images[0]?.url,
    imageCount: wire.imageCount ?? images.length,

    status: wire.status,
    rejectionReason: wire.rejectionReason ?? undefined,
    publishedAt: wire.publishedAt ?? undefined,
    reviewedAt: wire.reviewedAt ?? undefined,
    createdAt: wire.createdAt,
  };
}

/**
 * A unit request in the shape the API takes.
 *
 * Partial in and partial out: `PATCH` is given only what changed, and the draft
 * the form saves after step 1 does not have step 3 filled in yet. The server
 * decides what a create is missing — a client-side required-field list here
 * would be a second copy of a rule only one of the two enforces.
 */
export function unitToWire(request: Partial<UnitRequest>): Partial<WireUnitRequest> {
  return {
    title: request.title,
    description: request.description,
    areaSqm: request.areaSqm,
    dailyPriceHalalas: request.dailyPriceHalalas,
    categoryId: request.categoryId,
    cityId: request.cityId,
    districtId: request.districtId || undefined,
    addressLine: request.addressLine || undefined,
    ...scheduleToWire(request.visitSchedule ?? []),
    minDays: request.minDays,
    maxDays: request.maxDays,
    latitude: request.location?.latitude,
    longitude: request.location?.longitude,
  };
}
