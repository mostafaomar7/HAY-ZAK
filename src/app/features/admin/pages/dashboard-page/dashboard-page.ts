import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ComplaintStatus, SETTLED_COMPLAINT_STATUSES } from '@core/enums/complaint.enum';
import { UnitStatus } from '@core/enums/unit-status.enum';
import { LanguageService } from '@core/i18n/language.service';
import type { AdminOverview, RevenueReport } from '@core/models/admin-reports';
import type { ListingReviewRow } from '@core/models/admin.model';
import { halalasToSar } from '@core/utils/money.utils';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';
import { AdminKpiCard } from '../../components/admin-kpi-card/admin-kpi-card';
import { AdminReportsService } from '../../services/admin-reports.service';
import { AdminReviewService } from '../../services/admin-review.service';

/**
 * ADM-01 — the operations dashboard (FR-ADM-01).
 *
 * **There is no `/admin/dashboard`.** It answered 404 for as long as this
 * screen existed, so the first thing every administrator saw after signing in
 * was "تعذّر تحميل المؤشرات". The figures live in `/admin/reports/overview` and
 * `/admin/reports/revenue`, both shipped, both already read by the reports
 * screen — the same numbers under another name.
 *
 * Two indicators went in the move and neither is missed.
 *
 * `slaBreaches` counted "bookings past the approval SLA", and there is no
 * approval step: payment is what confirms a booking, so nothing can be late for
 * a decision nobody makes. The overdue count that does mean something is
 * `complaints.overdue`, and that is what took its place.
 *
 * `occupancyRate` has no source on the API at all. It was being read off an
 * endpoint that never answered, which is to say it was never a real number —
 * and an occupancy figure this screen computed for itself would be exactly the
 * kind of statistic that ends up in a board pack with nobody able to re-derive
 * it. It is absent rather than invented.
 *
 * The queue below is still the point of the screen: a number says there is
 * work, a list says which work and how late it is.
 */
@Component({
  selector: 'app-admin-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AdminKpiCard, UiButton, UiEmptyState, UiSkeleton],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
  // The queue below the indicators is the same queue the review screen shows,
  // read through the same service so the two cannot disagree about it.
  providers: [AdminReviewService, AdminReportsService],
})
export class AdminDashboardPage {
  private readonly review = inject(AdminReviewService);
  private readonly reports = inject(AdminReportsService);

  protected readonly i18n = inject(LanguageService);

  protected readonly overview = signal<AdminOverview | null>(null);
  protected readonly revenue = signal<RevenueReport | null>(null);
  protected readonly listings = signal<ListingReviewRow[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly failed = signal(false);

  /** The four newest of each queue — the rest is one click away. */
  protected readonly topListings = computed(() => this.listings().slice(0, 4));

  /** Live complaints — the settled two are not work waiting on anybody. */
  protected readonly openComplaints = computed(() => {
    const complaints = this.overview()?.complaints;
    if (!complaints) return 0;
    return Object.values(ComplaintStatus)
      .filter((status) => !SETTLED_COMPLAINT_STATUSES.includes(status))
      .reduce((total, status) => total + (complaints[status] ?? 0), 0);
  });

  protected readonly cards = computed(() => {
    const overview = this.overview();
    if (!overview) return [];

    const revenue = this.revenue();
    return [
      {
        key: 'pendingListings',
        label: this.i18n.t('dash.pendingListings'),
        value: format(overview.units[UnitStatus.PendingReview] ?? 0),
        unit: this.i18n.t('dash.unit'),
        delta: this.i18n.t('dash.awaitingDecision'),
        icon: 'box' as const,
      },
      {
        key: 'openComplaints',
        label: this.i18n.t('dash.openComplaints'),
        value: format(this.openComplaints()),
        unit: this.i18n.t('dash.complaint'),
        delta: this.i18n.t('dash.liveOnly'),
        icon: 'file' as const,
      },
      {
        // Replaces the old booking "SLA breaches": nothing approves a booking,
        // so nothing could be late for it. A complaint past its reply deadline
        // is the lateness an operations lead actually acts on.
        key: 'overdueComplaints',
        label: this.i18n.t('dash.overdueComplaints'),
        value: format(overview.complaints.overdue),
        unit: this.i18n.t('dash.complaint'),
        delta: this.i18n.t('dash.pastDeadline'),
        icon: 'clock' as const,
      },
      {
        // What renters paid, and labelled as that. Most of it is owed onward.
        key: 'collected',
        label: this.i18n.t('dash.gross'),
        value: revenue ? format(halalasToSar(revenue.collectedHalalas)) : '—',
        unit: this.i18n.t('admin.sar'),
        delta: this.i18n.t('dash.grossNote'),
        icon: 'card' as const,
      },
      {
        // The only figure on this row that the platform keeps.
        key: 'commission',
        label: this.i18n.t('dash.commission'),
        value: revenue ? format(halalasToSar(revenue.commissionHalalas)) : '—',
        unit: this.i18n.t('admin.sar'),
        delta: this.i18n.t('dash.commissionNote'),
        icon: 'grid' as const,
      },
    ];
  });

  constructor() {
    this.fetch();
  }

  protected fetch(): void {
    this.failed.set(false);
    this.isLoading.set(true);

    this.reports.overview().subscribe({
      next: (overview) => {
        this.overview.set(overview);
        this.isLoading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.isLoading.set(false);
      },
    });

    // The money is a second report and fails on its own: a revenue call that
    // breaks must not blank the queue counts beside it, which are the half of
    // this screen somebody acts on.
    this.reports.revenue().subscribe({
      next: (report) => this.revenue.set(report),
      error: () => this.revenue.set(null),
    });

    // The queue fails independently of the indicators above it: a broken
    // review service must not blank the figures beside it.
    this.review
      .listingQueue({})
      .subscribe({ next: (page) => this.listings.set(page.items), error: () => undefined });
  }

  /**
   * How long it has been waiting. The lateness beside it is `row.isOverdue`,
   * read straight off the row — the dashboard and the queue must not be able
   * to disagree about the same listing.
   */
  protected waitLabel(row: ListingReviewRow): string {
    return row.waitingHours === null
      ? this.i18n.t('common.notAvailable')
      : this.i18n.t('listings.hours', { hours: row.waitingHours });
  }
}

/** Latin digits with thousands separators; the numeric mixin isolates them. */
function format(value: number): string {
  return new Intl.NumberFormat('en-GB').format(value);
}
