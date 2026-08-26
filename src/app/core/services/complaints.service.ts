import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_ENDPOINTS } from '../constants/api-endpoints';
import type { ComplaintStatus } from '../enums/complaint.enum';
import type { PaginatedResponse } from '../models/api-response.model';
import type { ApiError } from '../models/api-error.model';
import type {
  Complaint,
  ComplaintAlreadyOpenMeta,
  ComplaintDetail,
  ComplaintReplyRequest,
  CreateComplaintRequest,
  WireComplaint,
  WireComplaintResponse,
} from '../models/complaint';
import {
  complaintDetailFromWire,
  complaintFromWire,
  complaintToFormData,
  replyToFormData,
} from '../models/complaint';
import { ApiService } from './api.service';

/**
 * The user's own complaints — the renter's and the lessor's alike.
 *
 * In `core/` rather than in a feature, because both sides of a booking reach
 * the same complaint on the same routes: the lessor being complained about
 * reads it and answers it. Splitting it per feature would have been two copies
 * of one conversation.
 *
 * This is the entire exception path in the product. There is no cancel button,
 * no self-service refund and no editing a paid booking, so every "I want out"
 * arrives here and an administrator decides what follows.
 */
@Injectable({ providedIn: 'root' })
export class ComplaintsService {
  private readonly api = inject(ApiService);

  list(
    params: { status?: ComplaintStatus; page?: number } = {},
  ): Observable<PaginatedResponse<Complaint>> {
    return this.api
      .list<WireComplaint>(API_ENDPOINTS.me.complaints, {
        params: { status: params.status, page: params.page },
      })
      .pipe(
        map((page) => ({ items: page.items.map(complaintFromWire), pagination: page.pagination })),
      );
  }

  byId(id: string): Observable<ComplaintDetail> {
    return this.api
      .get<WireComplaintResponse>(API_ENDPOINTS.me.complaintById(id))
      .pipe(map((response) => complaintDetailFromWire(response.complaint)));
  }

  /**
   * Raises one. `multipart/form-data` always — the endpoint refuses JSON even
   * with nothing attached.
   *
   * A 409 `COMPLAINT_ALREADY_OPEN` is the expected answer when the booking
   * already has one open, and it carries the existing complaint's id. Read it
   * with `alreadyOpen()` and offer the link; printing the message alone leaves
   * somebody hunting for a conversation the response just handed you.
   */
  create(request: CreateComplaintRequest): Observable<ComplaintDetail> {
    return this.api
      .upload<WireComplaintResponse>(API_ENDPOINTS.me.complaints, complaintToFormData(request))
      .pipe(map((response) => complaintDetailFromWire(response.complaint)));
  }

  /**
   * Answers one. Text, files, or both — but not neither: an empty reply with
   * no attachment is a 422 `COMPLAINT_MESSAGE_EMPTY`.
   *
   * Replying to a complaint that is `AWAITING_USER` moves it back to
   * `IN_PROGRESS`. The server does that; nothing here should.
   */
  reply(id: string, request: ComplaintReplyRequest): Observable<ComplaintDetail> {
    return this.api
      .upload<WireComplaintResponse>(
        API_ENDPOINTS.me.complaintMessages(id),
        replyToFormData(request),
      )
      .pipe(map((response) => complaintDetailFromWire(response.complaint)));
  }
}

/**
 * The existing complaint a 409 is pointing at, or null if this is some other
 * failure.
 *
 * A helper rather than an inline cast because the shape is the useful part of
 * that error and every caller wants the same two fields out of it.
 */
export function alreadyOpenComplaint(error: ApiError): ComplaintAlreadyOpenMeta | null {
  if (error.code !== 'COMPLAINT_ALREADY_OPEN') return null;

  const meta = error.meta as Partial<ComplaintAlreadyOpenMeta> | undefined;
  return meta?.complaintId
    ? { complaintId: meta.complaintId, reference: meta.reference ?? '' }
    : null;
}
