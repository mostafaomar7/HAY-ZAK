/** SRS §5 Permission Matrix + §8.1 actors. */
export enum UserRole {
  Guest = 'Guest',
  Renter = 'Renter',
  Lessor = 'Lessor',
  OperationsSupervisor = 'OperationsSupervisor',
  FinanceOfficer = 'FinanceOfficer',
  SystemAdministrator = 'SystemAdministrator',
}

/** The three admin-side roles (FR-ADM-10). */
export const ADMIN_ROLES: readonly UserRole[] = [
  UserRole.OperationsSupervisor,
  UserRole.FinanceOfficer,
  UserRole.SystemAdministrator,
] as const;

export enum AccountStatus {
  PendingVerification = 'PendingVerification',
  Active = 'Active',
  Suspended = 'Suspended',
  Locked = 'Locked',
}

/** user_identities.verification_status / lessor_bank_accounts.verification_status. */
export enum VerificationStatus {
  Unverified = 'Unverified',
  Pending = 'Pending',
  Verified = 'Verified',
  Failed = 'Failed',
}

export enum IdType {
  NationalId = 'NationalId',
  Iqama = 'Iqama',
}
