import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { LanguageService } from '@core/i18n/language.service';
import type { AdminDashboardKpis } from '@core/models/operations.model';
import type { BookingReviewRow, ListingReviewRow } from '@core/models/admin.model';
import { ApiService } from '@core/services/api.service';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';
import { AdminKpiCard } from '../../components/admin-kpi-card/admin-kpi-card';
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
})
export class AdminDashboardPage {
  private readonly api = inject(ApiService);

  protected readonly i18n = inject(LanguageService);
  protected readonly settings = inject(AdminSettingsStore);

  protected readonly kpis = signal<AdminDashboardKpis | null>(null);
  protected readonly listings = signal<ListingReviewRow[]>([]);
  protected readonly bookings = signal<BookingReviewRow[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly failed = signal(false);

  /** The four newest of each queue — the rest is one click away. */
  protected readonly topListings = computed(() => this.listings().slice(0, 4));
  protected readonly topBookings = computed(() => this.bookings().slice(0, 4));

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
        key: 'pendingBookings',
        label: this.i18n.t('dash.pendingBookings'),
        value: format(kpis.pendingBookings),
        unit: this.i18n.t('dash.booking'),
        delta: this.i18n.t('dash.awaitingDecision'),
        icon: 'list' as const,
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

    // The two queues fail independently of the indicators: a broken listings
    // service must not blank the booking queue an operator is working through.
    this.api
      .list<ListingReviewRow>(API_ENDPOINTS.admin.pendingUnits)
      .subscribe({ next: (page) => this.listings.set(page.items), error: () => undefined });

    this.api
      .list<BookingReviewRow>(API_ENDPOINTS.admin.pendingBookings)
      .subscribe({ next: (page) => this.bookings.set(page.items), error: () => undefined });
  }

  protected isLate(hours: number): boolean {
    return hours > this.settings.approvalSlaHours();
  }

  protected waitLabel(hours: number): string {
    return this.i18n.t('listings.hours', { hours });
  }
}

/** Latin digits with thousands separators; the numeric mixin isolates them. */
function format(value: number): string {
  return new Intl.NumberFormat('en-GB').format(value);
}
