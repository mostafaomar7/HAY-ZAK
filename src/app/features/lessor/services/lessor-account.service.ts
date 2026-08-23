import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import type { LessorDashboard, LessorEarnings, Payout } from '@core/models';
import type { PaginatedResponse } from '@core/models/api-response.model';
import type { BankAccountRequest, LessorBankAccount } from '@core/models/user.model';
import { ApiService } from '@core/services/api.service';
import { saveBlob } from '@core/utils/file.utils';
import type { EarningsResponse } from '@core/models/earnings.model';

/**
 * Dashboard, earnings and bank details — FR-LSR-01, FR-LSR-02, FR-LSR-08.
 * Root-provided because the dashboard summary is read from several screens.
 */
@Injectable({ providedIn: 'root' })
export class LessorAccountService {
  private readonly api = inject(ApiService);

  dashboard(): Observable<LessorDashboard> {
    return this.api.get<LessorDashboard>(API_ENDPOINTS.lessor.dashboard);
  }

  /** FR-LSR-08 — paid bookings, commission deducted, net, transfer status. */
  earnings(fromDate?: string, toDate?: string): Observable<LessorEarnings> {
    return this.api.get<LessorEarnings>(API_ENDPOINTS.lessor.earnings, {
      params: { fromDate, toDate },
    });
  }

  /**
   * LSR-07 — the dues table. Separate from `earnings()` because the screen needs
   * the per-booking rows joined with their commission and payout, which the
   * summary endpoint does not carry.
   */
  earningsTable(fromDate: string, toDate: string): Observable<EarningsResponse> {
    return this.api.get<EarningsResponse>(API_ENDPOINTS.lessor.earningsTable, {
      params: { fromDate, toDate },
    });
  }

  payouts(pageNumber = 1): Observable<PaginatedResponse<Payout>> {
    return this.api.get<PaginatedResponse<Payout>>(API_ENDPOINTS.payments.payouts, {
      params: { pageNumber },
    });
  }

  /** FR-LSR-10 — PDF earnings statement for a period. */
  downloadStatement(fromDate: string, toDate: string): Observable<Blob> {
    return this.api.download(API_ENDPOINTS.lessor.earningsStatement, {
      params: { fromDate, toDate },
    });
  }

  saveStatement(blob: Blob, fromDate: string, toDate: string): void {
    saveBlob(blob, `hayzak-earnings-${fromDate}-${toDate}.pdf`);
  }

  bankAccounts(): Observable<LessorBankAccount[]> {
    return this.api.get<LessorBankAccount[]>(API_ENDPOINTS.lessor.bankAccounts);
  }

  /**
   * FR-LSR-02 — IBAN is validated client-side (format + mod-97) before it gets
   * here, and stored encrypted server-side (NFR-SEC-02). The response only ever
   * returns it masked.
   */
  addBankAccount(payload: BankAccountRequest): Observable<LessorBankAccount> {
    return this.api.post<LessorBankAccount, BankAccountRequest>(
      API_ENDPOINTS.lessor.bankAccounts,
      payload,
    );
  }

  updateBankAccount(id: string, payload: BankAccountRequest): Observable<LessorBankAccount> {
    return this.api.put<LessorBankAccount, BankAccountRequest>(
      API_ENDPOINTS.lessor.bankAccountById(id),
      payload,
    );
  }
}
