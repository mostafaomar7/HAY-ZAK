import type {
  ComplaintCategory,
  ComplaintResolution,
  ComplaintStatus,
  RefundMethod,
} from '../enums/complaint.enum';
import type { BookingStatus } from '../enums/booking-status.enum';
import { fileUrl } from './unit-wire';

/**
 * A complaint, and the conversation it becomes (FR-ADM-08).
 *
 * Both endpoints — the user's `/me/complaints` and the console's
 * `/admin/complaints` — send the same object, and the difference is what is
 * left out: `isInternal` messages never reach `/me` at all. That is enforced
 * on the server, and the client models it as an optional flag rather than
 * filtering, so a message that should not be here is *visible* as a defect
 * instead of quietly hidden by a `.filter()` nobody reads.
 *
 * Both parties to the booking can read and answer the same complaint. The
 * lessor being complained about sees it — deliberately, because they have to
 * be able to answer for themselves before anybody decides anything.
 */

// ── Domain ────────────────────────────────────────────────────────────────

export interface ComplaintAttachment {
  id: string;
  url: string;
  contentType: string;
  sizeBytes: number;
}

export interface ComplaintMessage {
  id: string;
  /**
   * Who wrote it, by **kind** — `RENTER`, `LESSOR`, `ADMIN`.
   *
   * There is no name on the wire, and that is right rather than missing: a
   * renter must not be shown which operator answered them, and the lessor's
   * name is not the renter's to see (SRS §5). "الدعم" is the honest label.
   */
  senderType: string;
  body: string;
  attachments: ComplaintAttachment[];
  /**
   * An operator's private note. **Never present on `/me`** — verified against
   * the running server. If one turns up in a user-facing response it is a
   * server bug, not something to hide here.
   */
  isInternal: boolean;
  createdAt: string;
}

/**
 * A refund actually issued against this complaint. **Console only.**
 *
 * Read it rather than the resolution: `REFUND_PARTIAL` says money went back
 * but not how much, so a screen deriving the figure from the decision would
 * have to guess — and a guessed refund amount is the kind of number somebody
 * quotes to a customer.
 */
export interface ComplaintRefund {
  id: string;
  amountHalalas: number;
  status: string;
  method: RefundMethod | null;
  /** The gateway's or the bank's reference, once there is one. */
  providerReference: string | null;
  createdAt: string;
}

export interface ComplaintBookingRef {
  id: string;
  referenceNo: string;
  status: BookingStatus | null;
  startDate: string | null;
  endDate: string | null;
  totalHalalas: number | null;
  /** Nested on the wire, not flattened to a `unitTitle`. */
  unit: { id: string; title: string };
}

export interface Complaint {
  id: string;
  /** `CMP-2026-08-0001` — quoted on the phone, so it goes on every screen. */
  referenceNo: string;
  booking: ComplaintBookingRef;
  category: ComplaintCategory;
  subject: string;
  status: ComplaintStatus;
  /** When a reply is owed by. The console's queue is ordered on it. */
  slaDueAt: string | null;
  /**
   * Past its reply deadline with nobody having answered — **the server's own
   * answer**, from the same definition that backs `?overdue=true`.
   *
   * `null` on `/me/complaints`, which does not send it: the flag is the
   * console's operational measure, and a user reading their own complaint is
   * not being shown how late the platform is to it. Null means "not stated",
   * never "on time".
   *
   * This was derived here once, from `slaDueAt` against the clock. It agreed
   * with the server most of the time, which is exactly what made it dangerous.
   */
  isOverdue: boolean | null;
  /** `null` means nobody has answered yet — not that it is new. */
  firstResponseAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ComplaintDetail extends Complaint {
  description: string;
  /**
   * The conversation. **Attachments live on messages**, including the ones
   * sent when the complaint was raised — there is no complaint-level
   * attachment list, so the opening photos are on the first message.
   */
  messages: ComplaintMessage[];
  /** The decision, once there is one. */
  resolution: ComplaintResolution | null;
  /** Why. Shown to the user, not just recorded. */
  resolutionNote: string | null;
  resolvedAt: string | null;
  /**
   * Console only, and an **id** — there is no name on the wire, so a screen
   * can say whether it is assigned but not to whom.
   */
  assignedToId: string | null;
  /** Which side raised it. */
  raisedByType: string | null;
  /**
   * What was actually refunded. `null` on the user's own view, which does not
   * carry the list — an empty array means the console asked and there are none.
   */
  refunds: ComplaintRefund[] | null;
}

/**
 * What the form collects.
 *
 * Sent as `multipart/form-data` always — not because JSON is refused (it is
 * accepted, the handover was wrong about that), but because a form that
 * switched encoding depending on whether somebody attached a photo would have
 * two paths through it and only one of them exercised.
 */
export interface CreateComplaintRequest {
  bookingId: string;
  category: ComplaintCategory;
  /** At least 5 characters. */
  subject: string;
  /**
   * At least 20. The floor is the point: a complaint is read by a person who
   * has to decide something, and "مش عاجبني" is not a case they can act on.
   */
  description: string;
  attachments: readonly File[];
}

export interface ComplaintReplyRequest {
  /** Optional only when something is attached. */
  body: string;
  attachments: readonly File[];
}

/**
 * How an administrator ends a complaint with a decision.
 *
 * The refund fields are a separate concern from the resolution and are
 * validated as one: an amount without a resolution that refunds is meaningless,
 * and `MANUAL_TRANSFER` without a bank reference is a 422 — correctly, because
 * a manual transfer nobody can trace is not a record of anything.
 */
export interface ResolveComplaintRequest {
  resolution: ComplaintResolution;
  /** At least 10 characters. The user reads this. */
  note: string;
  refundAmountHalalas?: number;
  refundMethod?: RefundMethod;
  /** Required for `MANUAL_TRANSFER`, refused otherwise. */
  refundReference?: string;
}

/** Closing without a decision — a duplicate, or somebody withdrew it. */
export interface CloseComplaintRequest {
  /** At least 10 characters. */
  note: string;
}

/** At most five, on both the opening and every reply. */
export const MAX_COMPLAINT_ATTACHMENTS = 5;
export const MIN_COMPLAINT_SUBJECT = 5;
export const MIN_COMPLAINT_DESCRIPTION = 20;
export const MIN_RESOLUTION_NOTE = 10;

// ── Wire ──────────────────────────────────────────────────────────────────

export interface WireComplaintAttachment {
  id: string;
  url: string;
  contentType: string;
  sizeBytes: number;
}

export interface WireComplaintMessage {
  id: string;
  senderType: string;
  body: string;
  attachments?: WireComplaintAttachment[] | null;
  isInternal?: boolean;
  createdAt: string;
}

/**
 * `POST .../messages` answers with both, and the complaint is read inside the
 * same transaction — so the status the reply moves (`AWAITING_USER` →
 * `IN_PROGRESS`) is already in it. No second request.
 */
export interface WireComplaintMessageResponse {
  message: WireComplaintMessage;
  complaint: WireComplaintDetail;
}

export interface WireComplaintBooking {
  id: string;
  referenceNo: string;
  status?: BookingStatus | null;
  startDate?: string | null;
  endDate?: string | null;
  totalHalalas?: number | null;
  unit: { id: string; title: string };
}

export interface WireComplaint {
  id: string;
  referenceNo: string;
  booking: WireComplaintBooking;
  category: ComplaintCategory;
  subject: string;
  status: ComplaintStatus;
  slaDueAt?: string | null;
  firstResponseAt?: string | null;
  /** Console rows only. Absent on `/me/complaints`. */
  isOverdue?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WireComplaintRefund {
  id: string;
  amountHalalas: number;
  status: string;
  method?: RefundMethod | null;
  providerReference?: string | null;
  createdAt: string;
}

export interface WireComplaintDetail extends WireComplaint {
  description: string;
  messages?: WireComplaintMessage[] | null;
  /** Console detail only. Absent on `/me/complaints/:id`. */
  refunds?: WireComplaintRefund[] | null;
  resolution?: ComplaintResolution | null;
  resolutionNote?: string | null;
  resolvedAt?: string | null;
  assignedToId?: string | null;
  raisedByType?: string | null;
}

/** Both detail endpoints wrap it. */
export interface WireComplaintResponse {
  complaint: WireComplaintDetail;
}

/**
 * What a 409 `COMPLAINT_ALREADY_OPEN` carries.
 *
 * The id is the whole point: the answer to "you already have one of these" is
 * a link to it, not an error message telling somebody to go and find it.
 */
export interface ComplaintAlreadyOpenMeta {
  complaintId: string;
  reference: string;
}

// ── Adapters ──────────────────────────────────────────────────────────────

function attachmentFromWire(wire: WireComplaintAttachment): ComplaintAttachment {
  return {
    id: wire.id,
    // `/uploads/complaints/…` — relative to the API's origin, not to this
    // application's. A raw path would 404 against the dev server on :4200.
    url: fileUrl(wire.url),
    contentType: wire.contentType,
    sizeBytes: wire.sizeBytes,
  };
}

export function complaintMessageFromWire(wire: WireComplaintMessage): ComplaintMessage {
  return {
    id: wire.id,
    senderType: wire.senderType,
    body: wire.body,
    attachments: (wire.attachments ?? []).map(attachmentFromWire),
    // Never `undefined` reaching a template: the thread marks an internal note
    // visibly, and "unknown" must resolve to "not internal" rather than to a
    // falsy value that happens to look the same.
    isInternal: wire.isInternal ?? false,
    createdAt: wire.createdAt,
  };
}

export function complaintFromWire(wire: WireComplaint): Complaint {
  const slaDueAt = wire.slaDueAt ?? null;
  const firstResponseAt = wire.firstResponseAt ?? null;

  return {
    id: wire.id,
    referenceNo: wire.referenceNo,
    booking: {
      id: wire.booking.id,
      referenceNo: wire.booking.referenceNo,
      status: wire.booking.status ?? null,
      startDate: wire.booking.startDate ?? null,
      endDate: wire.booking.endDate ?? null,
      totalHalalas: wire.booking.totalHalalas ?? null,
      unit: { ...wire.booking.unit },
    },
    category: wire.category,
    subject: wire.subject,
    status: wire.status,
    slaDueAt,
    // `?? null` and not `?? false`: the user's own view does not send this,
    // and "not stated" is not the same claim as "on time".
    isOverdue: wire.isOverdue ?? null,
    firstResponseAt,
    createdAt: wire.createdAt,
    updatedAt: wire.updatedAt,
  };
}

export function complaintDetailFromWire(wire: WireComplaintDetail): ComplaintDetail {
  return {
    ...complaintFromWire(wire),
    description: wire.description,
    messages: (wire.messages ?? []).map(complaintMessageFromWire),
    resolution: wire.resolution ?? null,
    resolutionNote: wire.resolutionNote ?? null,
    resolvedAt: wire.resolvedAt ?? null,
    assignedToId: wire.assignedToId ?? null,
    raisedByType: wire.raisedByType ?? null,
    // Null, not `[]`: the console gets a list and the user's own view gets no
    // key at all, and "none were issued" is not "we were not told".
    refunds: wire.refunds ? wire.refunds.map(refundFromWire) : null,
  };
}

function refundFromWire(wire: WireComplaintRefund): ComplaintRefund {
  return {
    id: wire.id,
    amountHalalas: wire.amountHalalas,
    status: wire.status,
    method: wire.method ?? null,
    providerReference: wire.providerReference ?? null,
    createdAt: wire.createdAt,
  };
}

// ── Request bodies ────────────────────────────────────────────────────────

/**
 * `multipart/form-data`, even with nothing attached. Not because JSON is
 * refused — it is accepted — but so the form has one path through it rather
 * than two, only one of which would ever be exercised.
 *
 * Built here rather than in each caller so the field names, and particularly
 * the literal `attachments`, are written once.
 */
export function complaintToFormData(request: CreateComplaintRequest): FormData {
  const form = new FormData();
  form.append('bookingId', request.bookingId);
  form.append('category', request.category);
  form.append('subject', request.subject);
  form.append('description', request.description);
  appendAttachments(form, request.attachments);
  return form;
}

export function replyToFormData(request: ComplaintReplyRequest): FormData {
  const form = new FormData();
  // Omitted rather than sent empty when there is nothing to say: an empty body
  // with no files is a 422, and a blank string would look like an attempt.
  if (request.body.trim()) form.append('body', request.body.trim());
  appendAttachments(form, request.attachments);
  return form;
}

/** An operator's reply, which may be a note only they can see. */
export function adminReplyToFormData(
  request: ComplaintReplyRequest & { isInternal?: boolean },
): FormData {
  const form = replyToFormData(request);
  // The server reads a string here, not a JSON boolean — it is a multipart
  // field. Sent only when true, so an ordinary reply cannot be mistaken for a
  // note by a server that treats the presence of the field as the answer.
  if (request.isInternal) form.append('isInternal', 'true');
  return form;
}

function appendAttachments(form: FormData, files: readonly File[]): void {
  for (const file of files.slice(0, MAX_COMPLAINT_ATTACHMENTS)) {
    form.append('attachments', file, file.name);
  }
}
