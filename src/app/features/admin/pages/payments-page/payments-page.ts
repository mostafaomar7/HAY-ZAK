import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BOOKING_STATUS_DISPLAY, statusText } from '@core/constants/status-display';
import { BookingStatus } from '@core/enums/booking-status.enum';
import { LanguageService } from '@core/i18n/language.service';
import type { AdminBookingRow } from '@core/models/admin.model';
import type { RevenueReport } from '@core/models/admin-reports';
import { halalasToSar } from '@core/utils/money.utils';
import { UiBadge } from '@shared/components/ui-badge/ui-badge';
import { AdminFilterBar } from '../../components/admin-filter-bar/admin-filter-bar';
import type { AdminFilterValues } from '../../components/admin-filter-bar/admin-filter-bar';
import { AdminKpiCard } from '../../components/admin-kpi-card/admin-kpi-card';
import { AdminTable } from '../../components/admin-table/admin-table';
import type { AdminColumn } from '../../components/admin-table/admin-table';
import { AdminFinanceService } from '../../services/admin-finance.service';
import { AdminListState } from '../../services/admin-list-state';
import { AdminReportsService } from '../../services/admin-reports.service';

/** The three windows the console offers everywhere, as a `from` date. */
const PERIODS: Record<string, number> = { last30: 30, last3: 90, year: 365 };

/**
 * ADM-05 — payment tracking (FR-PAY-08).
 *
 * **This screen never worked.** It read `/admin/payments`, an endpoint that has
 * never existed on any version of the API, so it showed "تعذّر تحميل المعاملات
 * — انقطع الاتصال ببوابة الدفع" from the day it was written. The message was
 * also wrong about why: nothing was disconnected, the address was not there.
 *
 * It reads `/admin/bookings` now, which is shipped and carries every figure on
 * the row — what the renter paid, the commission, the lessor's net, and whether
 * the payout is held.
 *
 * Two things it deliberately does not show.
 *
 * **The transfer bucket.** It used to have a column for it. A bucket is a
 * property of a payout run, which covers several bookings and does not exist
 * until an operator approves one — so a booking cannot carry one, and the
 * question is answered on the transfers screen, which this links to instead.
 *
 * **Whether a refund was issued.** The list does not say, and the booking's own
 * detail does. A column that guessed from the status would read "collected" on
 * a booking whose money went back out.
 *
 * The indicators come from `/admin/reports/revenue` rather than from adding up
 * the rows on screen. Summing a page of twenty out of two hundred and labelling
 * the result "إجمالي التحصيل" is the failure this screen exists to avoid.
 */
@Component({
  selector: 'app-admin-payments-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminFinanceService, AdminReportsService],
  imports: [RouterLink, AdminFilterBar, AdminKpiCard, AdminTable, UiBadge],
  templateUrl: './payments-page.html',
  styleUrl: './payments-page.scss',
})
export class AdminPaymentsPage {
  private readonly finance = inject(AdminFinanceService);
  private readonly reports = inject(AdminReportsService);

  protected readonly i18n = inject(LanguageService);
  protected readonly list = new AdminListState();

  protected readonly rows = signal<readonly AdminBookingRow[]>([]);
  protected readonly revenue = signal<RevenueReport | null>(null);

  /**
   * The period's real figures, across every booking in it — not the page.
   *
   * A dash while the report is unavailable, rather than a zero: "٠ ريال
   * محصّلة" is a claim, and one nobody would question on a finance screen.
   */
  protected readonly cards = computed(() => {
    const revenue = this.revenue();
    const money = (halalas: number | undefined) =>
      halalas === undefined ? '—' : format(halalasToSar(halalas));

    return [
      {
        key: 'collected',
        label: this.i18n.t('payments.kpiCollected'),
        value: money(revenue?.collectedHalalas),
        icon: 'card' as const,
      },
      {
        key: 'commission',
        label: this.i18n.t('payments.kpiCommission'),
        value: money(revenue?.commissionHalalas),
        icon: 'file' as const,
      },
      {
        key: 'owed',
        label: this.i18n.t('payments.kpiOwed'),
        value: money(revenue?.owedToLessorsHalalas),
        icon: 'clock' as const,
      },
      {
        key: 'refunded',
        label: this.i18n.t('payments.kpiRefunded'),
        value: money(revenue?.refundedHalalas),
        icon: 'check' as const,
      },
    ];
  });

  protected readonly columns = computed<AdminColumn[]>(() => [
    { key: 'renter', label: this.i18n.t('payments.renter'), width: '1.2fr' },
    { key: 'lessor', label: this.i18n.t('payments.lessor'), width: '1fr' },
    { key: 'unit', label: this.i18n.t('payments.unit'), width: '1.6fr' },
    { key: 'totalHalalas', label: this.i18n.t('payments.total'), width: '0.9fr' },
    { key: 'commissionHalalas', label: this.i18n.t('payments.commission'), width: '0.8fr' },
    { key: 'netToLessorHalalas', label: this.i18n.t('payments.net'), width: '0.9fr' },
    { key: 'status', label: this.i18n.t('admin.status'), width: '1.2fr' },
  ]);

  protected readonly selects = computed(() => [
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
    {
      key: 'status',
      label: this.i18n.t('admin.status'),
      options: [
        { value: '', label: this.i18n.t('admin.allStatuses') },
        ...Object.values(BookingStatus).map((status) => ({
          value: status,
          label: this.statusLabel(status),
        })),
      ],
    },
  ]);

  constructor() {
    this.fetch();
  }

  protected fetch(): void {
    this.list.begin();
    const filters = this.list.filters();
    const from = since(filters['period']);

    this.finance
      .bookings({
        status: (filters['status'] as BookingStatus) || undefined,
        // Reference number, either party, or the listing's title.
        search: filters['search'] || undefined,
        from,
        page: this.list.page(),
      })
      .subscribe({
        next: (page) => {
          this.rows.set(page.items);
          this.list.succeed(page.items.length, page.pagination.total);
        },
        error: () => this.list.fail(),
      });

    // The indicators are a separate report and fail on their own: a broken
    // revenue call must not blank the table under it.
    this.reports.revenue({ from }).subscribe({
      next: (report) => this.revenue.set(report),
      error: () => this.revenue.set(null),
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

  protected statusLabel(status: BookingStatus): string {
    return statusText(BOOKING_STATUS_DISPLAY[status], this.i18n.language());
  }

  protected statusTone(status: BookingStatus) {
    return BOOKING_STATUS_DISPLAY[status].tone;
  }
}

/** Latin digits with thousands separators; the numeric mixin isolates them. */
function format(value: number): string {
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(value);
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
