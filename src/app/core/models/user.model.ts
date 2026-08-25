import type { AccountStatus, IdType, UserRole, VerificationStatus } from '../enums/user-role.enum';

/** ERD-1 `users`. Sensitive fields live in the separate models below. */
export interface User {
  id: string;
  fullName: string;
  mobile: string;
  email: string;
  /**
   * One role. The API sends `role`, singular, and the product allows exactly
   * one per account (FR-AUTH-12) — an array was modelling something neither
   * side does.
   */
  role: UserRole;
  status: AccountStatus;
  /**
   * Null until the mobile OTP is verified.
   *
   * A user can sign in without it. Every transactional endpoint refuses them,
   * so the sign-in flow reads this and routes to the OTP screen rather than to
   * the portal — landing them on a dashboard whose every button fails is worse
   * than sending them to the one screen that fixes it.
   */
  mobileVerifiedAt?: string | null;
  locale?: 'ar' | 'en';
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
  refreshToken: string;
  /** Seconds. The access token's life, not a deadline. */
  expiresIn: number;
  tokenType: 'Bearer';
}

/** What `login`, `verify-mobile` and `refresh` all return. */
export interface AuthResult {
  user: User;
  tokens: AuthTokens;
}

/**
 * What `register` returns — an account, and where the code went. No tokens:
 * they are minted at `verify-mobile`, which is the step that makes the account
 * usable.
 */
export interface RegisterResult {
  user: User;
  verification: OtpChallenge;
}

export interface OtpChallenge {
  channel: 'SMS';
  /** Masked, e.g. `+9665****5678`. Shown so the user confirms the number. */
  destination: string;
  expiresAt: string;
  /** The resend button stays disabled this long. */
  resendAfterSeconds: number;
  /**
   * Development only — the code itself, so a screen can be walked without a
   * handset. Absent in staging and production, so nothing may branch on it.
   */
  devCode?: string;
}

/** The legal version a registration records consent against. */
export interface SignupTerms {
  id: string;
  versionNo: number;
  effectiveFrom: string;
  /** Already in the requested language. */
  content: string;
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
  /** Renter only (FR-AUTH-03). `addressLine` on the wire. */
  addressLine?: string;
  /** FR-AUTH-06 — the accepted document version is recorded with the consent. */
  /** From `GET /auth/terms`. A stale one is refused. */
  termsVersionId: string;
  acceptedTerms: true;
}

/** Registration, or a password reset — the code is scoped to one of them. */
export type OtpPurpose = 'REGISTRATION' | 'PASSWORD_RESET';

/**
 * What a reset returns. No tokens: `sessionsRevoked` includes this device, so
 * the only correct next screen is sign-in.
 */
export interface PasswordResetResult {
  passwordChanged: boolean;
  sessionsRevoked: boolean;
}
