/**
 * SRS §5 Permission Matrix + §8.1 actors, with the wire values the API sends.
 *
 * The server currently issues three: `RENTER`, `LESSOR` and one `ADMIN`. The
 * permission matrix distinguishes three administration roles, and the client
 * keeps them — the console's whole navigation is built on the distinction and
 * the client asked for it by name. Until the API splits `ADMIN`, everybody it
 * sends lands on `SystemAdministrator`, which is the widest of the three, so a
 * real operator is never locked out of a screen they should have.
 *
 * That is a deliberate temporary over-grant and it is recorded in
 * `docs/api/backend-notes.md` as something the backend has to resolve before
 * launch: an operations supervisor holding finance permissions is a real
 * segregation-of-duties problem, not a cosmetic one.
 */
export enum UserRole {
  Guest = 'GUEST',
  Renter = 'RENTER',
  Lessor = 'LESSOR',
  OperationsSupervisor = 'OPERATIONS_SUPERVISOR',
  FinanceOfficer = 'FINANCE_OFFICER',
  SystemAdministrator = 'ADMIN',
}

/** The three admin-side roles (FR-ADM-10). */
export const ADMIN_ROLES: readonly UserRole[] = [
  UserRole.OperationsSupervisor,
  UserRole.FinanceOfficer,
  UserRole.SystemAdministrator,
] as const;

export enum AccountStatus {
  PendingVerification = 'PENDING_VERIFICATION',
  Active = 'ACTIVE',
  Suspended = 'SUSPENDED',
  /** Not a stored status — a lockout is a 423 with `meta.until`. */
  Locked = 'LOCKED',
}

/** user_identities.verification_status / lessor_bank_accounts.verification_status. */
export enum VerificationStatus {
  Unverified = 'Unverified',
  Pending = 'Pending',
  Verified = 'Verified',
  Failed = 'Failed',
}

export enum IdType {
  NationalId = 'NATIONAL_ID',
  Iqama = 'IQAMA',
}
