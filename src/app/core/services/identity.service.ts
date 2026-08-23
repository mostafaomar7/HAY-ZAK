import { HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../constants/api-endpoints';
import { SKIP_ERROR_TOAST } from '../interceptors/error.interceptor';
import type { IdentityVerification, NafathSession } from '../models/identity.model';
import { ApiService } from './api.service';

/**
 * Nafath identity verification (RNT-09).
 *
 * In core rather than in the booking feature because two places need it: the
 * third step of the booking wizard, and the verification card on the renter's
 * account page.
 *
 * Nothing here uploads anything. The design states plainly that the check
 * happens inside the Nafath app and that the platform asks for no ID photo and
 * no selfie — so this service has a start call, a status call, and nothing else.
 */
@Injectable({ providedIn: 'root' })
export class IdentityService {
  private readonly api = inject(ApiService);

  /** Opens a Nafath session and returns the number to select in the app. */
  start(): Observable<NafathSession> {
    return this.api.post<NafathSession>(API_ENDPOINTS.auth.nafathStart);
  }

  /**
   * Polled while the card sits in the "awaiting" state.
   *
   * The error toast is suppressed: a poll that fails is retried on the next tick
   * and a stack of toasts would bury the confirmation number the user is trying
   * to read.
   */
  status(requestId: string): Observable<NafathSession> {
    return this.api.get<NafathSession>(API_ENDPOINTS.auth.nafathStatus(requestId), {
      context: new HttpContext().set(SKIP_ERROR_TOAST, true),
    });
  }

  /** The verification block on the account screen. */
  current(): Observable<IdentityVerification> {
    return this.api.get<IdentityVerification>(API_ENDPOINTS.account.identity);
  }
}
