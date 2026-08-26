import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import type {
  NotificationPreference,
  RenterProfile,
  RenterProfileRequest,
} from '@core/models/renter.model';
import { map } from 'rxjs/operators';
import { AccountService } from '@core/services/account.service';
import { ApiService } from '@core/services/api.service';
import type { User } from '@core/models/user.model';

/** FR-AUTH-09 — the current password is required, so this is never a bare set. */
export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * The renter's account screen (RNT-09).
 *
 * The ID number is absent from the update payload on purpose: the design marks
 * it "غير قابل للتعديل", and it is the field Nafath verification is bound to.
 * Letting it through here would silently invalidate a completed verification.
 */
@Injectable()
export class RenterAccountService {
  private readonly api = inject(ApiService);
  private readonly me = inject(AccountService);

  /**
   * The profile lives at `/me`, not under `/account` — one endpoint for both
   * portals, because a renter and a lessor edit the same record.
   *
   * `AccountService` owns it and updates the session as a side effect, so the
   * topbar cannot go on showing a name the user has just changed.
   */
  profile(): Observable<RenterProfile> {
    return this.me.profile().pipe(map(toRenterProfile));
  }

  /**
   * **The mobile number is not sent and must not be.**
   *
   * Changing it is a security event with its own flow — an OTP to the new
   * number — and the server strips the field rather than refusing the request.
   * A form that offered the control would appear to save and silently not.
   */
  updateProfile(payload: RenterProfileRequest): Observable<RenterProfile> {
    return this.me
      .updateProfile({
        fullName: payload.fullName,
        email: payload.email,
        addressLine: payload.address,
      })
      .pipe(map(toRenterProfile));
  }

  changePassword(payload: PasswordChangeRequest): Observable<void> {
    return this.api.post<void, PasswordChangeRequest>(API_ENDPOINTS.auth.changePassword, payload);
  }

  notificationPreferences(): Observable<NotificationPreference[]> {
    return this.api.get<NotificationPreference[]>(API_ENDPOINTS.account.notificationPreferences);
  }

  updateNotificationPreferences(
    preferences: NotificationPreference[],
  ): Observable<NotificationPreference[]> {
    return this.api.put<NotificationPreference[], { preferences: NotificationPreference[] }>(
      API_ENDPOINTS.account.notificationPreferences,
      { preferences },
    );
  }

  /**
   * FR-AUTH-10. The server refuses while a live booking exists and keeps the
   * issued invoices regardless — both are stated on screen before the button is
   * pressed, so the refusal is never a surprise.
   */
  deleteAccount(): Observable<void> {
    return this.api.delete<void>(API_ENDPOINTS.account.delete);
  }
}

/**
 * The screen's shape, from the account the API actually returns.
 *
 * `/me` sends one user for every portal; this page was written against a
 * renter-specific projection that no endpoint produces. Narrowing here keeps
 * the difference in one function instead of across the template.
 */
function toRenterProfile(user: User): RenterProfile {
  return {
    fullName: user.fullName,
    // `/me` nests the identity and sends four digits. The mask is drawn here
    // rather than sent, because the API has no fuller number to mask.
    idNumberMasked: user.identity ? `••••••${user.identity.idNumberLast4}` : '',
    address: user.addressLine ?? '',
    mobile: user.mobile,
    mobileVerifiedAt: user.mobileVerifiedAt ?? undefined,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
  };
}
