import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { LanguageService } from '@core/i18n/language.service';
import type { AdminDashboardKpis } from '@core/models/operations.model';
import type { ListingReviewRow } from '@core/models/admin.model';
import { ApiService } from '@core/services/api.service';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';
import { AdminKpiCard } from '../../components/admin-kpi-card/admin-kpi-card';
import { AdminReviewService } from '../../services/admin-review.service';
import { AdminSettingsStore } from '../../services/admin-settings.store';

/**
 * ADM-01 — the operations dashboard (FR-ADM-01).
 *
 * Six indicators over the two live queues. The queues are the point of the
 * screen, so they are lists of real rows a click away from their review, not
 * counters: a number tells an operator there is work, a list tells them which
 * work and how late it is.
 */
@Component({
  selector: 'app-admin-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AdminKpiCard, UiButton, UiEmptyState, UiSkeleton],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
  // The queue below the indicators is the same queue the review screen shows,
  // read through the same service so the two cannot disagree about it.
  providers: [AdminReviewService],
})
export class AdminDashboardPage {
  private readonly api = inject(ApiService);
  private readonly review = inject(AdminReviewService);

  protected readonly i18n = inject(LanguageService);
  protected readonly settings = inject(AdminSettingsStore);

  protected readonly kpis = signal<AdminDashboardKpis | null>(null);
  protected readonly listings = signal<ListingReviewRow[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly failed = signal(false);

  /** The four newest of each queue — the rest is one click away. */
  protected readonly topListings = computed(() => this.listings().slice(0, 4));

  protected readonly cards = computed(() => {
    const kpis = this.kpis();
    if (!kpis) return [];

    const sla = this.settings.approvalSlaHours();
    return [
      {
        key: 'pendingListings',
        label: this.i18n.t('dash.pendingListings'),
        value: format(kpis.pendingListings),
        unit: this.i18n.t('dash.unit'),
        delta: this.i18n.t('dash.awaitingDecision'),
        icon: 'box' as const,
      },
      {
        key: 'slaBreaches',
        label: this.i18n.t('dash.slaBreaches'),
        value: format(kpis.slaBreaches),
        unit: this.i18n.t('dash.booking'),
        delta: this.i18n.t('dash.slaNote', { hours: sla }),
        icon: 'clock' as const,
      },
      {
        key: 'gross',
        label: this.i18n.t('dash.gross'),
        value: format(kpis.grossCollection),
        unit: this.i18n.t('admin.sar'),
        delta: this.i18n.t('dash.thisMonth'),
        icon: 'card' as const,
      },
      {
        key: 'commission',
        label: this.i18n.t('dash.commission'),
        value: format(kpis.totalCommission),
        unit: this.i18n.t('admin.sar'),
        delta: this.i18n.t('dash.thisMonth'),
        icon: 'file' as const,
      },
      {
        key: 'occupancy',
        label: this.i18n.t('dash.occupancy'),
        value: format(kpis.occupancyRate),
        unit: this.i18n.t('admin.percent'),
        delta: this.i18n.t('dash.publishedNow'),
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

    this.api.get<AdminDashboardKpis>(API_ENDPOINTS.admin.dashboard).subscribe({
      next: (kpis) => {
        this.kpis.set(kpis);
        this.isLoading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.isLoading.set(false);
      },
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
