/**
 * The reference lists as the console edits them (FR-ADM-05).
 *
 * **Nothing here is ever deleted.** Every list is deactivated instead
 * (`isActive: false`), because a category, a city or a prohibited item is
 * referenced by listings and bookings that must still read correctly years
 * later. There is no delete endpoint, and no screen should offer the word.
 *
 * A category with published listings under it will not even deactivate: 409
 * `CATEGORY_IN_USE`, carrying `meta.requested` — the number of listings. That
 * number belongs on screen. "فيه ٣١ إعلان منشور تحت التصنيف ده" is an
 * instruction; "تعذّر التعطيل" is a shrug.
 */

export type ReferenceKind = 'categories' | 'cities' | 'districts' | 'prohibited-items';

/** What every list has in common. */
export interface ReferenceEntry {
  id: string;
  nameAr: string;
  nameEn: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ReferenceCategory extends ReferenceEntry {
  /**
   * The stable identifier — lowercase letters, digits and hyphens.
   *
   * Separate from the name on purpose: renaming "مستودعات" to "مخازن" must not
   * change what a saved filter or an existing listing matches on.
   */
  slug: string;
  iconKey: string | null;
}

export type ReferenceCity = ReferenceEntry;

export interface ReferenceDistrict extends ReferenceEntry {
  cityId: string;
}

export interface ProhibitedItem extends ReferenceEntry {
  noteAr: string | null;
  noteEn: string | null;
}

/**
 * `GET /admin/reference` — everything the endpoint returns, active and
 * inactive alike.
 *
 * **Districts are not in it.** The routes to create and update one exist, so
 * the list is presumably still to come; until it does there is nothing to
 * show, and an empty array here would claim the server said there were none.
 */
export interface ReferenceData {
  categories: ReferenceCategory[];
  cities: ReferenceCity[];
  districts: ReferenceDistrict[] | null;
  prohibitedItems: ProhibitedItem[];
}

// ── Requests ──────────────────────────────────────────────────────────────
//
// Creating requires the names; updating is a partial, so a rename does not
// have to resend an icon key nobody touched.

export interface CategoryRequest {
  slug: string;
  nameAr: string;
  nameEn: string;
  iconKey?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CityRequest {
  nameAr: string;
  nameEn: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface DistrictRequest {
  cityId: string;
  nameAr: string;
  nameEn: string;
  isActive?: boolean;
}

export interface ProhibitedItemRequest {
  nameAr: string;
  nameEn: string;
  noteAr?: string;
  noteEn?: string;
  sortOrder?: number;
  isActive?: boolean;
}

// ── Wire ──────────────────────────────────────────────────────────────────

export interface WireReferenceData {
  categories?: ReferenceCategory[] | null;
  cities?: ReferenceCity[] | null;
  districts?: ReferenceDistrict[] | null;
  prohibitedItems?: ProhibitedItem[] | null;
}

/** What a 409 `CATEGORY_IN_USE` carries. */
export interface CategoryInUseMeta {
  requested: number;
}

// ── Adapter ───────────────────────────────────────────────────────────────

export function referenceDataFromWire(wire: WireReferenceData): ReferenceData {
  // Empty arrays rather than undefined: each of the four is read as `.length`
  // on the first render, before anything has been added.
  return {
    categories: wire.categories ?? [],
    cities: wire.cities ?? [],
    // Null, not `[]`: the endpoint does not send districts at all, and "the
    // server has none" is a different claim from "the server did not say".
    districts: wire.districts ?? null,
    prohibitedItems: wire.prohibitedItems ?? [],
  };
}

/** Lowercase letters, digits and hyphens — anything else is a 422. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}
