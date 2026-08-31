import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LanguageService } from '@core/i18n/language.service';
import type { InvoiceType, TaxInvoice } from '@core/models/tax-invoice';
import { formatInstant } from '@core/utils/date.utils';
import { UiBadge } from '@shared/components/ui-badge/ui-badge';
import { AdminFilterBar } from '../../components/admin-filter-bar/admin-filter-bar';
import type { AdminFilterValues } from '../../components/admin-filter-bar/admin-filter-bar';
import { AdminTable } from '../../components/admin-table/admin-table';
import type { AdminColumn } from '../../components/admin-table/admin-table';
import { AdminInvoicesService } from '../../services/admin-invoices.service';
import { AdminListState } from '../../services/admin-list-state';

/** The three windows the console offers everywhere, as a `from` date. */
const PERIODS: Record<string, number> = { last30: 30, last3: 90, year: 365 };

/**
 * FR-PAY-09 — the register of every tax document the platform has issued.
 *
 * Read-only, and deliberately so: an invoice records something that already
 * happened, and there is no endpoint to amend one because the correction for a
 * wrong invoice is a credit note, not an edit.
 *
 * Two things this screen does not offer, both because the server does not.
 *
 * **No search.** `/admin/invoices` takes `from`, `to`, `type` and the page, and
 * a fifth parameter is a 422. A search box that filtered the twenty rows in
 * hand would look like a search of the register and answer for a page.
 *
 * **No column for who it was issued to.** The row carries the invoice, its type
 * and its booking — and no party at all. So the register is reached through the
 * booking reference and nothing on screen pretends otherwise. Raised with the
 * backend.
 */
@Component({
  selector: 'app-admin-invoices-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminInvoicesService],
  imports: [AdminFilterBar, AdminTable, UiBadge],
  templateUrl: './invoices-page.html',
  styleUrl: './invoices-page.scss',
})
export class AdminInvoicesPage {
  private readonly invoices = inject(AdminInvoicesService);

  protected readonly i18n = inject(LanguageService);
  protected readonly list = new AdminListState();

  protected readonly rows = signal<readonly TaxInvoice[]>([]);

  protected readonly columns = computed<AdminColumn[]>(() => [
    { key: 'invoiceNo', label: this.i18n.t('adminInvoices.number'), width: '1.2fr' },
    { key: 'type', label: this.i18n.t('adminInvoices.kind'), width: '1fr' },
    { key: 'issuedAt', label: this.i18n.t('adminInvoices.issuedAt'), width: '1.1fr' },
    { key: 'booking', label: this.i18n.t('invoices.bookingRef'), width: '1.4fr' },
    { key: 'taxableHalalas', label: this.i18n.t('adminInvoices.taxable'), width: '0.9fr' },
    { key: 'vatHalalas', label: this.i18n.t('adminInvoices.vat'), width: '0.8fr' },
    { key: 'totalHalalas', label: this.i18n.t('invoices.total'), width: '0.9fr' },
  ]);

  protected readonly selects = computed(() => [
    {
      key: 'type',
      label: this.i18n.t('adminInvoices.kind'),
      options: [
        { value: '', label: this.i18n.t('adminInvoices.allKinds') },
        { value: 'BOOKING', label: this.i18n.t('invoices.typeBooking') },
        { value: 'COMMISSION', label: this.i18n.t('invoices.typeCommission') },
      ],
    },
    {
      key: 'period',
      label: this.i18n.t('admin.period'),
      options: [
        { value: '', label: this.i18n.t('adminInvoices.allPeriods') },
        { value: 'last30', label: this.i18n.t('admin.last30') },
        { value: 'last3', label: this.i18n.t('admin.last3Months') },
        { value: 'year', label: this.i18n.t('admin.thisYear') },
      ],
    },
  ]);

  constructor() {
    this.fetch();
  }

  protected fetch(): void {
    this.list.begin();
    const filters = this.list.filters();

    this.invoices
      .list({
        // `period` is this screen's control and not the API's — it is turned
        // into a `from` date here, because sending it as written is the 422
        // that an unknown query parameter always is.
        from: since(filters['period']),
        type: (filters['type'] as InvoiceType) || undefined,
        page: this.list.page(),
      })
      .subscribe({
        next: (response) => {
          this.rows.set(response.items);
          this.list.succeed(response.items.length, response.pagination.total);
        },
        error: () => this.list.fail(),
      });
  }

  protected onFilters(values: AdminFilterValues): void {
    this.list.applyFilters(values);
    this.fetch();
  }

  protected onReset(): void {
    this.list.resetFilters();
    this.fetch();
  }

  protected onPage(page: number): void {
    this.list.setPage(page);
    this.fetch();
  }

  protected issuedAt(invoice: TaxInvoice): string {
    return formatInstant(invoice.issuedAt);
  }

  protected typeLabel(type: InvoiceType): string {
    return type === 'COMMISSION'
      ? this.i18n.t('invoices.typeCommission')
      : this.i18n.t('invoices.typeBooking');
  }

  protected typeTone(type: InvoiceType): 'info' | 'neutral' {
    return type === 'COMMISSION' ? 'neutral' : 'info';
  }
}

/** `YYYY-MM-DD`, or undefined for "no window" — never a filter sent empty. */
function since(period: string | undefined): string | undefined {
  const days = period ? PERIODS[period] : undefined;
  if (!days) return undefined;

  const from = new Date();
  from.setDate(from.getDate() - days);
  // Local, not `toISOString()`: the platform runs on one timezone, and UTC
  // would shift the boundary a day for anyone filtering late in the evening.
  const offset = from.getTimezoneOffset() * 60_000;
  return new Date(from.getTime() - offset).toISOString().slice(0, 10);
}
