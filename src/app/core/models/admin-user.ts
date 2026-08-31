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
  /** Null for an account that has never submitted a document. */
  identity: AdminUserIdentity | null;
  /** Why, when the account is suspended. Written by whoever suspended it. */
  suspendedReason: string | null;
  createdAt: string;
}

/**
 * The identity document and what was decided about it.
 *
 * Only the last four digits are ever sent — the number itself is encrypted and
 * never leaves the server, which is also why it cannot be searched by part.
 */
export interface AdminUserIdentity {
  idType: string;
  idNumberLast4: string;
  verificationStatus: VerificationStatus;
  /**
   * `MANUAL` today, `NAFATH` once that is live.
   *
   * Worth showing rather than hiding: an identity a person approved by eye is
   * a different assurance from one Nafath returned, and a reviewer looking
   * back needs to know which one they are reading.
   */
  verificationProvider: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
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
  /** What the account currently holds — server-issued, and empty for a renter. */
  permissions: readonly string[];
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

/**
 * What creating an administrator takes — and there is deliberately no
 * `password` on it.
 *
 * The account is created without one and the new administrator sets theirs
 * through the reset flow, so no credential is ever known by two people. The
 * server strips a `password` sent anyway rather than refusing it, which means a
 * client that offered the field would appear to work and would be handing out
 * passwords that do nothing.
 */
export interface CreateAdminRequest {
  fullName: string;
  /** Local or `+966` — the server normalises and answers with `+966…`. */
  mobile: string;
  adminRole: AdminRole;
  email?: string;
}

/**
 * How the new administrator gets in, in the server's own words.
 *
 * Shown verbatim rather than rewritten here: this is the one screen where an
 * operator has to tell somebody else what to do next, and the day the flow
 * changes the sentence has to change with it — which it cannot if the sentence
 * lives in this repository.
 */
export interface AdminActivation {
  /** `PASSWORD_RESET` today. A discriminant, so read it rather than assume. */
  method: string;
  mobile: string;
  instructionAr: string;
  instructionEn: string;
}

export interface WireCreateAdminResponse {
  user: WireAdminUserDetail;
  activation?: AdminActivation | null;
}

export interface CreatedAdmin {
  user: AdminUserDetail;
  /** Null if the server stopped sending it — the screen says less, not wrongly. */
  activation: AdminActivation | null;
}

/**
 * `{ adminRole, reason }` — both required, and the reason is not a courtesy.
 *
 * Changing what an administrator may do is recorded in the audit trail, and a
 * record of "somebody was made a finance officer" with no stated reason is a
 * rumour rather than evidence.
 */
export interface ChangeAdminRoleRequest {
  adminRole: AdminRole;
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
  identity?: AdminUserIdentity | null;
  suspendedReason?: string | null;
  permissions?: readonly string[] | null;
  createdAt: string;
}

export interface WireAdminUserDetail extends WireAdminUser {
  activity?: Partial<AdminUserActivity> | null;
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
    identity: wire.identity ?? null,
    suspendedReason: wire.suspendedReason ?? null,
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
    permissions: wire.permissions ?? [],
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
