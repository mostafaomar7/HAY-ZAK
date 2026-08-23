import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LanguageService } from '@core/i18n/language.service';
import type {
  BookingsReportRow,
  OccupancyReportRow,
  PayoutReportRow,
  ReportFilters,
  ReportKind,
  RevenueReportRow,
} from '@core/models/admin.model';
import { NotificationService } from '@core/services/notification.service';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';
import { UiTabs } from '@shared/components/ui-tabs/ui-tabs';
import type { TabItem } from '@shared/components/ui-tabs/ui-tabs';
import { AdminBarChart } from '../../components/admin-bar-chart/admin-bar-chart';
import type { BarGroup, BarSeries } from '../../components/admin-bar-chart/admin-bar-chart';
import { AdminFilterBar } from '../../components/admin-filter-bar/admin-filter-bar';
import type { AdminFilterValues } from '../../components/admin-filter-bar/admin-filter-bar';
import { AdminMeter } from '../../components/admin-meter/admin-meter';
import type { MeterRow } from '../../components/admin-meter/admin-meter';
import { AdminReportsService } from '../../services/admin-reports.service';
import { AdminSettingsStore } from '../../services/admin-settings.store';
import { hijri, monthLabel } from '../../utils/report.utils';

/**
 * ADM-07 — the four reports (FR-RPT-01 … FR-RPT-05).
 *
 * One screen with four tabs rather than four routes: the filter set is the same
 * on all of them, and an operator comparing bookings against revenue for the
 * same period should not have to re-enter it.
 *
 * Each tab keeps its own rows. Switching back to a tab already fetched shows it
 * immediately rather than flashing a skeleton over data that has not changed.
 */
@Component({
  selector: 'app-admin-reports-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminReportsService],
  imports: [AdminBarChart, AdminFilterBar, AdminMeter, UiButton, UiEmptyState, UiSkeleton, UiTabs],
  templateUrl: './reports-page.html',
  styleUrl: './reports-page.scss',
})
export class AdminReportsPage {
  private readonly reports = inject(AdminReportsService);
  private readonly notifications = inject(NotificationService);

  protected readonly i18n = inject(LanguageService);
  protected readonly settings = inject(AdminSettingsStore);

  protected readonly kind = signal<ReportKind>('bookings');
  protected readonly isLoading = signal(true);
  protected readonly failed = signal(false);
  protected readonly filters = signal<AdminFilterValues>({ period: 'last5' });

  protected readonly bookingRows = signal<BookingsReportRow[]>([]);
  protected readonly revenueRows = signal<RevenueReportRow[]>([]);
  protected readonly payoutRows = signal<PayoutReportRow[]>([]);
  protected readonly occupancyRows = signal<OccupancyReportRow[]>([]);

  protected readonly tabs = computed<TabItem<ReportKind>[]>(() => [
    { value: 'bookings', label: this.i18n.t('reports.bookings') },
    { value: 'revenue', label: this.i18n.t('reports.revenue') },
    { value: 'payouts', label: this.i18n.t('reports.payouts') },
    { value: 'occupancy', label: this.i18n.t('reports.occupancy') },
  ]);

  protected readonly selects = computed(() => [
    {
      key: 'period',
      label: this.i18n.t('admin.period'),
      options: [
        { value: 'last5', label: this.i18n.t('reports.last5Months') },
        { value: 'year', label: this.i18n.t('admin.thisYear') },
      ],
    },
    {
      key: 'cityId',
      label: this.i18n.t('admin.city'),
      options: [{ value: '', label: this.i18n.t('admin.allCities') }],
    },
    {
      key: 'categoryId',
      label: this.i18n.t('admin.category'),
      options: [{ value: '', label: this.i18n.t('admin.allCategories') }],
    },
    {
      key: 'lessorId',
      label: this.i18n.t('admin.lessor'),
      options: [{ value: '', label: this.i18n.t('admin.allLessors') }],
    },
  ]);

  protected readonly isEmpty = computed(() => this.currentLength() === 0);

  // ── Chart data ─────────────────────────────────────────────────────────
  protected readonly bookingSeries = computed<BarSeries[]>(() => [
    { label: this.i18n.t('reports.bookingCount'), tone: 'primary' },
  ]);

  protected readonly bookingGroups = computed<BarGroup[]>(() =>
    this.bookingRows().map((row) => ({
      label: monthLabel(row.month, this.i18n.language()),
      sublabel: hijri(row.month, this.i18n.language()),
      values: [row.count],
    })),
  );

  protected readonly revenueSeries = computed<BarSeries[]>(() => [
    { label: this.i18n.t('reports.revenueLegend'), tone: 'primary' },
    { label: this.i18n.t('reports.commissionLegend'), tone: 'accent' },
  ]);

  protected readonly revenueGroups = computed<BarGroup[]>(() =>
    this.revenueRows().map((row) => ({
      label: monthLabel(row.month, this.i18n.language()),
      sublabel: hijri(row.month, this.i18n.language()),
      values: [row.revenue, row.commission],
    })),
  );

  protected readonly payoutMeters = computed<MeterRow[]>(() =>
    this.payoutRows().map((row) => ({
      label: row.lessorName,
      percent: row.totalDue === 0 ? 0 : Math.round((row.transferred / row.totalDue) * 100),
      display: `${row.totalDue === 0 ? 0 : Math.round((row.transferred / row.totalDue) * 100)}%`,
    })),
  );

  protected readonly occupancyMeters = computed<MeterRow[]>(() =>
    this.occupancyRows().map((row) => ({
      label: row.categoryName,
      percent: row.occupancyRate,
      display: `${row.occupancyRate}%`,
    })),
  );

  constructor() {
    this.fetch();
  }

  protected setKind(kind: ReportKind): void {
    this.kind.set(kind);
    if (this.currentLength() === 0) this.fetch();
  }

  protected onFilters(values: AdminFilterValues): void {
    this.filters.set(values);
    this.clearAll();
    this.fetch();
  }

  protected onReset(): void {
    this.filters.set({ period: 'last5' });
    this.clearAll();
    this.fetch();
  }

  protected fetch(): void {
    this.failed.set(false);
    this.isLoading.set(true);

    const filters = this.reportFilters();
    const done = () => this.isLoading.set(false);
    const fail = () => {
      this.failed.set(true);
      this.isLoading.set(false);
    };

    switch (this.kind()) {
      case 'revenue':
        this.reports.revenue(filters).subscribe({
          next: (rows) => {
            this.revenueRows.set(rows);
            done();
          },
          error: fail,
        });
        break;
      case 'payouts':
        this.reports.payouts(filters).subscribe({
          next: (rows) => {
            this.payoutRows.set(rows);
            done();
          },
          error: fail,
        });
        break;
      case 'occupancy':
        this.reports.occupancy(filters).subscribe({
          next: (rows) => {
            this.occupancyRows.set(rows);
            done();
          },
          error: fail,
        });
        break;
      default:
        this.reports.bookings(filters).subscribe({
          next: (rows) => {
            this.bookingRows.set(rows);
            done();
          },
          error: fail,
        });
    }
  }

  /**
   * FR-RPT-05 — the file is produced server-side. Rendering a spreadsheet in the
   * browser would mean a second implementation of every total on this screen.
   */
  protected export(format: 'xlsx' | 'pdf'): void {
    this.reports.export(this.kind(), format, this.reportFilters()).subscribe({
      next: (blob) => this.save(blob, format),
      error: () => this.notifications.error(this.i18n.t('reports.exportFailed')),
    });
  }

  protected month(value: string): string {
    return monthLabel(value, this.i18n.language());
  }

  protected monthHijri(value: string): string {
    return hijri(value, this.i18n.language());
  }

  private currentLength(): number {
    switch (this.kind()) {
      case 'revenue':
        return this.revenueRows().length;
      case 'payouts':
        return this.payoutRows().length;
      case 'occupancy':
        return this.occupancyRows().length;
      default:
        return this.bookingRows().length;
    }
  }

  private clearAll(): void {
    this.bookingRows.set([]);
    this.revenueRows.set([]);
    this.payoutRows.set([]);
    this.occupancyRows.set([]);
  }

  private reportFilters(): ReportFilters {
    const values = this.filters();
    const months = values['period'] === 'year' ? 12 : 5;
    const to = new Date();
    const from = new Date(to.getFullYear(), to.getMonth() - months + 1, 1);

    return {
      from: iso(from),
      to: iso(to),
      cityId: values['cityId'] || undefined,
      categoryId: values['categoryId'] || undefined,
      lessorId: values['lessorId'] || undefined,
    };
  }

  private save(blob: Blob, format: 'xlsx' | 'pdf'): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hayzak-${this.kind()}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  }
}

function iso(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}
