import { RejectionReasonCode } from '../models/admin.model';
import { REJECTION_REASONS, reasonNeedsNote, reasonsFor } from './rejection-reasons';

describe('rejection reasons', () => {
  it('offers the listing-only reasons on the listing queue', () => {
    const codes = reasonsFor('listing').map((reason) => reason.code);

    expect(codes).toContain(RejectionReasonCode.UnclearPhotos);
    expect(codes).toContain(RejectionReasonCode.PriceOutOfRange);
  });

  it('hides the listing-only reasons on the booking queue', () => {
    const codes = reasonsFor('booking').map((reason) => reason.code);

    expect(codes).not.toContain(RejectionReasonCode.UnclearPhotos);
    expect(codes).not.toContain(RejectionReasonCode.PriceOutOfRange);
  });

  it('offers "another reason" on both queues, and last', () => {
    for (const queue of ['listing', 'booking'] as const) {
      const codes = reasonsFor(queue).map((reason) => reason.code);
      expect(codes[codes.length - 1]).toBe(RejectionReasonCode.Other);
    }
  });

  it('requires a note only for "another reason"', () => {
    expect(reasonNeedsNote(RejectionReasonCode.Other)).toBeTrue();

    for (const reason of REJECTION_REASONS) {
      if (reason.code === RejectionReasonCode.Other) continue;
      expect(reasonNeedsNote(reason.code)).withContext(reason.code).toBeFalse();
    }
  });

  it('treats "no reason picked" as needing nothing yet', () => {
    expect(reasonNeedsNote(null)).toBeFalse();
  });
});
