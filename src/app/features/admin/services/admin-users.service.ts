import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import type { ApiError } from '@core/models/api-error.model';
import type { PaginatedResponse } from '@core/models/api-response.model';
import type { AdminRole } from '@core/enums/user-role.enum';
import type {
  ActivateUserRequest,
  AdminUserDetail,
  AdminUserQuery,
  AdminUserRow,
  ChangeAdminRoleRequest,
  ReviewIdentityRequest,
  SuspendUserRequest,
  WireAdminUser,
  WireAdminUserResponse,
} from '@core/models/admin-user';
import { adminUserDetailFromWire, adminUserFromWire } from '@core/models/admin-user';
import { ApiService } from '@core/services/api.service';

/**
 * User administration (FR-ADM-04) — `users:manage`.
 *
 * Four verbs, not one status setter. The endpoints are genuinely different
 * actions rather than four ways of writing a field: suspending takes a reason
 * and can be refused over live bookings, activating takes a reason and cannot,
 * reviewing an identity is about a document rather than an account state, and
 * changing an administrator's kind needs a permission none of the others do.
 * A single `setStatus` would have had to invent a shared shape for all four.
 *
 * There is deliberately **no method that edits a name, a mobile or an email**.
 * The endpoint does not exist, and it does not exist because an administrator
 * changing somebody's phone number is the shape of an account takeover.
 */
@Injectable()
export class AdminUsersService {
  private readonly api = inject(ApiService);

  list(query: AdminUserQuery = {}): Observable<PaginatedResponse<AdminUserRow>> {
    return this.api
      .list<WireAdminUser>(API_ENDPOINTS.admin.users, {
        params: {
          // Two parameters, not one control's value: an administrator is
          // filtered by `adminRole`, and everybody else by `role`.
          role: query.role,
          adminRole: query.adminRole,
          status: query.status,
          verificationStatus: query.verificationStatus,
          search: query.search?.trim() || undefined,
          page: query.page,
        },
      })
      .pipe(
        map((page) => ({ items: page.items.map(adminUserFromWire), pagination: page.pagination })),
      );
  }

  byId(id: string): Observable<AdminUserDetail> {
    return this.api
      .get<WireAdminUserResponse>(API_ENDPOINTS.admin.userById(id))
      .pipe(map((response) => adminUserDetailFromWire(response.user)));
  }

  /**
   * Suspends an account, and logs it out everywhere.
   *
   * Every session is revoked the moment this lands, so somebody in the middle
   * of a booking is ejected — which is why the screen shows what the account
   * is currently involved in before offering the button.
   *
   * Refused with 409 `ADMIN_USER_HAS_ACTIVE_BOOKINGS` while bookings are live.
   * That is not a failure to report: read `meta.liveBookings`, say the number,
   * and send it again with `force` if the operator still means it.
   */
  suspend(id: string, reason: string, force = false): Observable<AdminUserDetail> {
    return this.api
      .post<WireAdminUserResponse, SuspendUserRequest>(API_ENDPOINTS.admin.suspendUser(id), {
        reason,
        // Omitted rather than sent false on the first attempt: the flag means
        // "I have seen the count and I still mean it", and it cannot honestly
        // be sent before the count exists.
        ...(force ? { force: true } : {}),
      })
      .pipe(map((response) => adminUserDetailFromWire(response.user)));
  }

  activate(id: string, reason: string): Observable<AdminUserDetail> {
    return this.api
      .post<WireAdminUserResponse, ActivateUserRequest>(API_ENDPOINTS.admin.activateUser(id), {
        reason,
      })
      .pipe(map((response) => adminUserDetailFromWire(response.user)));
  }

  /**
   * FR-ADM-04 — moves an administrator between the three kinds.
   *
   * `admins:manage`, so the system administrator alone; every other operator
   * gets a 403 and never sees the control. Setting the kind the account already
   * holds is a 409 `ADMIN_USER_ALREADY_IN_STATE`, which is why the current one
   * is left out of the picker rather than offered and refused.
   *
   * The response is a `WireAdminUserDetail` **without its `activity` block**,
   * unlike suspend and activate. Left to the caller to merge rather than
   * papered over here: `adminUserDetailFromWire` zeroes what is missing, and
   * five counts silently becoming zero beside a suspend button is a worse
   * answer than none. A role change cannot alter them, so the ones already on
   * screen are still true.
   */
  changeAdminRole(id: string, adminRole: AdminRole, reason: string): Observable<AdminUserDetail> {
    return this.api
      .put<WireAdminUserResponse, ChangeAdminRoleRequest>(API_ENDPOINTS.admin.changeAdminRole(id), {
        adminRole,
        reason,
      })
      .pipe(map((response) => adminUserDetailFromWire(response.user)));
  }

  /**
   * Approves or rejects an identity document.
   *
   * A rejection needs a reason and an approval does not: the person is told
   * why, and "rejected" with no explanation is the kind of answer that
   * generates a complaint rather than a corrected document.
   */
  reviewIdentity(id: string, approve: boolean, reason?: string): Observable<AdminUserDetail> {
    return this.api
      .post<WireAdminUserResponse, ReviewIdentityRequest>(
        API_ENDPOINTS.admin.reviewUserIdentity(id),
        { approve, ...(approve ? {} : { reason }) },
      )
      .pipe(map((response) => adminUserDetailFromWire(response.user)));
  }
}

/**
 * How many bookings the 409 says are live, or null for any other failure.
 *
 * The number is the whole content of that refusal — it turns "could not
 * suspend" into "three bookings are running; suspending affects them" — so it
 * is read out here rather than left as an untyped bag on the error.
 */
export function liveBookingsFromError(error: ApiError): number | null {
  if (error.code !== 'ADMIN_USER_HAS_ACTIVE_BOOKINGS') return null;
  return error.metaNumber('liveBookings') ?? null;
}
