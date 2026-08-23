import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ACCOUNT_STATUS_DISPLAY, ROLE_DISPLAY, statusText } from '@core/constants/status-display';
import { AccountStatus, UserRole } from '@core/enums/user-role.enum';
import { LanguageService } from '@core/i18n/language.service';
import type { AdminUserDetail, AdminUserRow } from '@core/models/admin.model';
import { NotificationService } from '@core/services/notification.service';
import { UiBadge } from '@shared/components/ui-badge/ui-badge';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiModal } from '@shared/components/ui-modal/ui-modal';
import { AdminFilterBar } from '../../components/admin-filter-bar/admin-filter-bar';
import type { AdminFilterValues } from '../../components/admin-filter-bar/admin-filter-bar';
import { AdminPanel } from '../../components/admin-panel/admin-panel';
import { AdminTable } from '../../components/admin-table/admin-table';
import type { AdminColumn, AdminSort } from '../../components/admin-table/admin-table';
import { AdminListState } from '../../services/admin-list-state';
import { AdminUsersService } from '../../services/admin-users.service';

/**
 * ADM-09 — user administration (FR-ADM-04).
 *
 * The panel is a profile, not an editor: an operator may change what an account
 * is *allowed* to do, never the details it holds. Name, mobile and ID belong to
 * the person, and an admin quietly correcting them would break the link between
 * the identity Nafath verified and the one on file.
 *
 * Suspension asks first. Activation and verification do not: both restore
 * access, and neither can lose anything.
 */
@Component({
  selector: 'app-admin-users-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminUsersService],
  imports: [DatePipe, AdminFilterBar, AdminPanel, AdminTable, UiBadge, UiButton, UiModal],
  templateUrl: './users-page.html',
  styleUrl: './users-page.scss',
})
export class AdminUsersPage {
  private readonly users = inject(AdminUsersService);
  private readonly notifications = inject(NotificationService);

  protected readonly i18n = inject(LanguageService);
  protected readonly list = new AdminListState();

  protected readonly rows = signal<AdminUserRow[]>([]);
  protected readonly detail = signal<AdminUserDetail | null>(null);
  protected readonly confirmSuspend = signal(false);

  protected readonly columns = computed<AdminColumn[]>(() => [
    { key: 'fullName', label: this.i18n.t('users.name'), width: '1.3fr', sortable: true },
    { key: 'role', label: this.i18n.t('users.role'), width: '0.9fr' },
    { key: 'mobile', label: this.i18n.t('users.mobile'), width: '1.2fr' },
    { key: 'email', label: this.i18n.t('users.email'), width: '1.5fr' },
    {
      key: 'registeredAt',
      label: this.i18n.t('users.registeredAt'),
      width: '1.2fr',
      sortable: true,
    },
    { key: 'status', label: this.i18n.t('admin.status'), width: '1fr' },
  ]);

  protected readonly selects = computed(() => [
    {
      key: 'role',
      label: this.i18n.t('users.role'),
      options: [
        { value: '', label: this.i18n.t('users.allRoles') },
        ...Object.values(UserRole)
          .filter((role) => role !== UserRole.Guest)
          .map((role) => ({ value: role, label: this.roleLabel(role) })),
      ],
    },
    {
      key: 'status',
      label: this.i18n.t('admin.status'),
      options: [
        { value: '', label: this.i18n.t('admin.allStatuses') },
        ...Object.values(AccountStatus).map((status) => ({
          value: status,
          label: this.statusLabel(status),
        })),
      ],
    },
  ]);

  protected readonly hasNothing = computed(() => {
    const detail = this.detail();
    return !!detail && detail.units.length === 0 && detail.bookings.length === 0;
  });

  constructor() {
    this.fetch();
  }

  protected fetch(): void {
    this.list.begin();
    this.users.list(this.list.params()).subscribe({
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

  protected openRow(row: AdminUserRow): void {
    this.users.byId(row.id).subscribe({
      next: (detail) => this.detail.set(detail),
      error: () => this.notifications.error(this.i18n.t('users.error')),
    });
  }

  protected close(): void {
    this.detail.set(null);
  }

  protected roleLabel(role: UserRole): string {
    return statusText(ROLE_DISPLAY[role], this.i18n.language());
  }

  protected statusLabel(status: AccountStatus): string {
    return statusText(ACCOUNT_STATUS_DISPLAY[status], this.i18n.language());
  }

  protected statusTone(status: AccountStatus) {
    return ACCOUNT_STATUS_DISPLAY[status].tone;
  }

  // ── Status changes ─────────────────────────────────────────────────────
  protected activate(): void {
    this.setStatus(AccountStatus.Active);
  }

  protected verify(): void {
    this.setStatus(AccountStatus.Active);
  }

  protected askSuspend(): void {
    this.confirmSuspend.set(true);
  }

  protected suspend(): void {
    this.confirmSuspend.set(false);
    this.setStatus(AccountStatus.Suspended);
  }

  private setStatus(status: AccountStatus): void {
    const id = this.detail()?.id;
    if (!id) return;

    this.users.setStatus(id, status).subscribe({
      next: () => {
        this.notifications.success(this.i18n.t('users.statusChanged'));
        this.detail.update((current) => (current ? { ...current, status } : current));
        this.fetch();
      },
      error: () => this.notifications.error(this.i18n.t('admin.actionFailed')),
    });
  }
}
