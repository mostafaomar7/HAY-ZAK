import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { DISPUTE_STATUS_DISPLAY, ROLE_DISPLAY, statusText } from '@core/constants/status-display';
import { DisputeStatus } from '@core/enums/operations.enum';
import type { UserRole } from '@core/enums/user-role.enum';
import { LanguageService } from '@core/i18n/language.service';
import type { ComplaintDetail, ComplaintRow } from '@core/models/admin.model';
import { NotificationService } from '@core/services/notification.service';
import { UiBadge } from '@shared/components/ui-badge/ui-badge';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiMoney } from '@shared/components/ui-money/ui-money';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { AdminFilterBar } from '../../components/admin-filter-bar/admin-filter-bar';
import type { AdminFilterValues } from '../../components/admin-filter-bar/admin-filter-bar';
import { AdminPanel } from '../../components/admin-panel/admin-panel';
import { AdminTable } from '../../components/admin-table/admin-table';
import type { AdminColumn, AdminSort } from '../../components/admin-table/admin-table';
import { AdminListState } from '../../services/admin-list-state';
import { AdminOversightService } from '../../services/admin-oversight.service';
import { AdminQueueCountsService } from '../../services/admin-queue-counts.service';

/**
 * ADM-04 — complaints and disputes (FR-ADM-08).
 *
 * A complaint is closed by writing what was decided, not by pressing a button:
 * the resolution text is required because it is what both parties are sent and
 * what the audit trail records.
 *
 * Closing also releases any payout frozen against the dispute (UC-04), which is
 * why the panel links straight through to the transfer rather than leaving the
 * finance officer to find it.
 */
@Component({
  selector: 'app-admin-complaints-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminOversightService],
  imports: [DatePipe, AdminFilterBar, AdminPanel, AdminTable, UiBadge, UiButton, UiMoney, UiNotice],
  templateUrl: './complaints-page.html',
  styleUrl: './complaints-page.scss',
})
export class AdminComplaintsPage {
  private readonly oversight = inject(AdminOversightService);
  private readonly notifications = inject(NotificationService);
  private readonly queues = inject(AdminQueueCountsService);
  private readonly router = inject(Router);

  protected readonly i18n = inject(LanguageService);
  protected readonly list = new AdminListState();

  protected readonly rows = signal<ComplaintRow[]>([]);
  protected readonly detail = signal<ComplaintDetail | null>(null);
  protected readonly resolution = signal('');
  /** Cancels the booking this complaint is against — see the template. */
  protected readonly cancelBooking = signal(false);
  protected readonly submitting = signal(false);

  protected readonly isOpen = computed(() => this.detail()?.status !== DisputeStatus.Closed);
  protected readonly canClose = computed(() => this.resolution().trim().length > 0);

  protected readonly columns = computed<AdminColumn[]>(() => [
    { key: 'referenceNo', label: this.i18n.t('complaints.reference'), width: '1.2fr' },
    { key: 'bookingReferenceNo', label: this.i18n.t('complaints.booking'), width: '1.2fr' },
    { key: 'raisedByName', label: this.i18n.t('complaints.raisedBy'), width: '1.2fr' },
    { key: 'subject', label: this.i18n.t('complaints.subject'), width: '2fr' },
    { key: 'status', label: this.i18n.t('admin.status'), width: '1.1fr' },
    { key: 'openedAt', label: this.i18n.t('complaints.openedAt'), width: '1.2fr', sortable: true },
  ]);

  protected readonly selects = computed(() => [
    {
      key: 'status',
      label: this.i18n.t('admin.status'),
      options: [
        { value: '', label: this.i18n.t('admin.allStatuses') },
        ...Object.values(DisputeStatus).map((status) => ({
          value: status,
          label: this.statusLabel(status),
        })),
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

  constructor() {
    this.fetch();
  }

  protected fetch(): void {
    this.list.begin();
    this.oversight.complaints(this.list.params()).subscribe({
      next: (page) => {
        this.rows.set(page.items);
        this.list.succeed(page.items.length, page.pagination.total);
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

  protected openRow(row: ComplaintRow): void {
    this.resolution.set('');
    this.cancelBooking.set(false);
    this.oversight.complaint(row.id).subscribe({
      next: (detail) => this.detail.set(detail),
      error: () => this.notifications.error(this.i18n.t('complaints.error')),
    });
  }

  protected close(): void {
    this.detail.set(null);
    this.resolution.set('');
    this.cancelBooking.set(false);
  }

  protected statusLabel(status: DisputeStatus): string {
    return statusText(DISPUTE_STATUS_DISPLAY[status], this.i18n.language());
  }

  protected statusTone(status: DisputeStatus) {
    return DISPUTE_STATUS_DISPLAY[status].tone;
  }

  protected roleLabel(role: UserRole): string {
    return statusText(ROLE_DISPLAY[role], this.i18n.language());
  }

  protected goToTransfers(): void {
    this.close();
    void this.router.navigateByUrl('/admin/transfers');
  }

  protected resolve(): void {
    const id = this.detail()?.id;
    if (!id || !this.canClose()) return;

    this.submitting.set(true);
    this.oversight.resolve(id, this.resolution().trim(), this.cancelBooking()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.close();
        this.notifications.success(this.i18n.t('complaints.closed'));
        this.queues.refresh();
        this.fetch();
      },
      error: () => {
        this.submitting.set(false);
        this.notifications.error(this.i18n.t('admin.actionFailed'));
      },
    });
  }
}
