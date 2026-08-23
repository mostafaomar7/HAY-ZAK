import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PAYOUT_STATUS_DISPLAY, statusText } from '@core/constants/status-display';
import { PayoutStatus } from '@core/enums/payment.enum';
import { LanguageService } from '@core/i18n/language.service';
import type { PaymentTrackingRow } from '@core/models/admin.model';
import { UiBadge } from '@shared/components/ui-badge/ui-badge';
import { AdminFilterBar } from '../../components/admin-filter-bar/admin-filter-bar';
import type { AdminFilterValues } from '../../components/admin-filter-bar/admin-filter-bar';
import { AdminKpiCard } from '../../components/admin-kpi-card/admin-kpi-card';
import { AdminTable } from '../../components/admin-table/admin-table';
import type { AdminColumn, AdminSort } from '../../components/admin-table/admin-table';
import { AdminFinanceService } from '../../services/admin-finance.service';
import { AdminListState } from '../../services/admin-list-state';

/**
 * ADM-05 — payment tracking (FR-PAY-08).
 *
 * Read-only by design. Every figure here is the consequence of something that
 * already happened — a collection, a commission, a transfer — and the place to
 * change any of them is the screen that performs the act, not the ledger that
 * reports it.
 *
 * The four indicators are computed from the rows on screen rather than fetched:
 * a separate summary endpoint would let the header disagree with the table under
 * it the moment a filter is applied.
 */
@Component({
  selector: 'app-admin-payments-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminFinanceService],
  imports: [AdminFilterBar, AdminKpiCard, AdminTable, UiBadge],
  templateUrl: './payments-page.html',
  styleUrl: './payments-page.scss',
})
export class AdminPaymentsPage {
  private readonly finance = inject(AdminFinanceService);

  protected readonly i18n = inject(LanguageService);
  protected readonly list = new AdminListState();

  protected readonly rows = signal<PaymentTrackingRow[]>([]);

  protected readonly cards = computed(() => {
    const rows = this.rows();
    const sum = (pick: (row: PaymentTrackingRow) => number) =>
      format(rows.reduce((total, row) => total + pick(row), 0));

    return [
      {
        key: 'collected',
        label: this.i18n.t('payments.kpiCollected'),
        value: sum((row) => row.totalAmount),
        icon: 'card' as const,
      },
      {
        key: 'commission',
        label: this.i18n.t('payments.kpiCommission'),
        value: sum((row) => row.commissionAmount),
        icon: 'file' as const,
      },
      {
        key: 'transferred',
        label: this.i18n.t('payments.kpiTransferred'),
        value: sum((row) => (row.payoutStatus === PayoutStatus.Paid ? row.netAmount : 0)),
        icon: 'check' as const,
      },
      {
        key: 'pending',
        label: this.i18n.t('payments.kpiPending'),
        value: sum((row) => (row.payoutStatus === PayoutStatus.Paid ? 0 : row.netAmount)),
        icon: 'clock' as const,
      },
    ];
  });

  protected readonly columns = computed<AdminColumn[]>(() => [
    { key: 'renterName', label: this.i18n.t('payments.renter'), width: '1.1fr' },
    { key: 'lessorName', label: this.i18n.t('payments.lessor'), width: '1fr' },
    { key: 'unitTitle', label: this.i18n.t('payments.unit'), width: '1.7fr' },
    { key: 'totalAmount', label: this.i18n.t('payments.total'), width: '0.9fr', sortable: true },
    { key: 'commissionAmount', label: this.i18n.t('payments.commission'), width: '0.8fr' },
    { key: 'netAmount', label: this.i18n.t('payments.net'), width: '0.9fr', sortable: true },
    { key: 'collection', label: this.i18n.t('payments.collectionStatus'), width: '1fr' },
    { key: 'payoutStatus', label: this.i18n.t('payments.transferStatus'), width: '1.3fr' },
  ]);

  protected readonly selects = computed(() => [
    {
      key: 'period',
      label: this.i18n.t('admin.period'),
      options: [
        { value: 'last30', label: this.i18n.t('admin.last30') },
        { value: 'last3', label: this.i18n.t('admin.last3Months') },
        { value: 'year', label: this.i18n.t('admin.thisYear') },
      ],
    },
    {
      key: 'collection',
      label: this.i18n.t('payments.collectionStatus'),
      options: [
        { value: '', label: this.i18n.t('admin.allStatuses') },
        { value: 'collected', label: this.i18n.t('payments.collected') },
        { value: 'refunded', label: this.i18n.t('payments.refunded') },
      ],
    },
    {
      key: 'payoutStatus',
      label: this.i18n.t('payments.transferStatus'),
      options: [
        { value: '', label: this.i18n.t('admin.allStatuses') },
        ...Object.values(PayoutStatus).map((status) => ({
          value: status,
          label: statusText(PAYOUT_STATUS_DISPLAY[status], this.i18n.language()),
        })),
      ],
    },
    {
      key: 'lessorId',
      label: this.i18n.t('admin.lessor'),
      options: [{ value: '', label: this.i18n.t('admin.allLessors') }],
    },
  ]);

  constructor() {
    this.fetch();
  }

  protected fetch(): void {
    this.list.begin();
    this.finance.payments(this.list.params()).subscribe({
      next: (page) => {
        this.rows.set(page.items);
        this.list.succeed(page.items.length, page.totalCount);
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

  protected onSort(sort: AdminSort): void {
    this.list.setSort(sort);
    this.fetch();
  }

  protected onPage(page: number): void {
    this.list.setPage(page);
    this.fetch();
  }

  protected payoutDisplay(status: PayoutStatus) {
    return PAYOUT_STATUS_DISPLAY[status];
  }

  protected payoutLabel(status: PayoutStatus): string {
    return statusText(PAYOUT_STATUS_DISPLAY[status], this.i18n.language());
  }
}

function format(value: number): string {
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(value);
}
