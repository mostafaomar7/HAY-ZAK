import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import type { Observable } from 'rxjs';
import { LanguageService } from '@core/i18n/language.service';
import type {
  BookingReviewDetail,
  BookingReviewRow,
  ReviewDecision,
} from '@core/models/admin.model';
import { NotificationService } from '@core/services/notification.service';
import { UiBadge } from '@shared/components/ui-badge/ui-badge';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiMoney } from '@shared/components/ui-money/ui-money';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { AdminFilterBar } from '../../components/admin-filter-bar/admin-filter-bar';
import type { AdminFilterValues } from '../../components/admin-filter-bar/admin-filter-bar';
import { AdminPanel } from '../../components/admin-panel/admin-panel';
import { AdminReasonModal } from '../../components/admin-reason-modal/admin-reason-modal';
import { AdminTable } from '../../components/admin-table/admin-table';
import type { AdminColumn, AdminSort } from '../../components/admin-table/admin-table';
import { AdminListState } from '../../services/admin-list-state';
import { AdminQueueCountsService } from '../../services/admin-queue-counts.service';
import { AdminReviewService } from '../../services/admin-review.service';
import { AdminSettingsStore } from '../../services/admin-settings.store';

/**
 * ADM-03 — the paid-booking review queue (FR-BKG-05).
 *
 * The renter has already paid, so every row here is money the platform is
 * holding. That is why the queue defaults to oldest-first, why a breach of the
 * review window paints the whole row, and why rejecting states the refund in
 * figures before the button.
 */
@Component({
  selector: 'app-admin-bookings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminReviewService],
  imports: [
    DatePipe,
    AdminFilterBar,
    AdminPanel,
    AdminReasonModal,
    AdminTable,
    UiBadge,
    UiButton,
    UiMoney,
    UiNotice,
  ],
  templateUrl: './bookings-page.html',
  styleUrl: './bookings-page.scss',
})
export class AdminBookingsPage {
  private readonly review = inject(AdminReviewService);
  private readonly notifications = inject(NotificationService);
  private readonly queues = inject(AdminQueueCountsService);

  protected readonly i18n = inject(LanguageService);
  protected readonly settings = inject(AdminSettingsStore);
  protected readonly list = new AdminListState();

  readonly open = input('');

  protected readonly rows = signal<BookingReviewRow[]>([]);
  protected readonly detail = signal<BookingReviewDetail | null>(null);
  protected readonly reasonOpen = signal(false);
  protected readonly submitting = signal(false);

  private readonly bulkTargets = signal<readonly string[]>([]);

  protected readonly lateCount = computed(
    () => this.rows().filter((row) => this.isLate(row.waitingHours)).length,
  );

  /**
   * The refund the modal must state. On a bulk rejection it is the sum of every
   * selected booking, because that is the total that will leave the account.
   */
  protected readonly refundHalalas = computed(() => {
    const bulk = this.bulkTargets();
    if (bulk.length > 0) {
      return this.rows()
        .filter((row) => bulk.includes(row.id))
        .reduce((sum, row) => sum + row.totalHalalas, 0);
    }
    return this.detail()?.totalHalalas ?? null;
  });

  protected readonly columns = computed<AdminColumn[]>(() => [
    { key: 'referenceNo', label: this.i18n.t('bkq.reference'), width: '1.2fr' },
    { key: 'renterName', label: this.i18n.t('bkq.renter'), width: '1.1fr' },
    { key: 'lessorName', label: this.i18n.t('bkq.lessor'), width: '1.1fr' },
    { key: 'unitTitle', label: this.i18n.t('bkq.unit'), width: '1.7fr' },
    { key: 'startDate', label: this.i18n.t('bkq.period'), width: '1.4fr', sortable: true },
    { key: 'totalHalalas', label: this.i18n.t('bkq.value'), width: '1fr', sortable: true },
    {
      key: 'waitingHours',
      label: this.i18n.t('bkq.waitingFilter'),
      width: '1.2fr',
      sortable: true,
    },
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
      key: 'waiting',
      label: this.i18n.t('bkq.waitingFilter'),
      options: [
        { value: '', label: this.i18n.t('bkq.allWaits') },
        { value: 'late', label: this.i18n.t('bkq.lateOnly') },
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

  protected readonly tone = computed(
    () => (row: BookingReviewRow) =>
      this.isLate(row.waitingHours) ? ('danger' as const) : ('default' as const),
  );

  constructor() {
    this.fetch();
  }

  protected fetch(): void {
    this.list.begin();
    this.review.bookingQueue(this.list.params()).subscribe({
      next: (page) => {
        this.rows.set(page.items);
        this.list.succeed(page.items.length, page.pagination.total);
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

  protected openRow(row: BookingReviewRow): void {
    this.review.booking(row.id).subscribe({
      next: (detail) => this.detail.set(detail),
      error: () => this.notifications.error(this.i18n.t('bkq.error')),
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
    this.run(this.review.approveBooking(id), 'bkq.approved');
  }

  protected approveSelected(): void {
    const ids = this.list.selected();
    if (ids.length === 0) return;
    this.run(this.review.approveBookings(ids), 'bkq.approved');
  }

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
      this.run(this.review.rejectBookings(bulk, decision), 'bkq.rejected');
    } else if (single) {
      this.run(this.review.rejectBooking(single, decision), 'bkq.rejected');
    }
  }

  private run(work: Observable<unknown>, successKey: 'bkq.approved' | 'bkq.rejected'): void {
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

  private openLinkedRow(): void {
    const id = this.open();
    if (!id || this.detail()) return;

    const row = this.rows().find((item) => item.id === id);
    if (row) this.openRow(row);
  }
}
