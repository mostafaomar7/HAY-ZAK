import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ROLE_DISPLAY, statusText } from '@core/constants/status-display';
import type { UserRole } from '@core/enums/user-role.enum';
import { LanguageService } from '@core/i18n/language.service';
import type { AuditDetail, AuditRow } from '@core/models/admin.model';
import { NotificationService } from '@core/services/notification.service';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { AdminFilterBar } from '../../components/admin-filter-bar/admin-filter-bar';
import type { AdminFilterValues } from '../../components/admin-filter-bar/admin-filter-bar';
import { AdminPanel } from '../../components/admin-panel/admin-panel';
import { AdminTable } from '../../components/admin-table/admin-table';
import type { AdminColumn, AdminSort } from '../../components/admin-table/admin-table';
import { AdminListState } from '../../services/admin-list-state';
import { AdminOversightService } from '../../services/admin-oversight.service';

/**
 * ADM-13 — the audit trail (FR-ADM-09).
 *
 * Read-only, and it shows: there is no bulk selection, no action column, and the
 * panel that opens on a row has no footer. The service backing it has no update
 * or delete method either, so the absence is structural rather than a matter of
 * this template's restraint.
 */
@Component({
  selector: 'app-admin-audit-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminOversightService],
  imports: [DatePipe, AdminFilterBar, AdminPanel, AdminTable, UiNotice],
  templateUrl: './audit-page.html',
  styleUrl: './audit-page.scss',
})
export class AdminAuditPage {
  private readonly oversight = inject(AdminOversightService);
  private readonly notifications = inject(NotificationService);

  protected readonly i18n = inject(LanguageService);
  protected readonly list = new AdminListState();

  protected readonly rows = signal<AuditRow[]>([]);
  protected readonly detail = signal<AuditDetail | null>(null);

  protected readonly columns = computed<AdminColumn[]>(() => [
    { key: 'actorName', label: this.i18n.t('audit.user'), width: '1.2fr' },
    { key: 'action', label: this.i18n.t('audit.action'), width: '1.5fr' },
    { key: 'occurredAt', label: this.i18n.t('audit.time'), width: '1.3fr', sortable: true },
    { key: 'oldValue', label: this.i18n.t('audit.before'), width: '1.3fr' },
    { key: 'newValue', label: this.i18n.t('audit.after'), width: '1.5fr' },
  ]);

  protected readonly selects = computed(() => [
    {
      key: 'actorId',
      label: this.i18n.t('audit.user'),
      options: [{ value: '', label: this.i18n.t('audit.allUsers') }],
    },
    {
      key: 'action',
      label: this.i18n.t('audit.action'),
      options: [{ value: '', label: this.i18n.t('audit.allActions') }],
    },
    {
      key: 'period',
      label: this.i18n.t('admin.period'),
      options: [
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
    this.oversight.auditLog(this.list.params()).subscribe({
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

  protected openRow(row: AuditRow): void {
    this.oversight.auditEntry(row.id).subscribe({
      next: (detail) => this.detail.set(detail),
      error: () => this.notifications.error(this.i18n.t('audit.error')),
    });
  }

  protected close(): void {
    this.detail.set(null);
  }

  protected roleLabel(role: UserRole): string {
    return statusText(ROLE_DISPLAY[role], this.i18n.language());
  }
}
