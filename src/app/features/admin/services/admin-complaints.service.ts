import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import type { ComplaintCategory, ComplaintStatus } from '@core/enums/complaint.enum';
import type { PaginatedResponse } from '@core/models/api-response.model';
import type {
  Complaint,
  ComplaintDetail,
  ComplaintReplyRequest,
  CloseComplaintRequest,
  ResolveComplaintRequest,
  WireComplaint,
  WireComplaintMessageResponse,
  WireComplaintResponse,
} from '@core/models/complaint';
import {
  adminReplyToFormData,
  complaintDetailFromWire,
  complaintFromWire,
} from '@core/models/complaint';
import { ApiService } from '@core/services/api.service';

/** What the queue can be narrowed by. */
export interface AdminComplaintQuery {
  status?: ComplaintStatus;
  category?: ComplaintCategory;
  /** Only the ones already past their reply deadline. */
  overdue?: boolean;
  assignedToId?: string;
  page?: number;
}

/**
 * The complaints queue and everything an operator can do to one (FR-ADM-08).
 *
 * `complaints:manage` opens all of this, **except** a resolution that moves
 * money: `REFUND` and `REFUND_AND_CANCEL` need `refunds:issue` as well. So an
 * operations supervisor can cancel a booking, suspend a listing and freeze a
 * transfer, and cannot pay a halala back. The screen disables those two
 * options rather than letting somebody fill in a refund form and meet a 403 at
 * the end of it — the guard is the server's, but being told at the end is not
 * the same as being told at the start.
 */
@Injectable()
export class AdminComplaintsService {
  private readonly api = inject(ApiService);

  /**
   * The queue, ordered by the server on `slaDueAt` — most overdue first.
   *
   * Not re-sorted here, and no column offers to: "who has been waiting longest
   * for an answer we promised" is the order this screen exists to show.
   */
  list(query: AdminComplaintQuery = {}): Observable<PaginatedResponse<Complaint>> {
    return this.api
      .list<WireComplaint>(API_ENDPOINTS.admin.complaints, {
        params: {
          status: query.status,
          category: query.category,
          // Only ever sent as `true`; `overdue=false` would be a filter that
          // reads as "the ones that are on time", which is not what it does.
          overdue: query.overdue ? true : undefined,
          assignedToId: query.assignedToId,
          page: query.page,
        },
      })
      .pipe(
        map((page) => ({
          items: page.items.map(complaintFromWire),
          pagination: page.pagination,
        })),
      );
  }

  byId(id: string): Observable<ComplaintDetail> {
    return this.api
      .get<WireComplaintResponse>(API_ENDPOINTS.admin.complaintById(id))
      .pipe(map((response) => complaintDetailFromWire(response.complaint)));
  }

  /**
   * Replies, or leaves a note only the console sees.
   *
   * The distinction matters beyond privacy: an internal note **does not stop
   * the SLA clock** and does not move the status. Only a real reply does. A
   * queue full of complaints an operator has privately annotated is still a
   * queue of people waiting to hear something.
   */
  reply(
    id: string,
    request: ComplaintReplyRequest & { isInternal?: boolean },
  ): Observable<ComplaintDetail> {
    return (
      this.api
        .upload<WireComplaintMessageResponse>(
          API_ENDPOINTS.admin.complaintMessages(id),
          adminReplyToFormData(request),
        )
        // Answers with the message alone; the complaint's status and its
        // first-response time are only visible on a re-read.
        .pipe(switchMap(() => this.byId(id)))
    );
  }

  assign(id: string, adminId: string): Observable<ComplaintDetail> {
    return this.api
      .post<WireComplaintResponse, { adminId: string }>(API_ENDPOINTS.admin.assignComplaint(id), {
        adminId,
      })
      .pipe(map((response) => complaintDetailFromWire(response.complaint)));
  }

  /**
   * Ends it with a decision. **Final** — a second attempt is a 409.
   *
   * A 502 `REFUND_GATEWAY_FAILED` means no money moved and the complaint is
   * still open, so the screen offers "try again" rather than reporting
   * success. Anything else and the case is settled.
   */
  resolve(id: string, request: ResolveComplaintRequest): Observable<ComplaintDetail> {
    return this.api
      .post<WireComplaintResponse, ResolveComplaintRequest>(
        API_ENDPOINTS.admin.resolveComplaint(id),
        request,
      )
      .pipe(map((response) => complaintDetailFromWire(response.complaint)));
  }

  /**
   * Ends it without one — a duplicate, or somebody withdrew it.
   *
   * Deliberately a different call from `resolve`, not a resolution value:
   * "how many complaints did we settle" is a question a report will be asked,
   * and closing a duplicate is not settling anything.
   */
  close(id: string, note: string): Observable<ComplaintDetail> {
    return this.api
      .post<WireComplaintResponse, CloseComplaintRequest>(API_ENDPOINTS.admin.closeComplaint(id), {
        note,
      })
      .pipe(map((response) => complaintDetailFromWire(response.complaint)));
  }
}
