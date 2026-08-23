import { RejectionReasonCode } from '../models/admin.model';
import type { TranslationKey } from '../i18n/translations';

/**
 * The reasons an operator may give for rejecting a listing or a booking
 * (FR-UNT-06, FR-BKG-05, FR-ADM-09).
 *
 * A closed list rather than a free-text box: the code is what the audit trail
 * groups by, what picks the notification template, and what a "why are we
 * rejecting so much" report can count. The note the operator adds travels with
 * it, but it never replaces it.
 *
 * `Other` is deliberately last and deliberately requires the note — see
 * `reasonNeedsNote`.
 */
export interface RejectionReason {
  code: RejectionReasonCode;
  labelKey: TranslationKey;
  /** Some reasons only make sense for one of the two queues. */
  appliesTo: 'listing' | 'booking' | 'both';
}

export const REJECTION_REASONS: readonly RejectionReason[] = [
  {
    code: RejectionReasonCode.UnclearPhotos,
    labelKey: 'reject.unclearPhotos',
    appliesTo: 'listing',
  },
  {
    code: RejectionReasonCode.IncompleteDescription,
    labelKey: 'reject.incompleteDescription',
    appliesTo: 'both',
  },
  {
    code: RejectionReasonCode.PriceOutOfRange,
    labelKey: 'reject.priceOutOfRange',
    appliesTo: 'listing',
  },
  {
    code: RejectionReasonCode.ProhibitedGoods,
    labelKey: 'reject.prohibitedGoods',
    appliesTo: 'both',
  },
  {
    code: RejectionReasonCode.IncompleteLessorData,
    labelKey: 'reject.incompleteLessorData',
    appliesTo: 'both',
  },
  { code: RejectionReasonCode.Other, labelKey: 'reject.other', appliesTo: 'both' },
];

export function reasonsFor(queue: 'listing' | 'booking'): readonly RejectionReason[] {
  return REJECTION_REASONS.filter((r) => r.appliesTo === 'both' || r.appliesTo === queue);
}

/** "سبب آخر يُوضّح في الملاحظة" — the label promises a note, so require one. */
export function reasonNeedsNote(code: RejectionReasonCode | null): boolean {
  return code === RejectionReasonCode.Other;
}
