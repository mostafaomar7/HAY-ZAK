import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import type { PaginatedResponse } from '@core/models/api-response.model';
import type {
  CommissionException,
  CommissionExceptionRequest,
  LessorBankDetails,
  PaymentTrackingRow,
  PayoutExecution,
  PayoutGroup,
  PayoutReschedule,
} from '@core/models/admin.model';
import type { PlatformSettings } from '@core/models/operations.model';
import { ApiService } from '@core/services/api.service';

/** Payments, payouts and the financial configuration (FR-PAY, FR-ADM-06). */
@Injectable()
export class AdminFinanceService {
  private readonly api = inject(ApiService);

  payments(params: Record<string, string>): Observable<PaginatedResponse<PaymentTrackingRow>> {
    return this.api.list<PaymentTrackingRow>(API_ENDPOINTS.payments.tracking, {
      params,
    });
  }

  payoutGroups(): Observable<PayoutGroup[]> {
    return this.api.get<PayoutGroup[]>(API_ENDPOINTS.payments.payouts);
  }

  /**
   * The unmasked IBAN, fetched only when the operator asks to see it.
   *
   * A separate request rather than a field on the group: the read is itself an
   * auditable event (NFR-SEC-02), and a payload that always carried the full
   * number would be logged, cached and screenshotted along with it.
   */
  bankDetails(payoutId: string): Observable<LessorBankDetails> {
    return this.api.get<LessorBankDetails>(API_ENDPOINTS.payments.payoutBankDetails(payoutId));
  }

  executePayout(id: string, execution: PayoutExecution): Observable<void> {
    return this.api.post<void, PayoutExecution>(
      API_ENDPOINTS.payments.executePayout(id),
      execution,
    );
  }

  reschedulePayout(id: string, reschedule: PayoutReschedule): Observable<void> {
    return this.api.post<void, PayoutReschedule>(
      API_ENDPOINTS.payments.reschedulePayout(id),
      reschedule,
    );
  }

  demandBankDetails(lessorId: string, message: string): Observable<void> {
    return this.api.post<void, { message: string }>(
      API_ENDPOINTS.payments.demandBankDetails(lessorId),
      { message },
    );
  }

  settings(): Observable<PlatformSettings> {
    return this.api.get<PlatformSettings>(API_ENDPOINTS.admin.settings);
  }

  saveSettings(settings: Partial<PlatformSettings>): Observable<PlatformSettings> {
    return this.api.put<PlatformSettings, Partial<PlatformSettings>>(
      API_ENDPOINTS.admin.settings,
      settings,
    );
  }

  exceptions(): Observable<CommissionException[]> {
    return this.api.get<CommissionException[]>(API_ENDPOINTS.admin.commissionExceptions);
  }

  addException(request: CommissionExceptionRequest): Observable<CommissionException> {
    return this.api.post<CommissionException, CommissionExceptionRequest>(
      API_ENDPOINTS.admin.commissionExceptions,
      request,
    );
  }

  removeException(id: string): Observable<void> {
    return this.api.delete<void>(API_ENDPOINTS.admin.commissionExceptionById(id));
  }
}
