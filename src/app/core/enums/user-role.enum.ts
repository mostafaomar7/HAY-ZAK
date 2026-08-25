/**
 * The three roles the API issues, plus the guest the client invents for
 * everybody who has not signed in.
 *
 * `role` decides routing and nothing finer: `RENTER` belongs on the storefront,
 * `LESSOR` in the portal, `ADMIN` in the console. What an administrator may
 * actually *do* is not in here — it arrives per user as `permissions`, and
 * `PermissionService` is the only thing that reads it. See `permissions.ts`.
 */
export enum UserRole {
  Guest = 'GUEST',
  Renter = 'RENTER',
  Lessor = 'LESSOR',
  Admin = 'ADMIN',
}

/**
 * Which kind of administrator, for display only.
 *
 * Present on the user beside `role`, and deliberately **not** a permission
 * check: `adminRole === Finance` is the test that breaks the day the client
 * asks for a fourth kind of administrator, which on this sort of platform they
 * always do. Gate on a permission and a new role needs no client release.
 *
 * Null on a renter or a lessor.
 */
export enum AdminRole {
  SystemAdmin = 'SYSTEM_ADMIN',
  Operations = 'OPERATIONS',
  Finance = 'FINANCE',
}

/** Whether this account belongs in the console at all. */
export function isAdminRole(role: UserRole): boolean {
  return role === UserRole.Admin;
}

export enum AccountStatus {
  PendingVerification = 'PENDING_VERIFICATION',
  Active = 'ACTIVE',
  Suspended = 'SUSPENDED',
  /** Not a stored status — a lockout is a 423 with `meta.until`. */
  Locked = 'LOCKED',
}

/**
 * user_identities.verification_status / lessor_bank_accounts.verification_status,
 * with the wire values — `GET /me` sends `"VERIFIED"`, not `"Verified"`.
 */
export enum VerificationStatus {
  Unverified = 'UNVERIFIED',
  Pending = 'PENDING',
  Verified = 'VERIFIED',
  Failed = 'FAILED',
}

export enum IdType {
  NationalId = 'NATIONAL_ID',
  Iqama = 'IQAMA',
}
