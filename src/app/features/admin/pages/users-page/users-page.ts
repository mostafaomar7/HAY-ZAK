import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  ACCOUNT_STATUS_DISPLAY,
  ACCOUNT_VERIFICATION_DISPLAY,
  statusText,
  userRoleDisplay,
} from '@core/constants/status-display';
import { Permission } from '@core/constants/permissions';
import { AccountStatus, AdminRole, UserRole, VerificationStatus } from '@core/enums/user-role.enum';
import { LanguageService } from '@core/i18n/language.service';
import { ApiError } from '@core/models/api-error.model';
import type { AdminActivation, AdminUserDetail, AdminUserRow } from '@core/models/admin-user';
import { canActOnUser } from '@core/models/admin-user';
import { AuthService } from '@core/services/auth.service';
import { NotificationService } from '@core/services/notification.service';
import { PermissionService } from '@core/services/permission.service';
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
  private readonly permissions = inject(PermissionService);

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

  /** The kind being moved to. Empty until the system administrator picks one. */
  protected readonly nextAdminRole = signal<AdminRole | ''>('');

  /**
   * Whether the kind of administrator this account is may be changed here.
   *
   * The mirror image of `canAct()`: that one covers everybody who is *not* an
   * administrator, this one covers only administrators — so the two blocks are
   * mutually exclusive and share the one reason field between them.
   *
   * Nobody may change their own kind (`ADMIN_CANNOT_ACT_ON_SELF`), and the
   * endpoint needs `admins:manage`, which only the system administrator holds.
   * Both are the server's refusals; this decides whether to draw a control that
   * would meet one.
   */
  protected readonly canChangeRole = computed(() => {
    const detail = this.detail();
    return (
      !!detail &&
      detail.role === UserRole.Admin &&
      detail.id !== this.auth.user()?.id &&
      this.permissions.can(Permission.ManageAdmins)
    );
  });

  /**
   * The kinds this account is not already. Offering the current one would be a
   * control whose only outcome is 409 `ADMIN_USER_ALREADY_IN_STATE`.
   */
  protected readonly adminRoleOptions = computed(() =>
    Object.values(AdminRole).filter((role) => role !== this.detail()?.adminRole),
  );

  protected readonly canChangeRoleSubmit = computed(
    () => !!this.nextAdminRole() && this.canSubmit(),
  );

  // ── Creating an administrator ───────────────────────────────────────────

  protected readonly createOpen = signal(false);
  protected readonly newAdmin = signal({ fullName: '', mobile: '', email: '', adminRole: '' });

  /**
   * The server's own sentence about how the new account gets a password.
   *
   * Held after a successful create so the form is replaced by it rather than
   * closing: this is the one thing on the screen the operator has to pass on to
   * another person, and a toast that vanishes is the wrong place for it.
   */
  protected readonly activation = signal<AdminActivation | null>(null);

  protected readonly canCreateAdmin = computed(() => this.permissions.can(Permission.ManageAdmins));

  /** The three fields the endpoint requires; the email is optional. */
  protected readonly canSubmitNewAdmin = computed(() => {
    const draft = this.newAdmin();
    return (
      !!draft.fullName.trim() && !!draft.mobile.trim() && !!draft.adminRole && !this.submitting()
    );
  });

  protected readonly adminRoles = Object.values(AdminRole);

  protected readonly awaitingIdentity = computed(
    () => this.detail()?.identity?.verificationStatus === VerificationStatus.Pending,
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

  // ── Creating an administrator ───────────────────────────────────────────

  protected openCreate(): void {
    this.newAdmin.set({ fullName: '', mobile: '', email: '', adminRole: '' });
    this.activation.set(null);
    this.createOpen.set(true);
  }

  protected closeCreate(): void {
    this.createOpen.set(false);
    this.activation.set(null);
  }

  protected setNewAdmin(field: 'fullName' | 'mobile' | 'email' | 'adminRole', value: string): void {
    this.newAdmin.update((draft) => ({ ...draft, [field]: value }));
  }

  /**
   * Creates the account. **There is no password field, and that is the design.**
   *
   * The server makes the account without one and answers with the sentence to
   * read out; the new administrator sets their own through the reset flow, so
   * the credential is never known by two people. A password box here would be
   * stripped in silence by the server's mass-assignment guard — it would look
   * like it worked and hand somebody a password that opened nothing.
   */
  protected createAdmin(): void {
    const draft = this.newAdmin();
    if (!this.canSubmitNewAdmin()) return;

    this.submitting.set(true);
    this.users
      .createAdmin({
        fullName: draft.fullName.trim(),
        mobile: draft.mobile.trim(),
        adminRole: draft.adminRole as AdminRole,
        ...(draft.email.trim() ? { email: draft.email.trim() } : {}),
      })
      .subscribe({
        next: (created) => {
          this.submitting.set(false);
          // The dialog stays open on the instruction rather than closing on a
          // toast: the operator has to relay it before it is any use.
          this.activation.set(created.activation);
          this.notifications.success(this.i18n.t('users.adminCreated'));
          this.fetch();
        },
        error: (failure: unknown) => {
          this.submitting.set(false);
          this.notifications.error(
            failure instanceof ApiError ? failure.message : this.i18n.t('admin.actionFailed'),
          );
        },
      });
  }

  /** The instruction in the language on screen, from the server either way. */
  protected activationText(activation: AdminActivation): string {
    return this.i18n.language() === 'en' ? activation.instructionEn : activation.instructionAr;
  }

  /**
   * Moves an administrator between the three kinds (FR-ADM-04).
   *
   * The permissions the account holds are re-issued by the server, so the
   * response is the authority on what it may now do — but it arrives **without
   * the `activity` block**, and a role change cannot alter those five counts.
   * They are carried over rather than allowed to read as five zeros.
   */
  protected changeAdminRole(): void {
    const current = this.detail();
    const next = this.nextAdminRole();
    if (!current || !next || !this.canChangeRoleSubmit()) return;

    this.submitting.set(true);
    this.users.changeAdminRole(current.id, next, this.reason().trim()).subscribe({
      next: (updated) =>
        this.afterAction(
          { ...updated, activity: current.activity },
          this.i18n.t('users.roleChanged'),
        ),
      error: (failure: unknown) => {
        this.submitting.set(false);
        // The server's own message, including the 409 for a kind the account
        // already holds — which the picker should have made unreachable.
        this.notifications.error(
          failure instanceof ApiError ? failure.message : this.i18n.t('admin.actionFailed'),
        );
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

  /** The kind alone — "مشرف العمليات". Same table the row and the filter read,
   * so the picker cannot end up naming a role differently from the list. */
  protected adminRoleLabel(adminRole: AdminRole): string {
    return statusText(userRoleDisplay(UserRole.Admin, adminRole), this.i18n.language());
  }

  protected statusLabel(status: AccountStatus): string {
    return statusText(ACCOUNT_STATUS_DISPLAY[status], this.i18n.language());
  }

  protected statusTone(status: AccountStatus) {
    return ACCOUNT_STATUS_DISPLAY[status].tone;
  }

  /** "—" for an account that has never submitted a document at all. */
  protected verificationLabel(status: VerificationStatus | null | undefined): string {
    return status ? statusText(ACCOUNT_VERIFICATION_DISPLAY[status], this.i18n.language()) : '—';
  }

  protected isSuspended(): boolean {
    return this.detail()?.status === AccountStatus.Suspended;
  }

  private afterAction(detail: AdminUserDetail, message?: string): void {
    this.submitting.set(false);
    this.detail.set(detail);
    this.resetInputs();
    this.notifications.success(message ?? this.i18n.t('users.statusChanged'));
    this.fetch();
  }

  private failed(): void {
    this.submitting.set(false);
    this.notifications.error(this.i18n.t('admin.actionFailed'));
  }

  private resetInputs(): void {
    this.reason.set('');
    this.nextAdminRole.set('');
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
