import type { WirePublicUnit } from '../models/public-unit';
import type { WireAvailabilityBlock, WireUnit, WireUnitImage } from '../models/unit-wire';
import { clockToMinutes } from '../models/unit-wire';
import type { Unit, UnitAvailabilityBlock } from '../models/unit.model';

/**
 * Fixtures, in the shape the API sends them.
 *
 * The mock exists to let a screen be walked before the backend is reachable,
 * and it is only worth anything if it answers with what the backend answers
 * with. A mock that returned the application's own model would let every
 * conversion in `unit-wire.ts` be wrong without a single test noticing — the
 * demo would work perfectly and the real server would not.
 *
 * So the fixtures stay written in the domain model, where they are readable,
 * and are pushed back through the wire shape on the way out.
 */

function toWireImage(image: Unit['images'][number]): WireUnitImage {
  return {
    id: image.id,
    url: image.url,
    contentType: image.contentType ?? 'image/jpeg',
    sizeBytes: image.sizeBytes,
    sortOrder: image.sortOrder,
  };
}

export function toWireBlock(block: UnitAvailabilityBlock): WireAvailabilityBlock {
  return {
    id: block.id,
    // Instants at UTC midnight, exactly as the server sends dates back.
    startDate: `${block.startDate}T00:00:00.000Z`,
    endDate: `${block.endDate}T00:00:00.000Z`,
    reason: block.reason,
    note: block.note ?? null,
    bookingId: block.bookingId ?? null,
  };
}

/**
 * One unit as the API sends it.
 *
 * `detail` decides which projection: a list row carries a cover and a count, a
 * detail carries the images, the pin and the calendar. Serving the detail shape
 * from a list is how a card ends up reading `images[0]` and working in the mock
 * only.
 */
export function toWireUnit(
  unit: Unit,
  options: { detail?: boolean; availability?: readonly UnitAvailabilityBlock[] } = {},
): WireUnit {
  const window = unit.visitSchedule[0];
  const images = unit.images.map(toWireImage);

  const base: WireUnit = {
    id: unit.id,
    title: unit.title,
    description: unit.description,
    areaSqm: unit.areaSqm,
    dailyPriceHalalas: unit.dailyPriceHalalas,
    categoryId: unit.categoryId,
    cityId: unit.cityId,
    districtId: unit.districtId || null,
    addressLine: unit.addressLine ?? null,
    visitHoursFrom: window ? clockToMinutes(window.from) : null,
    visitHoursTo: window ? clockToMinutes(window.to) : null,
    minDays: unit.minDays ?? null,
    maxDays: unit.maxDays ?? null,
    status: unit.status,
    publishedAt: unit.publishedAt ?? null,
    rejectionReason: unit.rejectionReason ?? null,
    reviewedAt: unit.reviewedAt ?? null,
    createdAt: unit.createdAt,
    updatedAt: unit.publishedAt ?? unit.createdAt,
    lessor: unit.lessorId
      ? { id: unit.lessorId, fullName: unit.lessorName ?? 'خالد العتيبي', mobile: '+966500000002' }
      : null,
    category: unit.category ?? null,
    city: unit.city ?? null,
    district: unit.district ?? null,
  };

  if (!options.detail) {
    return { ...base, coverUrl: images[0]?.url ?? null, imageCount: images.length };
  }

  return {
    ...base,
    images,
    location: unit.location,
    availability: (options.availability ?? []).map(toWireBlock),
  };
}

/**
 * One unit as `/public/units` sends it.
 *
 * A different projection from `toWireUnit`, not a subset of it: the public
 * catalogue withholds the owner, the status and the real location, and adds
 * two fields the lessor's view has no room for — the radius of the circle the
 * space sits inside, and a monthly figure the server computes and stores
 * nowhere. Deriving this from the lessor shape would have meant the mock
 * quietly serving an owner name that the real endpoint never returns.
 *
 * The point is displaced here as well. The fixtures hold true coordinates, and
 * a mock that handed them over unchanged would let a pin be drawn against it
 * successfully and then be wrong in production, which is the exact failure the
 * circle exists to prevent.
 */
export function toWirePublicUnit(unit: Unit, options: { detail?: boolean } = {}): WirePublicUnit {
  const window = unit.visitSchedule[0];
  const radiusMeters = 300;

  const base: WirePublicUnit = {
    id: unit.id,
    title: unit.title,
    areaSqm: unit.areaSqm,
    dailyPriceHalalas: unit.dailyPriceHalalas,
    indicativeMonthlyHalalas: unit.dailyPriceHalalas * 30,
    minDays: unit.minDays ?? null,
    maxDays: unit.maxDays ?? null,
    category: unit.category ?? null,
    city: unit.city ?? null,
    district: unit.district ?? null,
    coverUrl: unit.coverUrl ?? unit.images[0]?.url ?? null,
    location: { ...displace(unit), radiusMeters, isApproximate: true },
    // Null unless the query carried a point, exactly as the server answers.
    distanceMeters: null,
    isFullyBooked: unit.isFullyBooked ?? false,
    publishedAt: unit.publishedAt ?? unit.createdAt,
  };

  if (!options.detail) return base;

  return {
    ...base,
    description: unit.description,
    visitHours: window
      ? { fromMinutes: clockToMinutes(window.from), toMinutes: clockToMinutes(window.to) }
      : null,
    images: unit.images.map((image) => ({
      id: image.id,
      url: image.url,
      width: null,
      height: null,
      sortOrder: image.sortOrder,
    })),
  };
}

/**
 * Moves the point off the real one, the same way every time for a given unit.
 *
 * Stable per id because the server's is: a circle that jumped between the list
 * and the details page would look like a bug in the map rather than the
 * deliberate imprecision it is.
 */
function displace(unit: Unit): { latitude: number; longitude: number } {
  let hash = 0;
  for (const char of unit.id) hash = (hash * 31 + char.charCodeAt(0)) % 100_000;

  // Up to ~180 m, which is what a 300 m circle allows without the space
  // falling outside it.
  const angle = (hash / 100_000) * Math.PI * 2;
  const metres = 60 + (hash % 120);
  const perDegree = 111_320;

  return {
    latitude: round6(unit.location.latitude + (Math.sin(angle) * metres) / perDegree),
    longitude: round6(
      unit.location.longitude +
        (Math.cos(angle) * metres) /
          (perDegree * Math.cos((unit.location.latitude * Math.PI) / 180)),
    ),
  };
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}
