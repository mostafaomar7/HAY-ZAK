import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import type { PaginatedResponse } from '@core/models/api-response.model';
import type { InvoiceType, TaxInvoice, WireTaxInvoice } from '@core/models/tax-invoice';
import { taxInvoiceFromWire } from '@core/models/tax-invoice';
import { ApiService } from '@core/services/api.service';

/** What `/admin/invoices` narrows by, and nothing else — see the doc below. */
export interface AdminInvoiceQuery {
  /** Plain `YYYY-MM-DD`, inclusive of its whole day at the `to` end. */
  from?: string;
  to?: string;
  type?: InvoiceType;
  page?: number;
}

/**
 * FR-PAY-09 — the register of every tax document the platform has issued.
 *
 * Read-only, and there is no write side to add: an invoice is the record of
 * something that already happened, and correcting one is a credit note rather
 * than an edit.
 *
 * **The four parameters are the whole vocabulary.** An unknown query parameter
 * is a 422 naming the ones it will accept, so this screen cannot borrow the
 * console's usual `search` and `sortBy` — there is nothing to search by on the
 * server, and the filter bar is built without a search box for that reason
 * rather than as an omission.
 */
@Injectable()
export class AdminInvoicesService {
  private readonly api = inject(ApiService);

  list(query: AdminInvoiceQuery = {}): Observable<PaginatedResponse<TaxInvoice>> {
    return this.api
      .list<WireTaxInvoice>(API_ENDPOINTS.admin.invoices, {
        params: {
          from: query.from,
          to: query.to,
          type: query.type,
          page: query.page,
        },
      })
      .pipe(
        map((response) => ({
          items: response.items.map(taxInvoiceFromWire),
          pagination: response.pagination,
        })),
      );
  }
}
