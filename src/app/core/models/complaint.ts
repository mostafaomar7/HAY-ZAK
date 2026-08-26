import type {
  ComplaintCategory,
  ComplaintResolution,
  ComplaintStatus,
  RefundMethod,
} from '../enums/complaint.enum';

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
  authorName: string;
  /** Absent on `/me` — the console adds it. */
  authorRole?: string;
  body: string;
  attachments: ComplaintAttachment[];
  /**
   * An operator's private note. **Never present on `/me`.** If one turns up in
   * a user-facing response it is a server bug, not something to hide here.
   */
  isInternal?: boolean;
  sentAt: string;
}

/** One refund actually paid against this complaint. */
export interface ComplaintRefund {
  id: string;
  amountHalalas: number;
  method: RefundMethod;
  reference: string | null;
  refundedAt: string;
}

export interface ComplaintBookingRef {
  id: string;
  referenceNo: string;
  unitTitle: string;
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
  /** `true` once `slaDueAt` has passed with no first response. */
  isOverdue: boolean;
  /** `null` means nobody has answered yet — not that it is new. */
  firstResponseAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ComplaintDetail extends Complaint {
  description: string;
  messages: ComplaintMessage[];
  attachments: ComplaintAttachment[];
  /** The decision, once there is one. */
  resolution: ComplaintResolution | null;
  /** Why. Shown to the user, not just recorded. */
  resolutionNote: string | null;
  resolvedAt: string | null;
  /** Console only: who is holding it. */
  assignedToName?: string | null;
  /** What was actually paid back on this case. */
  refunds: ComplaintRefund[];
}

/**
 * What the form collects. Sent as `multipart/form-data`, always — the endpoint
 * refuses JSON even when there is nothing attached.
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
  authorName: string;
  authorRole?: string;
  body: string;
  attachments?: WireComplaintAttachment[] | null;
  isInternal?: boolean;
  sentAt: string;
}

export interface WireComplaintRefund {
  id: string;
  amountHalalas: number;
  method: RefundMethod;
  reference?: string | null;
  refundedAt: string;
}

export interface WireComplaint {
  id: string;
  referenceNo: string;
  booking: { id: string; referenceNo: string; unitTitle: string };
  category: ComplaintCategory;
  subject: string;
  status: ComplaintStatus;
  slaDueAt?: string | null;
  isOverdue?: boolean;
  firstResponseAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WireComplaintDetail extends WireComplaint {
  description: string;
  messages?: WireComplaintMessage[] | null;
  attachments?: WireComplaintAttachment[] | null;
  resolution?: ComplaintResolution | null;
  resolutionNote?: string | null;
  resolvedAt?: string | null;
  assignedToName?: string | null;
  refunds?: WireComplaintRefund[] | null;
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
    url: wire.url,
    contentType: wire.contentType,
    sizeBytes: wire.sizeBytes,
  };
}

export function complaintMessageFromWire(wire: WireComplaintMessage): ComplaintMessage {
  return {
    id: wire.id,
    authorName: wire.authorName,
    authorRole: wire.authorRole,
    body: wire.body,
    attachments: (wire.attachments ?? []).map(attachmentFromWire),
    isInternal: wire.isInternal,
    sentAt: wire.sentAt,
  };
}

export function complaintFromWire(wire: WireComplaint): Complaint {
  return {
    id: wire.id,
    referenceNo: wire.referenceNo,
    booking: { ...wire.booking },
    category: wire.category,
    subject: wire.subject,
    status: wire.status,
    slaDueAt: wire.slaDueAt ?? null,
    // Never `undefined` reaching a template: the console paints a row red on
    // this, and a missing flag has to read as "not overdue", not as "unknown".
    isOverdue: wire.isOverdue ?? false,
    firstResponseAt: wire.firstResponseAt ?? null,
    createdAt: wire.createdAt,
    updatedAt: wire.updatedAt,
  };
}

export function complaintDetailFromWire(wire: WireComplaintDetail): ComplaintDetail {
  return {
    ...complaintFromWire(wire),
    description: wire.description,
    messages: (wire.messages ?? []).map(complaintMessageFromWire),
    attachments: (wire.attachments ?? []).map(attachmentFromWire),
    resolution: wire.resolution ?? null,
    resolutionNote: wire.resolutionNote ?? null,
    resolvedAt: wire.resolvedAt ?? null,
    assignedToName: wire.assignedToName ?? null,
    refunds: (wire.refunds ?? []).map((refund) => ({
      id: refund.id,
      amountHalalas: refund.amountHalalas,
      method: refund.method,
      reference: refund.reference ?? null,
      refundedAt: refund.refundedAt,
    })),
  };
}

// ── Request bodies ────────────────────────────────────────────────────────

/**
 * `multipart/form-data`, even with nothing attached — the endpoint refuses
 * JSON. Built here rather than in each caller so the field names, and
 * particularly the literal `attachments`, are written once.
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
