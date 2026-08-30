import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  PAYOUT_BLOCKED_DISPLAY,
  PAYOUT_STATUS_DISPLAY,
  statusText,
} from '@core/constants/status-display';
import { PayoutStatus } from '@core/enums/payment.enum';
import { PayoutEligibility } from '@core/enums/payment.enum';
import { LanguageService } from '@core/i18n/language.service';
import type { EligiblePayout, Payout } from '@core/models/payment.model';
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

/** Which dialog, if any, is open over the lists. */
type Dialog = 'none' | 'approve' | 'paid' | 'failed';

/**
 * ADM-06 — payouts (FR-PAY-06, UC-04).
 *
 * Two lists, because the API has two things and they are not the same thing:
 *
 * - **Releasable money with no payout yet.** Grouped by lessor, because a
 *   transfer is one bank instruction to one account — paying per booking would
 *   be a bank charge per night rented. Each row carries `blocked`, and a
 *   blocked row shows the obstacle instead of a button: an operator should see
 *   why they cannot pay before they try.
 * - **Payouts.** These exist only once somebody approves one, and from then on
 *   they are approved, paid, or failed. There is no "due" payout and no "on
 *   hold" one — those describe money, not transfers, and they live in the list
 *   above.
 *
 * Recording an execution requires the bank reference. The server refuses
 * without it and so does this screen: a transfer marked done with nothing tying
 * it to a bank statement is not a record anybody can audit, which is the whole
 * reason for recording it.
 *
 * The full IBAN is never shown. The API sends the last four digits and nothing
 * else, which is the right amount for confirming an account before sending
 * money to it (NFR-SEC-02).
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

  protected readonly i18n = inject(LanguageService);
  protected readonly settings = inject(AdminSettingsStore);

  protected readonly eligible = signal<EligiblePayout[]>([]);
  protected readonly payouts = signal<Payout[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly failed = signal(false);
  protected readonly submitting = signal(false);

  protected readonly dialog = signal<Dialog>('none');
  protected readonly lessor = signal<EligiblePayout | null>(null);
  protected readonly payout = signal<Payout | null>(null);

  protected readonly bankReference = signal('');
  protected readonly failureReason = signal('');

  /**
   * Which eligibility rule the platform is running, in words.
   *
   * A value this build does not recognise falls through to the rule the
   * platform is configured with rather than to a blank line — but it is never
   * silently relabelled as one of the three.
   */
  protected readonly eligibilityNote = computed(() => {
    switch (this.settings.payoutEligibleAfter()) {
      case PayoutEligibility.OnPayment:
        return this.i18n.t('transfers.eligibleOnPayment');
      case PayoutEligibility.OnBookingStart:
        return this.i18n.t('transfers.eligibleOnStart');
      default:
        return this.i18n.t('transfers.eligibleAfter24h');
    }
  });

  protected readonly isEmpty = computed(
    () => this.eligible().length === 0 && this.payouts().length === 0,
  );

  /** Enough of a reference to find the transfer on a statement. */
  protected readonly canConfirmPaid = computed(() => this.bankReference().trim().length >= 4);
  protected readonly canRecordFailure = computed(() => this.failureReason().trim().length > 0);

  constructor() {
    this.fetch();
  }

  protected fetch(): void {
    this.failed.set(false);
    this.isLoading.set(true);

    this.finance.eligiblePayouts().subscribe({
      next: (page) => {
        this.eligible.set(page.items);
        this.isLoading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.isLoading.set(false);
      },
    });

    // The two lists fail independently: an empty eligible list is the ordinary
    // state once everything is approved, and it must not blank the payouts
    // beside it.
    this.finance.payouts().subscribe({
      next: (page) => this.payouts.set(page.items),
      error: () => this.payouts.set([]),
    });
  }

  // ── Row state ──────────────────────────────────────────────────────────
  protected display(status: PayoutStatus) {
    return PAYOUT_STATUS_DISPLAY[status];
  }

  protected label(status: PayoutStatus): string {
    return statusText(PAYOUT_STATUS_DISPLAY[status], this.i18n.language());
  }

  /** Why this lessor's money cannot be sent, in the operator's language. */
  protected blockedText(row: EligiblePayout): string {
    const display = row.blocked ? PAYOUT_BLOCKED_DISPLAY[row.blocked] : null;
    return display ? statusText(display, this.i18n.language()) : '';
  }

  protected isAwaitingExecution(payout: Payout): boolean {
    return payout.status === PayoutStatus.Approved;
  }

  protected isFailed(payout: Payout): boolean {
    return payout.status === PayoutStatus.Failed;
  }

  protected isPaid(payout: Payout): boolean {
    return payout.status === PayoutStatus.Paid;
  }

  // ── Dialogs ────────────────────────────────────────────────────────────
  protected openApprove(row: EligiblePayout): void {
    this.lessor.set(row);
    this.dialog.set('approve');
  }

  protected openPaid(payout: Payout): void {
    this.payout.set(payout);
    this.bankReference.set('');
    this.dialog.set('paid');
  }

  protected openFailed(payout: Payout): void {
    this.payout.set(payout);
    this.failureReason.set('');
    this.dialog.set('failed');
  }

  protected close(): void {
    this.dialog.set('none');
    this.lessor.set(null);
    this.payout.set(null);
  }

  // ── Actions ────────────────────────────────────────────────────────────
  protected approve(): void {
    const row = this.lessor();
    if (!row || row.blocked) return;

    this.submitting.set(true);
    this.finance.approvePayout(row.lessorId).subscribe({
      next: () => this.done('transfers.approved'),
      error: () => this.fail(),
    });
  }

  protected confirmPaid(): void {
    const payout = this.payout();
    if (!payout || !this.canConfirmPaid()) return;

    this.submitting.set(true);
    this.finance.markPaid(payout.id, this.bankReference().trim()).subscribe({
      next: () => this.done('transfers.executed'),
      error: () => this.fail(),
    });
  }

  protected recordFailure(): void {
    const payout = this.payout();
    if (!payout || !this.canRecordFailure()) return;

    this.submitting.set(true);
    this.finance.markFailed(payout.id, this.failureReason().trim()).subscribe({
      next: () => this.done('transfers.failureRecorded'),
      error: () => this.fail(),
    });
  }

  /** Back to awaiting execution, once whatever failed has been corrected. */
  protected retry(payout: Payout): void {
    this.submitting.set(true);
    this.finance.retryPayout(payout.id).subscribe({
      next: () => this.done('transfers.retried'),
      error: () => this.fail(),
    });
  }

  private done(
    key:
      | 'transfers.approved'
      | 'transfers.executed'
      | 'transfers.failureRecorded'
      | 'transfers.retried',
  ): void {
    this.submitting.set(false);
    this.close();
    this.notifications.success(this.i18n.t(key));
    // Both lists move together: approving takes a row out of one and puts a
    // payout into the other.
    this.fetch();
  }

  private fail(): void {
    this.submitting.set(false);
    this.notifications.error(this.i18n.t('admin.actionFailed'));
  }
}
