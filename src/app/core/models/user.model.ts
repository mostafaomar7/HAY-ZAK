import type {
  AccountStatus,
  AdminRole,
  IdType,
  UserRole,
  VerificationStatus,
} from '../enums/user-role.enum';

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
   *
   * It decides routing and nothing finer. What the account may *do* is
   * `permissions`.
   */
  role: UserRole;
  /**
   * Which kind of administrator, for display. Absent on a renter or a lessor.
   *
   * Never gate on it — see `AdminRole`, and gate on a permission instead.
   */
  adminRole?: AdminRole | null;
  /**
   * The administration capabilities the server issued to this account, as wire
   * strings (`units:review`, `payouts:approve`, …).
   *
   * Empty for a renter and a lessor: their capabilities follow from `role`.
   * Read it through `PermissionService`, which joins the two — nothing else
   * should touch this array.
   */
  permissions?: readonly string[];
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
  /**
   * Also the language every SMS goes out in, which is why it is on the user and
   * not a browser preference: a screen that disagreed with the message on
   * somebody's phone would be the one that is wrong. Change it with `PATCH /me`.
   */
  locale?: 'ar' | 'en';
  /** FR-AUTH-03 — the renter's address. */
  addressLine?: string;
  /**
   * Nested on `GET /me`, and only ever four digits of the number
   * (NFR-SEC-02) — there is no endpoint that releases the rest.
   */
  identity?: {
    verificationStatus: VerificationStatus;
    idType: IdType;
    idNumberLast4: string;
  };
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
  /**
   * Resolved by the API from the IBAN, never chosen. It is the cheapest
   * confirmation the screen has: somebody who mistyped a digit sees a bank they
   * do not recognise and catches their own mistake.
   */
  bankName: string;
  /**
   * The last four digits, and there is no way to get the rest.
   *
   * Not "masked" — the API does not hold a fuller value it is willing to
   * release later, to anybody, including the owner (NFR-SEC-02). Render it as
   * `•••• 7519`.
   */
  ibanLast4: string;
  /**
   * Whether an administrator has checked it.
   *
   * **Does not gate anything.** `UNVERIFIED` means "not reviewed yet", not
   * "rejected", and disabling a control on it would stop a lessor from working
   * while they wait for somebody else.
   */
  verificationStatus: VerificationStatus;
  /** Only the first account becomes this on its own — see `makeDefault`. */
  isDefault: boolean;
  createdAt?: string;
}

/** No `bankName`: the API reads the bank off the IBAN and ignores one sent. */
export interface BankAccountRequest {
  accountHolderName: string;
  /**
   * Spaces and dashes are fine. `SA03 8000 0000 6080 1016 7519` is the form a
   * bank prints and a phone keyboard produces, and the server strips them —
   * so nothing here may reject the format the user was given.
   */
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
