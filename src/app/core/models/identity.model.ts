import type { VerificationStatus } from '../enums/user-role.enum';

/**
 * Nafath identity verification — the third step of the booking wizard (RNT-09).
 *
 * The design is explicit that the check happens inside the Nafath app alone and
 * that the platform never asks for an ID photo or a selfie. Nothing here uploads
 * a file, and nothing here accepts a typed ID number: the number shown on screen
 * comes from the registration record and is read-only in this step.
 */
export type NafathState =
  /** Nothing started yet — the card shows the "verify" button. */
  | 'idle'
  /** The user must open Nafath and pick the number shown on screen. */
  | 'awaiting'
  | 'success'
  /** Session timed out or the user declined inside the app. */
  | 'failed'
  /** Nafath returned a name that does not match the registered one. */
  | 'mismatch';

export interface NafathSession {
  requestId: string;
  /**
   * The two-digit number the user has to select inside the Nafath app. Displayed
   * large — it is the whole point of the screen.
   */
  confirmationNumber: string;
  state: NafathState;
  /** When the Nafath session itself lapses — separate from the booking hold. */
  expiresAt: string;
  /** Populated on success, so the UI can show the authoritative name. */
  verifiedName?: string;
}

/** The verification block on the renter's account page (RNT-09). */
export interface IdentityVerification {
  /** Masked by the API — never the full number (NFR-SEC-02). */
  idNumberMasked: string;
  status: VerificationStatus;
  verifiedAt?: string;
}
