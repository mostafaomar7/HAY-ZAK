import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import type {
  NotificationPreference,
  RenterProfile,
  RenterProfileRequest,
} from '@core/models/renter.model';
import { ApiService } from '@core/services/api.service';

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

  profile(): Observable<RenterProfile> {
    return this.api.get<RenterProfile>(API_ENDPOINTS.account.profile);
  }

  updateProfile(payload: RenterProfileRequest): Observable<RenterProfile> {
    return this.api.put<RenterProfile, RenterProfileRequest>(
      API_ENDPOINTS.account.profile,
      payload,
    );
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
