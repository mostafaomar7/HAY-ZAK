import type { AccountStatus, IdType, UserRole, VerificationStatus } from '../enums/user-role.enum';

/** ERD-1 `users`. Sensitive fields live in the separate models below. */
export interface User {
  id: string;
  fullName: string;
  mobile: string;
  email: string;
  roles: UserRole[];
  status: AccountStatus;
  mobileVerifiedAt?: string;
  emailVerifiedAt?: string;
  avatarUrl?: string;
  createdAt: string;
}

/** ERD-1 `user_identities` — ID number is never returned in full (NFR-SEC-02). */
export interface UserIdentity {
  idType: IdType;
  /** Masked by the API: only the last four characters. */
  idNumberMasked: string;
  verificationStatus: VerificationStatus;
  verifiedAt?: string;
}

/** ERD-1 `lessor_bank_accounts` — FR-LSR-02. */
export interface LessorBankAccount {
  id: string;
  accountHolderName: string;
  bankName: string;
  /** Masked by the API (NFR-SEC-02). */
  ibanMasked: string;
  verificationStatus: VerificationStatus;
  isDefault: boolean;
}

export interface BankAccountRequest {
  accountHolderName: string;
  bankName: string;
  iban: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
}

export interface AuthResult extends AuthTokens {
  user: User;
}

export interface LoginRequest {
  /** Mobile number or email address (FR-AUTH-07). */
  identifier: string;
  password: string;
  rememberMe?: boolean;
}

/** FR-AUTH-01/02/03/06 — role is chosen at registration. */
export interface RegisterRequest {
  role: UserRole.Lessor | UserRole.Renter;
  fullName: string;
  idNumber: string;
  idType: IdType;
  email: string;
  mobile: string;
  password: string;
  /** Renter only (FR-AUTH-03). */
  address?: string;
  /** FR-AUTH-06 — the accepted document version is recorded with the consent. */
  termsVersionId: string;
  acceptedTerms: true;
}

export interface OtpRequest {
  mobile: string;
}

export interface OtpVerifyRequest {
  mobile: string;
  code: string;
}
