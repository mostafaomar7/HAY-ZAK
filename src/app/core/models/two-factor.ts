/**
 * Two-factor authentication — TOTP through an authenticator app (§17).
 *
 * **Not SMS.** The SMS channel is exactly what a SIM-swap attack takes over, so
 * a second factor delivered over it protects an account from everyone except
 * the attacker it exists to stop.
 *
 * Three shapes, and the separation between them is the security property:
 *
 * - `setup` hands out a secret and enables nothing. It stays provisional until
 *   a code proves the user actually stored it, so nobody ends up locked out of
 *   an account by a secret they never saved.
 * - `enable` is the proof, and the only thing that turns it on.
 * - `disable` takes the password **and** a code together. Either one alone is
 *   a case this feature exists to survive — a stolen phone, or a stolen
 *   password — so either one alone would defeat it.
 */

export interface TwoFactorStatus {
  enabled: boolean;
  enabledAt: string | null;
  /** A secret was issued and never confirmed — the enrolment can be resumed. */
  setupPending: boolean;
  /**
   * How many one-time recovery codes are left.
   *
   * There is **no endpoint to regenerate them**, so this number only ever goes
   * down. A screen showing it is the only warning the user gets before the last
   * one is spent.
   */
  recoveryCodesRemaining: number;
  /**
   * The platform requires it for this account — `security.admin_2fa_required`
   * is on and this is an administrator. They are not forbidden, they are
   * unenrolled, and the console answers `403 ADMIN_2FA_REQUIRED` until they are.
   */
  required: boolean;
}

/**
 * The provisional secret. Render `otpauthUri` as a QR **and** show `secret` as
 * text — somebody enrolling on the phone that is displaying the page cannot
 * scan the screen it is on.
 */
export interface TwoFactorSetup {
  secret: string;
  /** `otpauth://totp/…` — what the QR encodes. */
  otpauthUri: string;
  digits: number;
  periodSeconds: number;
}

/** What `enable` answers with. The codes are shown once and never again. */
export interface TwoFactorEnableResult {
  status: TwoFactorStatus;
  /**
   * One-time recovery codes, or `null` when the server issued none.
   *
   * Null and empty are different: null means this response carried no codes,
   * and a screen must not print "you have no recovery codes" over a server that
   * simply did not send them in this shape.
   */
  recoveryCodes: string[] | null;
}

/**
 * A login that stopped one step short.
 *
 * **Branch on `twoFactorRequired`, never on whether `tokens` came back.** The
 * challenge token opens nothing — it carries its own type and audience and the
 * API refuses it as a bearer — so treating its presence as a session is both
 * wrong and silently wrong.
 */
export interface TwoFactorChallenge {
  twoFactorRequired: true;
  /** Five minutes. Expiring it is a normal outcome, not an error to hide. */
  challengeToken: string;
}

export interface TwoFactorVerifyRequest {
  challengeToken: string;
  /** Six digits from the app, or one of the recovery codes. */
  code: string;
}

export interface TwoFactorEnableRequest {
  code: string;
}

export interface TwoFactorDisableRequest {
  password: string;
  code: string;
}

// ── Wire ──────────────────────────────────────────────────────────────────

export interface WireTwoFactorStatusResponse {
  twoFactor: WireTwoFactorStatus;
}

export interface WireTwoFactorStatus {
  enabled: boolean;
  enabledAt?: string | null;
  setupPending?: boolean;
  recoveryCodesRemaining?: number;
  required?: boolean;
}

export interface WireTwoFactorSetupResponse {
  setup: TwoFactorSetup;
}

export interface WireTwoFactorEnableResponse {
  twoFactor?: WireTwoFactorStatus;
  recoveryCodes?: string[] | null;
}

// ── Adapters ──────────────────────────────────────────────────────────────

export function twoFactorStatusFromWire(wire: WireTwoFactorStatus): TwoFactorStatus {
  return {
    enabled: wire.enabled,
    enabledAt: wire.enabledAt ?? null,
    setupPending: wire.setupPending ?? false,
    recoveryCodesRemaining: wire.recoveryCodesRemaining ?? 0,
    required: wire.required ?? false,
  };
}

/**
 * Whether a login response is the challenge rather than a session.
 *
 * A type guard rather than a truthiness check at each call site: the two
 * shapes share no field, and a caller that reached for `tokens` on the wrong
 * one would read `undefined` and sign nobody in without failing.
 */
export function isTwoFactorChallenge(value: unknown): value is TwoFactorChallenge {
  return !!value && (value as TwoFactorChallenge).twoFactorRequired === true;
}
