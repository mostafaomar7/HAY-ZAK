import type { LegalDocumentType } from '../enums/operations.enum';

/**
 * FR-CMS-01 — the seven static pages.
 *
 * The bodies are structured rather than a single HTML blob: the design renders
 * the FAQ as an accordion, the legal pages with a numbered side index, and the
 * refund policy as a table. Shipping raw HTML would mean either losing that
 * structure or letting the CMS inject markup into the page, so the API returns
 * the shape and the templates render it.
 */
export type StaticPageSlug =
  'about' | 'how-it-works' | 'faq' | 'terms' | 'privacy' | 'refund-policy' | 'contact';

/** The seven slugs, in the order the footer and the "related pages" rail list them. */
export const STATIC_PAGE_SLUGS: readonly StaticPageSlug[] = [
  'about',
  'how-it-works',
  'faq',
  'terms',
  'privacy',
  'refund-policy',
  'contact',
] as const;

export interface StaticPage {
  slug: StaticPageSlug;
  title: string;
  /** Sub-heading under the page title; absent on the legal pages. */
  subtitle?: string;
  updatedAt?: string;
  /** Present on the legal pages only — FR-ADM-07 records consent per version. */
  version?: LegalDocumentVersion;
  /** Free prose shown before any structured block. */
  intro?: string;
  sections: StaticPageSection[];
  /** FAQ only. */
  faqGroups?: FaqGroup[];
  /** Refund policy only. */
  refundTiers?: RefundTier[];
  refundNotes?: string[];
  /** "كيف تعمل المنصة" only. */
  journeys?: PageJourney[];
  /** "من نحن" only. */
  commitments?: PageCommitment[];
  coverage?: string[];
  /** Contact page only. */
  contactChannels?: ContactChannel[];
}

export interface LegalDocumentVersion {
  id: string;
  documentType: LegalDocumentType;
  versionNo: string;
  effectiveFrom: string;
  /** The version this account has accepted, when signed in (FR-ADM-07). */
  acceptedVersionNo?: string;
  acceptedAt?: string;
}

export interface StaticPageSection {
  id: string;
  /** "١", "٢"… on the legal pages; absent elsewhere. */
  number?: string;
  title: string;
  body: string;
  /** Rendered as a bulleted list under the body. */
  items?: string[];
}

export interface FaqGroup {
  id: string;
  title: string;
  items: FaqItem[];
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

/** One row of the cancellation-and-refund table. */
export interface RefundTier {
  when: string;
  /** Displayed verbatim — "100%", "50%", "0%". */
  refundShare: string;
  commissionNote: string;
  /** Semantic weight, so the template picks the colour (never the CMS). */
  tone: 'success' | 'warning' | 'danger';
}

/** The renter and lessor columns of "كيف تعمل المنصة". */
export interface PageJourney {
  id: string;
  title: string;
  steps: PageJourneyStep[];
}

export interface PageJourneyStep {
  number: string;
  title: string;
  body: string;
}

export interface PageCommitment {
  title: string;
  body: string;
}

export interface ContactChannel {
  label: string;
  value: string;
  hint?: string;
  /** Phone numbers and addresses need `dir="ltr"` inside the Arabic run. */
  isLatin: boolean;
}

/** FR-CMS — the "التواصل معنا" form. */
export interface ContactRequest {
  fullName: string;
  email: string;
  mobile: string;
  subject: ContactSubject;
  message: string;
}

export type ContactSubject =
  'existingBooking' | 'listing' | 'paymentOrInvoice' | 'complaint' | 'other';

export interface ContactResult {
  /** Shown back to the user so they can quote it — "SR-2026-00714". */
  ticketNo: string;
}
