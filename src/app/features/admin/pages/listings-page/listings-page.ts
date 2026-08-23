import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import type { Observable } from 'rxjs';
import { LanguageService } from '@core/i18n/language.service';
import type {
  ListingReviewDetail,
  ListingReviewRow,
  ReviewDecision,
} from '@core/models/admin.model';
import { NotificationService } from '@core/services/notification.service';
import { UiBadge } from '@shared/components/ui-badge/ui-badge';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { AdminFilterBar } from '../../components/admin-filter-bar/admin-filter-bar';
import type { AdminFilterValues } from '../../components/admin-filter-bar/admin-filter-bar';
import { AdminPanel } from '../../components/admin-panel/admin-panel';
import { AdminReasonModal } from '../../components/admin-reason-modal/admin-reason-modal';
import { AdminTable } from '../../components/admin-table/admin-table';
import type { AdminColumn, AdminSort } from '../../components/admin-table/admin-table';
import { AdminListState } from '../../services/admin-list-state';
import { AdminReviewService } from '../../services/admin-review.service';
import { AdminSettingsStore } from '../../services/admin-settings.store';
import { AdminQueueCountsService } from '../../services/admin-queue-counts.service';

/**
 * ADM-02 — the listing review queue (FR-UNT-06).
 *
 * The lessor submits, the platform decides: there is no path here that changes a
 * listing's content, only its state. Approving publishes it; rejecting sends it
 * back with a coded reason.
 *
 * `open` arrives as a query parameter so the dashboard can link straight to one
 * row's review, and so a half-finished review survives a page reload.
 */
@Component({
  selector: 'app-admin-listings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminReviewService],
  imports: [DatePipe, AdminFilterBar, AdminPanel, AdminReasonModal, AdminTable, UiBadge, UiButton],
  templateUrl: './listings-page.html',
  styleUrl: './listings-page.scss',
})
export class AdminListingsPage {
  private readonly review = inject(AdminReviewService);
  private readonly notifications = inject(NotificationService);
  private readonly queues = inject(AdminQueueCountsService);

  protected readonly i18n = inject(LanguageService);
  protected readonly settings = inject(AdminSettingsStore);
  protected readonly list = new AdminListState();

  /** Bound from the query string by withComponentInputBinding. */
  readonly open = input('');

  protected readonly rows = signal<ListingReviewRow[]>([]);
  protected readonly detail = signal<ListingReviewDetail | null>(null);
  protected readonly reasonOpen = signal(false);
  protected readonly submitting = signal(false);

  /** Non-empty when the reason modal is confirming a bulk rejection. */
  private readonly bulkTargets = signal<readonly string[]>([]);

  protected readonly columns = computed<AdminColumn[]>(() => [
    { key: 'unitTitle', label: this.i18n.t('listings.unit'), width: '2fr', sortable: true },
    { key: 'ownerName', label: this.i18n.t('listings.owner'), width: '1.1fr' },
    { key: 'categoryName', label: this.i18n.t('admin.category'), width: '0.8fr' },
    { key: 'cityName', label: this.i18n.t('admin.city'), width: '0.7fr' },
    { key: 'dailyPrice', label: this.i18n.t('listings.price'), width: '0.9fr', sortable: true },
    { key: 'submittedAt', label: this.i18n.t('listings.sentAt'), width: '1.1fr', sortable: true },
    { key: 'waitingHours', label: this.i18n.t('listings.waiting'), width: '1.2fr', sortable: true },
    { key: 'action', label: this.i18n.t('admin.action'), width: '1fr' },
  ]);

  protected readonly selects = computed(() => [
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
      key: 'requestType',
      label: this.i18n.t('listings.requestType'),
      options: [
        { value: '', label: this.i18n.t('listings.typeAll') },
        { value: 'new', label: this.i18n.t('listings.typeNew') },
        { value: 'edit', label: this.i18n.t('listings.typeEdit') },
      ],
    },
    {
      key: 'period',
      label: this.i18n.t('admin.period'),
      options: [
        { value: 'last30', label: this.i18n.t('admin.last30') },
        { value: 'last3', label: this.i18n.t('admin.last3Months') },
      ],
    },
  ]);

  /** The row tone the table paints — an SLA breach colours the whole row. */
  protected readonly tone = computed(
    () => (row: ListingReviewRow) =>
      row.waitingHours > this.settings.approvalSlaHours()
        ? ('danger' as const)
        : ('default' as const),
  );

  constructor() {
    this.fetch();
  }

  protected fetch(): void {
    this.list.begin();
    this.review.listingQueue(this.list.params()).subscribe({
      next: (page) => {
        this.rows.set(page.items);
        this.list.succeed(page.items.length, page.totalCount);
        this.openLinkedRow();
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

  protected openRow(row: ListingReviewRow): void {
    this.review.listing(row.id).subscribe({
      next: (detail) => this.detail.set(detail),
      error: () => this.notifications.error(this.i18n.t('listings.error')),
    });
  }

  protected closePanel(): void {
    this.detail.set(null);
  }

  protected isLate(hours: number): boolean {
    return hours > this.settings.approvalSlaHours();
  }

  protected waitLabel(hours: number): string {
    return this.isLate(hours)
      ? this.i18n.t('listings.late', { hours })
      : this.i18n.t('listings.hours', { hours });
  }

  // ── Decisions ──────────────────────────────────────────────────────────
  protected approveOne(): void {
    const id = this.detail()?.id;
    if (!id) return;
    this.run(this.review.approveListing(id), 'listings.approved');
  }

  protected approveSelected(): void {
    const ids = this.list.selected();
    if (ids.length === 0) return;
    this.run(this.review.approveListings(ids), 'listings.approved');
  }

  /** Both reject paths open the same modal; only the target set differs. */
  protected askRejectOne(): void {
    this.bulkTargets.set([]);
    this.reasonOpen.set(true);
  }

  protected askRejectSelected(): void {
    this.bulkTargets.set(this.list.selected());
    this.reasonOpen.set(true);
  }

  protected confirmReject(decision: ReviewDecision): void {
    const bulk = this.bulkTargets();
    const single = this.detail()?.id;
    this.reasonOpen.set(false);

    if (bulk.length > 0) {
      this.run(this.review.rejectListings(bulk, decision), 'listings.rejected');
    } else if (single) {
      this.run(this.review.rejectListing(single, decision), 'listings.rejected');
    }
  }

  /** One place for the after-a-decision routine: every verb ends the same way. */
  private run(
    work: Observable<unknown>,
    successKey: 'listings.approved' | 'listings.rejected',
  ): void {
    this.submitting.set(true);
    work.subscribe({
      next: () => {
        this.submitting.set(false);
        this.detail.set(null);
        this.list.clearSelection();
        this.notifications.success(this.i18n.t(successKey));
        this.queues.refresh();
        this.fetch();
      },
      error: () => {
        this.submitting.set(false);
        this.notifications.error(this.i18n.t('admin.actionFailed'));
      },
    });
  }

  /** Honours ?open=<id> once the rows that could match it have arrived. */
  private openLinkedRow(): void {
    const id = this.open();
    if (!id || this.detail()) return;

    const row = this.rows().find((item) => item.id === id);
    if (row) this.openRow(row);
  }
}
