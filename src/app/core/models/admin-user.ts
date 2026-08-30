import type { AccountStatus, AdminRole, VerificationStatus } from '../enums/user-role.enum';
import { UserRole } from '../enums/user-role.enum';

/**
 * An account as the console sees it (FR-ADM-04).
 *
 * What is **not** here is as much of the contract as what is. There is no way
 * to edit somebody's name, mobile or email: an administrator changing a phone
 * number is the shape of an account takeover, and the absence of the endpoint
 * is the control. No screen should offer the field.
 *
 * Suspension is likewise narrower than it looks. It cannot be applied to
 * another administrator or to yourself, and it revokes every session the
 * account holds the moment it lands — so it is not a soft flag, it is somebody
 * being logged out mid-sentence.
 */

// ── Domain ────────────────────────────────────────────────────────────────

export interface AdminUserRow {
  id: string;
  fullName: string;
  role: UserRole;
  /** Which kind of administrator. Null on a renter or a lessor. */
  adminRole: AdminRole | null;
  mobile: string;
  email: string;
  status: AccountStatus;
  verificationStatus: VerificationStatus | null;
  createdAt: string;
}

/**
 * What suspending this account would actually break.
 *
 * Shown *above* the suspend button rather than in a confirmation afterwards:
 * these five numbers are the decision, and a dialog that reveals them after
 * the intent has been formed is asking somebody to change their mind rather
 * than to make up their mind.
 */
export interface AdminUserActivity {
  unitsCount: number;
  bookingsAsRenter: number;
  bookingsAsLessor: number;
  /** Bookings that are still running. Suspension is refused over these. */
  liveBookings: number;
  openComplaints: number;
}

export interface AdminUserDetail extends AdminUserRow {
  activity: AdminUserActivity;
  /**
   * `MANUAL` today; `NAFATH` once the integration is live.
   *
   * Worth showing rather than hiding: an identity a person approved by eye is
   * a different assurance from one Nafath returned, and a reviewer looking
   * back needs to know which one they are reading.
   */
  verificationProvider: string | null;
  verificationReviewedAt: string | null;
  verificationRejectionReason: string | null;
}

/** `{ reason, force? }`. */
export interface SuspendUserRequest {
  reason: string;
  /**
   * The confirmed second attempt, after a 409 said how many bookings are live.
   * Never sent on the first try: the count is the thing being confirmed, and
   * it is not known until the server refuses once.
   */
  force?: boolean;
}

export interface ActivateUserRequest {
  reason: string;
}

/** `{ approve, reason? }` — the reason is required to reject and refused otherwise. */
export interface ReviewIdentityRequest {
  approve: boolean;
  reason?: string;
}

/** What `/admin/users` narrows by. `role` and `adminRole` are separate. */
export interface AdminUserQuery {
  role?: UserRole;
  adminRole?: AdminRole;
  status?: AccountStatus;
  verificationStatus?: VerificationStatus;
  /**
   * Name, mobile or email. **Not the national id** — it is encrypted, and
   * searching part of it is impossible by design rather than unimplemented.
   */
  search?: string;
  page?: number;
}

// ── Wire ──────────────────────────────────────────────────────────────────

export interface WireAdminUser {
  id: string;
  fullName: string;
  role: UserRole;
  adminRole?: AdminRole | null;
  mobile: string;
  email: string;
  status: AccountStatus;
  verificationStatus?: VerificationStatus | null;
  createdAt: string;
}

export interface WireAdminUserDetail extends WireAdminUser {
  activity?: Partial<AdminUserActivity> | null;
  verificationProvider?: string | null;
  verificationReviewedAt?: string | null;
  verificationRejectionReason?: string | null;
}

export interface WireAdminUserResponse {
  user: WireAdminUserDetail;
}

/** What a 409 `ADMIN_USER_HAS_ACTIVE_BOOKINGS` carries. */
export interface ActiveBookingsMeta {
  liveBookings: number;
}

// ── Adapters ──────────────────────────────────────────────────────────────

export function adminUserFromWire(wire: WireAdminUser): AdminUserRow {
  return {
    id: wire.id,
    fullName: wire.fullName,
    role: wire.role,
    adminRole: wire.adminRole ?? null,
    mobile: wire.mobile,
    email: wire.email,
    status: wire.status,
    verificationStatus: wire.verificationStatus ?? null,
    createdAt: wire.createdAt,
  };
}

export function adminUserDetailFromWire(wire: WireAdminUserDetail): AdminUserDetail {
  return {
    ...adminUserFromWire(wire),
    // Zeroed rather than left partial: every one of these is read straight
    // into a template beside the suspend button, and "—" where a count belongs
    // reads as "we do not know", which is a different and worse answer than
    // "none".
    activity: {
      unitsCount: wire.activity?.unitsCount ?? 0,
      bookingsAsRenter: wire.activity?.bookingsAsRenter ?? 0,
      bookingsAsLessor: wire.activity?.bookingsAsLessor ?? 0,
      liveBookings: wire.activity?.liveBookings ?? 0,
      openComplaints: wire.activity?.openComplaints ?? 0,
    },
    verificationProvider: wire.verificationProvider ?? null,
    verificationReviewedAt: wire.verificationReviewedAt ?? null,
    verificationRejectionReason: wire.verificationRejectionReason ?? null,
  };
}

/**
 * Whether the console may act on this row at all.
 *
 * Both refusals are the server's — `ADMIN_CANNOT_SUSPEND_ADMIN` and
 * `ADMIN_CANNOT_ACT_ON_SELF` — and this is only what decides whether to draw a
 * button that would meet one. An administrator is not suspendable by another
 * administrator, and nobody may lock themselves out.
 */
export function canActOnUser(row: AdminUserRow, currentUserId: string | undefined): boolean {
  return row.id !== currentUserId && row.role !== UserRole.Admin;
}
