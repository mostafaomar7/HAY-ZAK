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

export interface ReferenceCity extends ReferenceEntry {
  /**
   * Nested, as `/public/cities` nests them, and there is no top-level
   * `districts` key — deliberately, on the server's part: a district without
   * its city is not an address.
   */
  districts: ReferenceDistrict[];
}

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
 * `districts` is **flattened here** out of `cities[].districts`, which is the
 * only place the wire carries them. Every district already names its `cityId`,
 * so nothing is invented by the flattening — and the console's districts tab
 * is one list of every district, not one list per city.
 */
export interface ReferenceData {
  categories: ReferenceCategory[];
  cities: ReferenceCity[];
  districts: ReferenceDistrict[];
  prohibitedItems: ProhibitedItem[];
}

// ── Requests ──────────────────────────────────────────────────────────────
//
// **`PUT` is a full replace, not a patch.** Sending `{ isActive: false }` alone
// is a 422 naming `nameAr` and `nameEn` — and `cityId` too, on a district. So
// every update resends the whole entry, and `requestFor()` below is what builds
// one from a row so no caller has to remember which fields its kind needs.

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

export type ReferenceRow = ReferenceCategory | ReferenceCity | ReferenceDistrict | ProhibitedItem;

export type ReferenceRequest =
  CategoryRequest | CityRequest | DistrictRequest | ProhibitedItemRequest;

/**
 * The whole entry as the server wants it back, with `changes` applied.
 *
 * Every `PUT` on these lists is a full replace: `{ isActive: false }` on its
 * own is a 422 asking for the names it was not sent. Deactivating a city, a
 * district or a prohibited item therefore has to resend everything the row
 * already had — which nobody was doing, so the toggle simply failed on three of
 * the four tabs.
 *
 * Built from the row rather than from the form, so an untouched field goes back
 * exactly as it came. The kind is read off the row's own shape: a category has
 * a `slug`, a district a `cityId`, a prohibited item its notes.
 */
export function requestFor(row: ReferenceRow, changes: Partial<ReferenceEntry> = {}) {
  const base = {
    nameAr: row.nameAr,
    nameEn: row.nameEn,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    ...changes,
  };

  if ('slug' in row) {
    return { ...base, slug: row.slug, iconKey: row.iconKey ?? undefined } as CategoryRequest;
  }
  if ('cityId' in row) {
    // A district has no `sortOrder` on the wire and the endpoint does not take
    // one; sending it would be an unknown field rather than a harmless extra.
    const { sortOrder: _sortOrder, ...rest } = base;
    return { ...rest, cityId: row.cityId } as DistrictRequest;
  }
  if ('noteAr' in row) {
    return {
      ...base,
      noteAr: row.noteAr ?? undefined,
      noteEn: row.noteEn ?? undefined,
    } as ProhibitedItemRequest;
  }
  return base as CityRequest;
}

// ── Wire ──────────────────────────────────────────────────────────────────

export interface WireReferenceCity extends ReferenceEntry {
  districts?: ReferenceDistrict[] | null;
}

export interface WireReferenceData {
  categories?: ReferenceCategory[] | null;
  cities?: WireReferenceCity[] | null;
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
  const cities: ReferenceCity[] = (wire.cities ?? []).map((city) => ({
    ...city,
    districts: city.districts ?? [],
  }));

  return {
    categories: wire.categories ?? [],
    cities,
    // One flat list for the districts tab, sorted the way each city sorts its
    // own — the wire has no global ordering to preserve, only a per-city one.
    districts: cities.flatMap((city) => city.districts),
    prohibitedItems: wire.prohibitedItems ?? [],
  };
}

/** Lowercase letters, digits and hyphens — anything else is a 422. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}
