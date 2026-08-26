import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { API_ENDPOINTS } from '../constants/api-endpoints';
import type { BankAccountRequest, LessorBankAccount, User } from '../models/user.model';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

/** What the profile screen may change. Deliberately narrow — see `updateProfile`. */
export interface ProfileRequest {
  fullName?: string;
  email?: string;
  addressLine?: string;
  locale?: 'ar' | 'en';
}

/**
 * The signed-in account: its profile and its bank details (`/me`).
 *
 * In core rather than the lessor feature because both portals reach it — a
 * renter edits the same profile — and because `AuthService` needs the updated
 * user back so the topbar and the guards do not go on showing the old one.
 */
@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  /** `{ user }`, not a bare user — the same wrapper `/auth/me` uses. */
  profile(): Observable<User> {
    return this.api.get<{ user: User }>(API_ENDPOINTS.me.profile).pipe(
      map((result) => result.user),
      tap((user) => this.auth.setUser(user)),
    );
  }

  /**
   * Saves the profile.
   *
   * **The mobile number is not in here and must not be.** Changing it is a
   * security event with its own flow — an OTP to the *new* number — and the
   * server strips the field rather than refusing the request, so a form that
   * offered the control would appear to save and silently not.
   *
   * `locale` is more than a display preference: the same notifications go out
   * by SMS in that language, and a screen that disagreed with the message on
   * somebody's phone would be the screen that is wrong.
   */
  updateProfile(payload: ProfileRequest): Observable<User> {
    return this.api.patch<{ user: User }, ProfileRequest>(API_ENDPOINTS.me.profile, payload).pipe(
      map((result) => result.user),
      tap((user) => this.auth.setUser(user)),
    );
  }

  // ── Bank accounts (FR-LSR-02) ──────────────────────────────────────────

  /** A bare list — no pagination on this one. */
  bankAccounts(): Observable<LessorBankAccount[]> {
    return this.api
      .get<{ items: LessorBankAccount[] }>(API_ENDPOINTS.me.bankAccounts)
      .pipe(map((result) => result.items ?? []));
  }

  /**
   * Adds one.
   *
   * The response carries the bank the API resolved from the IBAN, which is the
   * one thing worth putting in front of the lessor afterwards: a transposed
   * digit usually still passes the checksum of *some* other bank, and the
   * person who typed it is the only one who can tell.
   */
  addBankAccount(payload: BankAccountRequest): Observable<LessorBankAccount> {
    return this.api
      .post<{ account: LessorBankAccount }, BankAccountRequest>(
        API_ENDPOINTS.me.bankAccounts,
        payload,
      )
      .pipe(map((result) => result.account));
  }

  /**
   * Moves where the money goes.
   *
   * A second account does not take over on its own — only the first is default
   * — so this is always deliberate, and the screen confirms before calling it.
   */
  makeDefault(id: string): Observable<LessorBankAccount> {
    return this.api
      .put<{ account: LessorBankAccount }>(API_ENDPOINTS.me.makeBankAccountDefault(id))
      .pipe(map((result) => result.account));
  }

  /** The last account cannot go — the server answers `BANK_ACCOUNT_LAST_ONE`. */
  removeBankAccount(id: string): Observable<void> {
    return this.api.delete<void>(API_ENDPOINTS.me.bankAccountById(id));
  }
}
