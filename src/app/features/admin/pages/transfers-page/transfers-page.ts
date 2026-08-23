import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { PAYOUT_STATUS_DISPLAY, statusText } from '@core/constants/status-display';
import { PayoutStatus } from '@core/enums/payment.enum';
import { LanguageService } from '@core/i18n/language.service';
import type { LessorBankDetails, PayoutGroup, PayoutRow } from '@core/models/admin.model';
import { NotificationService } from '@core/services/notification.service';
import { UiBadge } from '@shared/components/ui-badge/ui-badge';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiModal } from '@shared/components/ui-modal/ui-modal';
import { UiMoney } from '@shared/components/ui-money/ui-money';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';
import { AdminFinanceService } from '../../services/admin-finance.service';
import { AdminSettingsStore } from '../../services/admin-settings.store';

/** Which dialog, if any, is open over the list. */
type Dialog = 'none' | 'execute' | 'reschedule' | 'frozen' | 'demand';

/**
 * ADM-06 — payouts (FR-PAY-06, UC-04).
 *
 * Dues are grouped by lessor because a transfer is executed per lessor, not per
 * booking, and the operator needs the bank details beside the total before they
 * touch anything.
 *
 * Four states, four different actions, and no default: a due row can be
 * executed, a failed one rescheduled, a frozen one only read, and one belonging
 * to a lessor with no bank details can only be chased. Offering "execute" on all
 * four would be how a payment goes to an account nobody verified.
 *
 * The full IBAN is never rendered until the operator asks for it, and asking is
 * a separate request the server can log (NFR-SEC-02).
 */
@Component({
  selector: 'app-admin-transfers-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminFinanceService],
  imports: [DatePipe, UiBadge, UiButton, UiEmptyState, UiModal, UiMoney, UiNotice, UiSkeleton],
  templateUrl: './transfers-page.html',
  styleUrl: './transfers-page.scss',
})
export class AdminTransfersPage {
  private readonly finance = inject(AdminFinanceService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly i18n = inject(LanguageService);
  protected readonly settings = inject(AdminSettingsStore);

  protected readonly groups = signal<PayoutGroup[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly failed = signal(false);
  protected readonly submitting = signal(false);

  protected readonly dialog = signal<Dialog>('none');
  protected readonly target = signal<{ group: PayoutGroup; row: PayoutRow } | null>(null);

  /** Populated only once the operator presses "كشف". */
  protected readonly revealed = signal<LessorBankDetails | null>(null);

  protected readonly bankReference = signal('');
  protected readonly executedOn = signal(today());
  protected readonly rescheduleDate = signal(today());
  protected readonly rescheduleReason = signal('');
  protected readonly demandMessage = signal('');

  protected readonly isEmpty = computed(() => this.groups().length === 0);

  protected readonly canExecute = computed(() => this.bankReference().trim().length >= 4);
  protected readonly canReschedule = computed(() => this.rescheduleReason().trim().length > 0);

  constructor() {
    this.fetch();
    this.demandMessage.set(this.i18n.t('transfers.demandDefault'));
  }

  protected fetch(): void {
    this.failed.set(false);
    this.isLoading.set(true);

    this.finance.payoutGroups().subscribe({
      next: (groups) => {
        this.groups.set(groups);
        this.isLoading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.isLoading.set(false);
      },
    });
  }

  // ── Row state helpers ──────────────────────────────────────────────────
  protected display(status: PayoutStatus) {
    return PAYOUT_STATUS_DISPLAY[status];
  }

  protected label(status: PayoutStatus): string {
    return statusText(PAYOUT_STATUS_DISPLAY[status], this.i18n.language());
  }

  /** Due, and the lessor's account is complete — the only executable state. */
  protected isExecutable(group: PayoutGroup, row: PayoutRow): boolean {
    return row.status === PayoutStatus.Due && !group.bankDetailsMissing;
  }

  protected isBlocked(group: PayoutGroup, row: PayoutRow): boolean {
    return row.status === PayoutStatus.Due && group.bankDetailsMissing;
  }

  protected isFailed(row: PayoutRow): boolean {
    return row.status === PayoutStatus.Failed;
  }

  protected isFrozen(row: PayoutRow): boolean {
    return row.status === PayoutStatus.OnHold;
  }

  protected isPaid(row: PayoutRow): boolean {
    return row.status === PayoutStatus.Paid;
  }

  // ── Dialogs ────────────────────────────────────────────────────────────
  protected openExecute(group: PayoutGroup, row: PayoutRow): void {
    this.target.set({ group, row });
    this.revealed.set(null);
    this.bankReference.set('');
    this.executedOn.set(today());
    this.dialog.set('execute');
  }

  protected openReschedule(group: PayoutGroup, row: PayoutRow): void {
    this.target.set({ group, row });
    this.rescheduleDate.set(today());
    this.rescheduleReason.set('');
    this.dialog.set('reschedule');
  }

  protected openFrozen(group: PayoutGroup, row: PayoutRow): void {
    this.target.set({ group, row });
    this.dialog.set('frozen');
  }

  protected openDemand(group: PayoutGroup, row: PayoutRow): void {
    this.target.set({ group, row });
    this.demandMessage.set(this.i18n.t('transfers.demandDefault'));
    this.dialog.set('demand');
  }

  protected close(): void {
    this.dialog.set('none');
    this.target.set(null);
    this.revealed.set(null);
  }

  protected reveal(): void {
    const row = this.target()?.row;
    if (!row) return;

    this.finance.bankDetails(row.id).subscribe({
      next: (details) => this.revealed.set(details),
      error: () => this.notifications.error(this.i18n.t('admin.actionFailed')),
    });
  }

  // ── Actions ────────────────────────────────────────────────────────────
  protected execute(): void {
    const row = this.target()?.row;
    if (!row || !this.canExecute()) return;

    this.submitting.set(true);
    this.finance
      .executePayout(row.id, {
        bankReference: this.bankReference().trim(),
        executedOn: this.executedOn(),
      })
      .subscribe({
        next: () => this.done('transfers.executed'),
        error: () => this.fail(),
      });
  }

  protected reschedule(): void {
    const row = this.target()?.row;
    if (!row || !this.canReschedule()) return;

    this.submitting.set(true);
    this.finance
      .reschedulePayout(row.id, {
        scheduledFor: this.rescheduleDate(),
        reason: this.rescheduleReason().trim(),
      })
      .subscribe({
        next: () => this.done('transfers.rescheduled'),
        error: () => this.fail(),
      });
  }

  protected demand(): void {
    const group = this.target()?.group;
    if (!group) return;

    this.submitting.set(true);
    this.finance.demandBankDetails(group.lessorId, this.demandMessage().trim()).subscribe({
      next: () => this.done('transfers.demandSent'),
      error: () => this.fail(),
    });
  }

  protected goToComplaints(): void {
    this.close();
    void this.router.navigateByUrl('/admin/complaints');
  }

  private done(key: 'transfers.executed' | 'transfers.rescheduled' | 'transfers.demandSent'): void {
    this.submitting.set(false);
    this.close();
    this.notifications.success(this.i18n.t(key));
    this.fetch();
  }

  private fail(): void {
    this.submitting.set(false);
    this.notifications.error(this.i18n.t('admin.actionFailed'));
  }
}

function today(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}
