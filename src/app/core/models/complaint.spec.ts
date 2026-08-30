import { ApiError } from './api-error.model';
import {
  ComplaintCategory,
  ComplaintResolution,
  ComplaintStatus,
  isRefundingResolution,
} from '../enums/complaint.enum';
import type { WireComplaintDetail } from './complaint';
import {
  adminReplyToFormData,
  complaintDetailFromWire,
  complaintFromWire,
  complaintToFormData,
  replyToFormData,
} from './complaint';
import { alreadyOpenComplaint } from '../services/complaints.service';

function file(name: string): File {
  return new File(['x'], name, { type: 'image/png' });
}

/**
 * The four things about complaints that fail quietly.
 *
 * The field names are literal, so a typo in `attachments` uploads nothing and
 * the server still answers 201. The 409 that means "you
 * already have one of these" carries the id of the one you have, and throwing
 * that away turns a link into a dead end. An internal note is a string on the
 * wire, not a boolean, so sending `false` is still sending a note. And the two
 * resolutions that move money need a permission the operations supervisor does
 * not hold — a fact no screen can discover by trying.
 */
describe('complaint requests', () => {
  describe('raising one', () => {
    it('sends multipart with the field names the endpoint reads', () => {
      const form = complaintToFormData({
        bookingId: 'bk-1',
        category: ComplaintCategory.AccessProblem,
        subject: 'الباب مقفول',
        description: 'وصلت الساعة الرابعة ولم أستطع الدخول إلى المستودع.',
        attachments: [file('door.png')],
      });

      // The field names are literal. `attachments` in particular: a typo
      // there uploads nothing and the server still answers 201, so the failure
      // is a complaint that quietly arrives without its photos.
      expect(form.get('bookingId')).toBe('bk-1');
      expect(form.get('category')).toBe(ComplaintCategory.AccessProblem);
      expect(form.get('subject')).toBe('الباب مقفول');
      expect(form.getAll('attachments').length).toBe(1);
    });

    it('stops at five attachments', () => {
      const form = complaintToFormData({
        bookingId: 'bk-1',
        category: ComplaintCategory.Other,
        subject: 'موضوع',
        description: 'وصف طويل بما يكفي ليتجاوز الحد الأدنى.',
        attachments: [1, 2, 3, 4, 5, 6, 7].map((n) => file(`p${n}.png`)),
      });

      // Six would be a 422 on the whole request, losing the text with it.
      expect(form.getAll('attachments').length).toBe(5);
    });
  });

  describe('replying', () => {
    it('omits an empty body rather than sending a blank one', () => {
      const form = replyToFormData({ body: '   ', attachments: [file('a.png')] });

      // A photo with no words is a valid reply. A blank string is not the
      // same as no field, and only one of the two is what was meant.
      expect(form.has('body')).toBeFalse();
      expect(form.getAll('attachments').length).toBe(1);
    });

    it('trims the body it does send', () => {
      const form = replyToFormData({ body: '  تم الحل  ', attachments: [] });
      expect(form.get('body')).toBe('تم الحل');
    });

    it('marks an internal note as the string the server reads', () => {
      const form = adminReplyToFormData({ body: 'ملاحظة', attachments: [], isInternal: true });

      // Multipart carries strings. `true` as a boolean would arrive as "true"
      // by luck rather than by intent, and `false` would arrive as "false" —
      // which is not falsy on the other end.
      expect(form.get('isInternal')).toBe('true');
    });

    it('leaves the flag off an ordinary reply', () => {
      const form = adminReplyToFormData({ body: 'ردّ', attachments: [], isInternal: false });

      // Absent, not "false": a server that reads the presence of the field
      // would treat a reply as a note the user never sees, and the SLA clock
      // would keep running on a complaint that had actually been answered.
      expect(form.has('isInternal')).toBeFalse();
    });
  });

  describe('the resolutions that move money', () => {
    it('is exactly the two refunding ones', () => {
      // The operations supervisor holds `complaints:manage` and not
      // `refunds:issue`, so they may cancel a booking and suspend a listing
      // and may not pay a halala back. Getting this list wrong either hides a
      // decision an operator is allowed to take, or offers one they are not.
      expect(isRefundingResolution(ComplaintResolution.Refund)).toBeTrue();
      expect(isRefundingResolution(ComplaintResolution.RefundAndCancel)).toBeTrue();

      expect(isRefundingResolution(ComplaintResolution.BookingCancelled)).toBeFalse();
      expect(isRefundingResolution(ComplaintResolution.UnitSuspended)).toBeFalse();
      expect(isRefundingResolution(ComplaintResolution.PayoutHold)).toBeFalse();
      expect(isRefundingResolution(ComplaintResolution.NoAction)).toBeFalse();
    });
  });

  describe('already-open', () => {
    it('reads the existing complaint out of the 409', () => {
      const existing = alreadyOpenComplaint(
        new ApiError({
          code: 'COMPLAINT_ALREADY_OPEN',
          message: 'لديك شكوى مفتوحة',
          status: 409,
          meta: { complaintId: 'cmp-9', reference: 'CMP-2026-08-0009' },
        }),
      );

      // The answer to "you already have one" is a link to it. The id is in the
      // response; dropping it leaves somebody to go and find their own
      // conversation.
      expect(existing?.complaintId).toBe('cmp-9');
      expect(existing?.reference).toBe('CMP-2026-08-0009');
    });

    it('is null for any other failure', () => {
      const other = alreadyOpenComplaint(
        new ApiError({ code: 'VALIDATION_ERROR', message: '', status: 422 }),
      );

      expect(other).toBeNull();
    });
  });

  describe('the wire', () => {
    function wire(over: Partial<WireComplaintDetail> = {}): WireComplaintDetail {
      return {
        id: 'cmp-1',
        referenceNo: 'CMP-2026-08-0001',
        booking: { id: 'bk-1', referenceNo: 'HZ-1', unit: { id: 'u-1', title: 'مستودع' } },
        category: ComplaintCategory.SpaceNotAsDescribed,
        subject: 'موضوع',
        status: ComplaintStatus.Open,
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
        description: 'وصف',
        ...over,
      };
    }

    it('reads isOverdue from the server and never works it out', () => {
      expect(complaintFromWire(wire({ isOverdue: true })).isOverdue).toBeTrue();
      expect(complaintFromWire(wire({ isOverdue: false })).isOverdue).toBeFalse();
    });

    it('leaves isOverdue null when the response does not carry it', () => {
      // `/me/complaints` sends no flag: how late the platform is to answer is
      // its own operational measure, not the user's to read. Null means "not
      // stated" and must not collapse to "on time" — a deadline long past with
      // nobody having answered still reads as null here, because working it
      // out is exactly what produced a second answer to one question.
      expect(complaintFromWire(wire()).isOverdue).toBeNull();
      expect(complaintFromWire(wire({ slaDueAt: '2020-01-01T00:00:00Z' })).isOverdue).toBeNull();
    });

    it('separates a refund list that is empty from one that was never sent', () => {
      // The console gets `refunds: []` when none were issued; the user's own
      // view gets no key at all. A screen must be able to tell those apart.
      expect(complaintDetailFromWire(wire()).refunds).toBeNull();
      expect(complaintDetailFromWire(wire({ refunds: [] })).refunds).toEqual([]);

      const refunded = complaintDetailFromWire(
        wire({
          refunds: [
            {
              id: 'rf-1',
              amountHalalas: 5000,
              status: 'COMPLETED',
              createdAt: '2026-08-30T10:09:18.266Z',
            },
          ],
        }),
      );

      // The amount is read, never inferred: a partial refund's resolution says
      // money went back and not how much.
      expect(refunded.refunds?.[0].amountHalalas).toBe(5000);
      expect(refunded.refunds?.[0].method).toBeNull();
      expect(refunded.refunds?.[0].providerReference).toBeNull();
    });

    it('keeps firstResponseAt null rather than undefined', () => {
      // Null means nobody has answered, which the screen says out loud. It is
      // a different fact from the field being absent, and both must land on
      // the same branch.
      expect(complaintFromWire(wire()).firstResponseAt).toBeNull();
    });

    it('gives every list its empty array', () => {
      const detail = complaintDetailFromWire(wire());

      // `messages.length` is read in a template on the first render, before
      // anything has been sent. There is no complaint-level attachment list —
      // the opening photos are on the first message.
      expect(detail.messages).toEqual([]);
    });

    it('carries an internal message through rather than dropping it', () => {
      const detail = complaintDetailFromWire(
        wire({
          messages: [
            {
              id: 'm-1',
              senderType: 'ADMIN',
              body: 'ملاحظة',
              isInternal: true,
              createdAt: '2026-08-01T00:00:00Z',
            },
          ],
        }),
      );

      // Deliberately not filtered here. The server is what keeps these off a
      // user's screen; a filter in the adapter would hide a leak instead of
      // letting the thread component show it as the defect it is.
      expect(detail.messages[0].isInternal).toBeTrue();
    });
  });
});
