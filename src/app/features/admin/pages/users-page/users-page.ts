import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  ACCOUNT_STATUS_DISPLAY,
  ACCOUNT_VERIFICATION_DISPLAY,
  statusText,
  userRoleDisplay,
} from '@core/constants/status-display';
import { AccountStatus, AdminRole, UserRole, VerificationStatus } from '@core/enums/user-role.enum';
import { LanguageService } from '@core/i18n/language.service';
import { ApiError } from '@core/models/api-error.model';
import type { AdminUserDetail, AdminUserRow } from '@core/models/admin-user';
import { canActOnUser } from '@core/models/admin-user';
import { AuthService } from '@core/services/auth.service';
import { NotificationService } from '@core/services/notification.service';
import { UiBadge } from '@shared/components/ui-badge/ui-badge';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiModal } from '@shared/components/ui-modal/ui-modal';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { AdminFilterBar } from '../../components/admin-filter-bar/admin-filter-bar';
import type { AdminFilterValues } from '../../components/admin-filter-bar/admin-filter-bar';
import { AdminPanel } from '../../components/admin-panel/admin-panel';
import { AdminTable } from '../../components/admin-table/admin-table';
import type { AdminColumn } from '../../components/admin-table/admin-table';
import { AdminListState } from '../../services/admin-list-state';
import { AdminUsersService, liveBookingsFromError } from '../../services/admin-users.service';

/**
 * ADM-05 — accounts (FR-ADM-04), `users:manage`.
 *
 * Three things this screen deliberately does not do.
 *
 * **It cannot edit anybody.** No name, no mobile, no email — there is no
 * endpoint, because an administrator changing somebody's phone number is the
 * shape of an account takeover. The panel is a record and a set of decisions,
 * not a form.
 *
 * **It does not offer to suspend an administrator, or the person using it.**
 * The server refuses both (`ADMIN_CANNOT_SUSPEND_ADMIN`,
 * `ADMIN_CANNOT_ACT_ON_SELF`); the buttons are hidden so nobody presses one
 * expecting it to work.
 *
 * **It shows what suspension would break before offering it.** Suspension
 * revokes every session the account holds immediately — somebody mid-booking
 * is ejected — so the five activity counts sit above the button rather than
 * appearing in a confirmation afterwards. A dialog that reveals the cost after
 * the intent is formed asks somebody to change their mind; showing it first
 * lets them make it up.
 *
 * When bookings are live the server refuses once with the count, and only then
 * is `force` offered — which is what makes that second press a decision rather
 * than a retry.
 */
@Component({
  selector: 'app-admin-users-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminUsersService],
  imports: [DatePipe, AdminFilterBar, AdminPanel, AdminTable, UiBadge, UiButton, UiModal, UiNotice],
  templateUrl: './users-page.html',
  styleUrl: './users-page.scss',
})
export class AdminUsersPage {
  private readonly users = inject(AdminUsersService);
  private readonly notifications = inject(NotificationService);
  private readonly auth = inject(AuthService);

  protected readonly i18n = inject(LanguageService);
  protected readonly list = new AdminListState();

  protected readonly rows = signal<AdminUserRow[]>([]);
  protected readonly detail = signal<AdminUserDetail | null>(null);
  protected readonly submitting = signal(false);

  /** The reason every action takes. Never optional — it goes in the audit log. */
  protected readonly reason = signal('');

  /** Set from `meta.liveBookings` after the server refuses once. */
  protected readonly liveBookings = signal<number | null>(null);
  protected readonly confirmSuspend = signal(false);

  protected readonly rejectOpen = signal(false);
  protected readonly rejectReason = signal('');

  /**
   * Whether this row may be acted on at all — not an administrator, and not
   * the person looking at it.
   */
  protected readonly canAct = computed(() => {
    const detail = this.detail();
    return !!detail && canActOnUser(detail, this.auth.user()?.id);
  });

  protected readonly canSubmit = computed(() => !!this.reason().trim() && !this.submitting());

  protected readonly awaitingIdentity = computed(
    () => this.detail()?.verificationStatus === VerificationStatus.Pending,
  );

  protected readonly columns = computed<AdminColumn[]>(() => [
    { key: 'fullName', label: this.i18n.t('users.name'), width: '1.3fr' },
    { key: 'role', label: this.i18n.t('users.role'), width: '0.9fr' },
    { key: 'mobile', label: this.i18n.t('users.mobile'), width: '1.2fr' },
    { key: 'email', label: this.i18n.t('users.email'), width: '1.5fr' },
    { key: 'createdAt', label: this.i18n.t('users.registeredAt'), width: '1.2fr' },
    { key: 'status', label: this.i18n.t('admin.status'), width: '1fr' },
  ]);

  protected readonly selects = computed(() => [
    {
      key: 'role',
      label: this.i18n.t('users.role'),
      options: [
        { value: '', label: this.i18n.t('users.allRoles') },
        // The two public roles, then the three kinds of administrator. `ADMIN`
        // itself is not offered: an operator is looking for a finance officer
        // or a supervisor, not for the word "إدارة".
        { value: UserRole.Renter, label: this.roleLabel(UserRole.Renter) },
        { value: UserRole.Lessor, label: this.roleLabel(UserRole.Lessor) },
        ...Object.values(AdminRole).map((adminRole) => ({
          value: adminRole,
          label: this.roleLabel(UserRole.Admin, adminRole),
        })),
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
    {
      key: 'verificationStatus',
      label: this.i18n.t('users.verification'),
      options: [
        { value: '', label: this.i18n.t('admin.allStatuses') },
        ...Object.values(VerificationStatus).map((status) => ({
          value: status,
          label: statusText(ACCOUNT_VERIFICATION_DISPLAY[status], this.i18n.language()),
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
    const role = filters['role'] ?? '';
    const isAdminKind = Object.values(AdminRole).includes(role as AdminRole);

    this.users
      .list({
        // One control, two fields. `RENTER`/`LESSOR` are values of `role`; the
        // three administrator kinds are values of `adminRole`, because the API
        // sends a single `ADMIN` role with the kind beside it. Splitting here
        // is right for the operator, who is not thinking in fields.
        role: isAdminKind ? UserRole.Admin : ((role || undefined) as UserRole | undefined),
        adminRole: isAdminKind ? (role as AdminRole) : undefined,
        status: (filters['status'] as AccountStatus) || undefined,
        verificationStatus: (filters['verificationStatus'] as VerificationStatus) || undefined,
        // Name, mobile or email. Never the national id — it is encrypted, and
        // no partial search of it is possible.
        search: filters['search'] || undefined,
        page: this.list.page(),
      })
      .subscribe({
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

  protected onPage(page: number): void {
    this.list.setPage(page);
    this.fetch();
  }

  protected openRow(row: AdminUserRow): void {
    this.resetPanel();
    this.users.byId(row.id).subscribe({
      next: (detail) => this.detail.set(detail),
      error: () => this.notifications.error(this.i18n.t('users.error')),
    });
  }

  protected close(): void {
    this.detail.set(null);
    this.resetPanel();
  }

  // ── Actions ─────────────────────────────────────────────────────────────

  protected activate(): void {
    const id = this.detail()?.id;
    if (!id || !this.canSubmit()) return;

    this.submitting.set(true);
    this.users.activate(id, this.reason().trim()).subscribe({
      next: (detail) => this.afterAction(detail),
      error: () => this.failed(),
    });
  }

  /**
   * Suspends. The first attempt never carries `force`.
   *
   * If bookings are live the server refuses with the count, and that count is
   * what the confirmation is about — it cannot honestly be asked for before
   * the number exists.
   */
  protected suspend(force = false): void {
    const id = this.detail()?.id;
    if (!id || !this.canSubmit()) return;

    this.submitting.set(true);
    this.confirmSuspend.set(false);

    this.users.suspend(id, this.reason().trim(), force).subscribe({
      next: (detail) => this.afterAction(detail),
      error: (failure: unknown) => {
        this.submitting.set(false);
        if (!(failure instanceof ApiError)) {
          this.notifications.error(this.i18n.t('admin.actionFailed'));
          return;
        }

        const live = liveBookingsFromError(failure);
        if (live !== null) {
          this.liveBookings.set(live);
          this.confirmSuspend.set(true);
          return;
        }

        // Includes the two refusals whose buttons should never have been
        // drawn; saying the server's own message is more useful than a
        // generic failure if one somehow is.
        this.notifications.error(failure.message);
      },
    });
  }

  protected approveIdentity(): void {
    const id = this.detail()?.id;
    if (!id) return;

    this.submitting.set(true);
    this.users.reviewIdentity(id, true).subscribe({
      next: (detail) => this.afterAction(detail),
      error: () => this.failed(),
    });
  }

  protected openReject(): void {
    this.rejectReason.set('');
    this.rejectOpen.set(true);
  }

  /** A rejection needs a reason; the person has to know what to fix. */
  protected rejectIdentity(): void {
    const id = this.detail()?.id;
    if (!id || !this.rejectReason().trim()) return;

    this.submitting.set(true);
    this.rejectOpen.set(false);

    this.users.reviewIdentity(id, false, this.rejectReason().trim()).subscribe({
      next: (detail) => this.afterAction(detail),
      error: () => this.failed(),
    });
  }

  // ── Labels ──────────────────────────────────────────────────────────────

  protected roleLabel(role: UserRole, adminRole?: AdminRole | null): string {
    return statusText(userRoleDisplay(role, adminRole), this.i18n.language());
  }

  protected statusLabel(status: AccountStatus): string {
    return statusText(ACCOUNT_STATUS_DISPLAY[status], this.i18n.language());
  }

  protected statusTone(status: AccountStatus) {
    return ACCOUNT_STATUS_DISPLAY[status].tone;
  }

  protected verificationLabel(status: VerificationStatus | null): string {
    return status ? statusText(ACCOUNT_VERIFICATION_DISPLAY[status], this.i18n.language()) : '—';
  }

  protected isSuspended(): boolean {
    return this.detail()?.status === AccountStatus.Suspended;
  }

  private afterAction(detail: AdminUserDetail): void {
    this.submitting.set(false);
    this.detail.set(detail);
    this.resetInputs();
    this.notifications.success(this.i18n.t('users.statusChanged'));
    this.fetch();
  }

  private failed(): void {
    this.submitting.set(false);
    this.notifications.error(this.i18n.t('admin.actionFailed'));
  }

  private resetInputs(): void {
    this.reason.set('');
    this.liveBookings.set(null);
    this.confirmSuspend.set(false);
    this.rejectOpen.set(false);
    this.rejectReason.set('');
  }

  private resetPanel(): void {
    this.resetInputs();
    this.submitting.set(false);
  }
}
