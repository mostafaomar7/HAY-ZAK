/**
 * FR-UNT-09, with the wire values the API sends.
 *
 * Six states, and no `FullyBooked` among them: whether a unit has free dates
 * left is a fact about its calendar, not a column on the row, and the server
 * reports it separately — see `Unit.isFullyBooked`.
 */
export enum UnitStatus {
  Draft = 'DRAFT',
  PendingReview = 'PENDING_REVIEW',
  Rejected = 'REJECTED',
  Published = 'PUBLISHED',
  Suspended = 'SUSPENDED',
  Archived = 'ARCHIVED',
}

/** Only these appear in the marketplace (FR-UNT-07). */
export const PUBLIC_UNIT_STATUSES: readonly UnitStatus[] = [UnitStatus.Published] as const;

/**
 * FR-UNT-04 — seeded from the admin panel, so this enum is a typed convenience
 * for the seed data, never a hard-coded list in the UI.
 *
 * OPEN: SRS §15 item 8 — the fourth category "qarashi" is transcribed as most
 * likely "garage"; awaiting written confirmation from the client.
 */
export enum UnitCategoryCode {
  Warehouse = 'warehouse',
  Room = 'room',
  OpenSpace = 'open_space',
  Garage = 'garage',
}

/** unit_availability.reason, as the API spells it. */
export enum AvailabilityBlockReason {
  Booking = 'BOOKING',
  ManualBlock = 'MANUAL_BLOCK',
  Suspension = 'SUSPENSION',
}
