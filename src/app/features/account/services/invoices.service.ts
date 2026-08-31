import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import type { PaginatedResponse } from '@core/models/api-response.model';
import type { TaxInvoice, WireTaxInvoice } from '@core/models/tax-invoice';
import { taxInvoiceFromWire } from '@core/models/tax-invoice';
import { ApiService } from '@core/services/api.service';

/**
 * The tax documents addressed to the signed-in account (FR-PAY-09).
 *
 * Not "the invoices for my bookings": the same person lets a space and rents
 * one, so the list mixes the booking invoice they were charged with the
 * commission invoice they were billed. Both arrive here and both carry `type`,
 * which is the only thing that explains why one booking reference can appear
 * twice with two different totals.
 *
 * There is deliberately no filter. `/me/invoices` takes `page` and `pageSize`
 * and nothing else — narrowing the twenty rows in hand would filter a page
 * rather than the set, and present a partial answer as a complete one.
 */
@Injectable()
export class InvoicesService {
  private readonly api = inject(ApiService);

  list(page = 1): Observable<PaginatedResponse<TaxInvoice>> {
    return this.api.list<WireTaxInvoice>(API_ENDPOINTS.me.invoices, { params: { page } }).pipe(
      map((response) => ({
        items: response.items.map(taxInvoiceFromWire),
        pagination: response.pagination,
      })),
    );
  }
}
