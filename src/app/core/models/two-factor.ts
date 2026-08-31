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
   * How many one-time recovery codes are left, out of the ten issued.
   *
   * It only goes down until the set is replaced wholesale — there is no way to
   * top it up — so the screen warns while there is still time to act, at three
   * or fewer. Somebody who lets it reach zero and then loses their phone has
   * no way back into the account from inside the product.
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
 * The provisional secret.
 *
 * Shown as text and as an `otpauth://` link, **not** as a QR code. The guide
 * asked for a QR and then withdrew it: most people enrol on the phone that is
 * displaying this page, and that phone cannot photograph its own screen. The
 * link opens the authenticator directly, which is strictly better there.
 */
export interface TwoFactorSetup {
  secret: string;
  /** `otpauth://totp/…` — what the QR encodes. */
  otpauthUri: string;
  digits: number;
  periodSeconds: number;
}

/**
 * What `enable` and `recovery-codes` both answer with.
 *
 * **Ten codes, ten characters each, shown exactly once.** They are stored
 * hashed, so there is no endpoint that reads them back — not a policy that
 * could be relaxed, but an absence of anything to read. The server says so in
 * the response itself, and this carries that flag through rather than leaving
 * a screen to assume it can fetch them again.
 */
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
  /** The server's own statement that this is the only time they are readable. */
  shownOnce: boolean;
}

/**
 * Replacing the whole set — the way out of "I have used nine of ten".
 *
 * The same proof as turning it off, and for the same reason: this hands over
 * ten fresh keys to the account.
 */
export interface TwoFactorRecoveryCodesRequest {
  password: string;
  /** A current TOTP code. A recovery code is refused here. */
  code: string;
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
  /**
   * Five minutes, then `401 TWO_FACTOR_CHALLENGE_INVALID`.
   *
   * That one code covers expired, tampered-with, and an access token passed in
   * its place — deliberately, so the response tells an attacker which of the
   * three happened. Expiring is a normal outcome: the screen sends the user
   * back to sign in rather than showing a failure.
   */
  challengeToken: string;
}

export interface TwoFactorVerifyRequest {
  challengeToken: string;
  /**
   * Six digits from the app, **or** one of the ten-character recovery codes.
   *
   * One field, no type flag: the server tells them apart by shape. So the
   * login screen offers one input and never asks the user to classify what
   * they are holding — which, at the moment somebody has lost their phone, is
   * the last question to put to them.
   */
  code: string;
}

export interface TwoFactorEnableRequest {
  code: string;
}

/**
 * Turning it off needs both, and **a recovery code is not accepted here** —
 * only a live TOTP code. Recovery gets you into the account; it does not take
 * the lock off it.
 */
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
  recoveryCodesShownOnce?: boolean;
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
