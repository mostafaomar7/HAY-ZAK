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
