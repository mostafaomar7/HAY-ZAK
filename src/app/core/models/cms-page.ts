/**
 * The editable pages (FR-CMS-01) and the public copies of them.
 *
 * Two details of the contract shape the screens.
 *
 * **Publishing is a partial update.** `{ "isPublished": true }` is the whole
 * request — the body never has to be resent to change a flag, which matters
 * because resending it is how a stale draft in one tab overwrites a fix made
 * in another.
 *
 * **An unpublished page is a 404 in public, not a 403.** Anybody who can tell
 * "exists but hidden" from "does not exist" can learn what is being drafted, so
 * the public reader is told the same thing either way and the client must not
 * distinguish them.
 */

export interface CmsPage {
  id: string;
  /** Lowercase letters, digits and hyphens. A space is a 422. */
  slug: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  metaTitleAr: string | null;
  metaTitleEn: string | null;
  metaDescriptionAr: string | null;
  metaDescriptionEn: string | null;
  isPublished: boolean;
  sortOrder: number;
  updatedAt: string | null;
}

/** Creating one — everything is required. */
export interface CreateCmsPageRequest {
  slug: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  metaTitleAr?: string;
  metaTitleEn?: string;
  metaDescriptionAr?: string;
  metaDescriptionEn?: string;
  isPublished?: boolean;
  sortOrder?: number;
}

/**
 * Editing one — everything is optional.
 *
 * `Partial` rather than a hand-written twin, so a field added above cannot be
 * forgotten here and silently become unsendable.
 */
export type UpdateCmsPageRequest = Partial<CreateCmsPageRequest>;

// ── Wire ──────────────────────────────────────────────────────────────────

export interface WireCmsPage {
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  metaTitleAr?: string | null;
  metaTitleEn?: string | null;
  metaDescriptionAr?: string | null;
  metaDescriptionEn?: string | null;
  isPublished?: boolean;
  sortOrder?: number;
  updatedAt?: string | null;
}

export interface WireCmsPageResponse {
  page: WireCmsPage;
}

export interface WireCmsPagesResponse {
  pages?: WireCmsPage[] | null;
}

// ── Adapter ───────────────────────────────────────────────────────────────

export function cmsPageFromWire(wire: WireCmsPage): CmsPage {
  return {
    id: wire.id,
    slug: wire.slug,
    titleAr: wire.titleAr,
    titleEn: wire.titleEn,
    bodyAr: wire.bodyAr,
    bodyEn: wire.bodyEn,
    metaTitleAr: wire.metaTitleAr ?? null,
    metaTitleEn: wire.metaTitleEn ?? null,
    metaDescriptionAr: wire.metaDescriptionAr ?? null,
    metaDescriptionEn: wire.metaDescriptionEn ?? null,
    // Unpublished when the flag is missing. A page that defaulted to published
    // would go live on a server that stopped sending the field.
    isPublished: wire.isPublished ?? false,
    sortOrder: wire.sortOrder ?? 0,
    updatedAt: wire.updatedAt ?? null,
  };
}

/** Same rule the server enforces; checked here so the error arrives sooner. */
export const CMS_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
