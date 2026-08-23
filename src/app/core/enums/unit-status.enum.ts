/** FR-UNT-09. */
export enum UnitStatus {
  Draft = 'Draft',
  PendingReview = 'PendingReview',
  Rejected = 'Rejected',
  Published = 'Published',
  FullyBooked = 'FullyBooked',
  Suspended = 'Suspended',
  Archived = 'Archived',
}

/** Only these appear in the marketplace (FR-UNT-07). */
export const PUBLIC_UNIT_STATUSES: readonly UnitStatus[] = [
  UnitStatus.Published,
  UnitStatus.FullyBooked,
] as const;

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

/** unit_availability.reason. */
export enum AvailabilityBlockReason {
  Booking = 'Booking',
  ManualBlock = 'ManualBlock',
  Suspension = 'Suspension',
}
