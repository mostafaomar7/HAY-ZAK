import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  COMPLAINT_CATEGORY_DISPLAY,
  COMPLAINT_RESOLUTION_DISPLAY,
  COMPLAINT_STATUS_ADMIN_DISPLAY,
  REFUND_METHOD_DISPLAY,
  statusText,
} from '@core/constants/status-display';
import { Permission } from '@core/constants/permissions';
import {
  ComplaintCategory,
  ComplaintResolution,
  ComplaintStatus,
  RefundMethod,
  SETTLED_COMPLAINT_STATUSES,
  isRefundingResolution,
} from '@core/enums/complaint.enum';
import { LanguageService } from '@core/i18n/language.service';
import { ApiError } from '@core/models/api-error.model';
import type { Complaint, ComplaintDetail } from '@core/models/complaint';
import { MAX_COMPLAINT_ATTACHMENTS, MIN_RESOLUTION_NOTE } from '@core/models/complaint';
import { NotificationService } from '@core/services/notification.service';
import { PermissionService } from '@core/services/permission.service';
import { halalasToSar, sarToHalalas } from '@core/utils/money.utils';
import { UiBadge } from '@shared/components/ui-badge/ui-badge';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiComplaintThread } from '@shared/components/ui-complaint-thread/ui-complaint-thread';
import { UiMoney } from '@shared/components/ui-money/ui-money';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { AdminFilterBar } from '../../components/admin-filter-bar/admin-filter-bar';
import type { AdminFilterValues } from '../../components/admin-filter-bar/admin-filter-bar';
import { AdminPanel } from '../../components/admin-panel/admin-panel';
import { AdminTable } from '../../components/admin-table/admin-table';
import type { AdminColumn } from '../../components/admin-table/admin-table';
import { AdminListState } from '../../services/admin-list-state';
import { AdminComplaintsService } from '../../services/admin-complaints.service';
import { AdminQueueCountsService } from '../../services/admin-queue-counts.service';

/**
 * ADM-04 — complaints (FR-ADM-08), and the only exception path in the product.
 *
 * Nothing else in HAY-ZAK cancels a booking, refunds a payment or suspends a
 * listing. Every one of those actions is a *resolution* of a complaint, which
 * is why this screen carries more weight than a queue usually does: the
 * decision taken here is the whole of the platform's ability to put something
 * right.
 *
 * Two consequences shape the screen.
 *
 * **The order is the server's.** The queue comes back sorted by `slaDueAt` —
 * whoever has been waiting longest for an answer we promised is first — and no
 * column offers to re-sort it. An operator who sorts by date raised is
 * answering a different question from the one this screen exists to answer.
 *
 * **Refunds are a narrower permission than the rest.** `complaints:manage`
 * lets an operations supervisor cancel a booking, suspend a listing and freeze
 * a transfer; moving money additionally needs `refunds:issue`, which they do
 * not have. The two refunding resolutions are therefore disabled rather than
 * offered — the server refuses them anyway, but meeting a 403 after filling in
 * an amount, a method and a bank reference is not the same as being told at
 * the start.
 */
@Component({
  selector: 'app-admin-complaints-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminComplaintsService],
  imports: [
    DatePipe,
    AdminFilterBar,
    AdminPanel,
    AdminTable,
    UiBadge,
    UiButton,
    UiComplaintThread,
    UiMoney,
    UiNotice,
  ],
  templateUrl: './complaints-page.html',
  styleUrl: './complaints-page.scss',
})
export class AdminComplaintsPage {
  private readonly complaints = inject(AdminComplaintsService);
  private readonly notifications = inject(NotificationService);
  private readonly permissions = inject(PermissionService);
  private readonly queues = inject(AdminQueueCountsService);

  protected readonly i18n = inject(LanguageService);
  protected readonly list = new AdminListState();
  protected readonly maxFiles = MAX_COMPLAINT_ATTACHMENTS;

  protected readonly rows = signal<Complaint[]>([]);
  protected readonly detail = signal<ComplaintDetail | null>(null);
  protected readonly submitting = signal(false);

  // ── The reply box ───────────────────────────────────────────────────────
  protected readonly messageBody = signal('');
  protected readonly isInternal = signal(false);
  protected readonly files = signal<readonly File[]>([]);

  // ── The resolution form ─────────────────────────────────────────────────
  protected readonly resolution = signal<ComplaintResolution | ''>('');
  protected readonly note = signal('');
  protected readonly refundSar = signal('');
  protected readonly refundMethod = signal<RefundMethod>(RefundMethod.Gateway);
  protected readonly refundReference = signal('');
  /** Set from `meta.remaining` on a 422, so the real ceiling is on screen. */
  protected readonly refundableHalalas = signal<number | null>(null);
  protected readonly resolveError = signal('');

  /** Closing without a decision — a duplicate, or somebody withdrew it. */
  protected readonly closeNote = signal('');
  protected readonly closing = signal(false);

  protected readonly canIssueRefunds = computed(() =>
    this.permissions.can(Permission.IssueRefunds),
  );

  protected readonly isSettled = computed(() => {
    const status = this.detail()?.status;
    return !!status && SETTLED_COMPLAINT_STATUSES.includes(status);
  });

  protected readonly resolutionOptions = computed(() =>
    Object.values(ComplaintResolution).map((value) => ({
      value,
      label: statusText(COMPLAINT_RESOLUTION_DISPLAY[value], this.i18n.language()),
      // The server refuses these without `refunds:issue`. Said here, before
      // an amount has been typed rather than after.
      disabled: isRefundingResolution(value) && !this.canIssueRefunds(),
    })),
  );

  protected readonly refundMethodOptions = computed(() =>
    Object.values(RefundMethod).map((value) => ({
      value,
      label: statusText(REFUND_METHOD_DISPLAY[value], this.i18n.language()),
    })),
  );

  protected readonly needsRefundFields = computed(() => {
    const chosen = this.resolution();
    return !!chosen && isRefundingResolution(chosen);
  });

  protected readonly needsReference = computed(
    () => this.needsRefundFields() && this.refundMethod() === RefundMethod.ManualTransfer,
  );

  protected readonly canResolve = computed(() => {
    if (!this.resolution() || this.note().trim().length < MIN_RESOLUTION_NOTE) return false;
    if (this.submitting()) return false;

    if (this.needsRefundFields()) {
      if (!(Number(this.refundSar()) > 0)) return false;
      // A manual transfer nobody can trace is not a record of anything.
      if (this.needsReference() && !this.refundReference().trim()) return false;
    }
    return true;
  });

  /** Text or a file — an empty message with neither is a 422. */
  protected readonly canSendMessage = computed(
    () => (!!this.messageBody().trim() || this.files().length > 0) && !this.submitting(),
  );

  protected readonly canClose = computed(
    () => this.closeNote().trim().length >= MIN_RESOLUTION_NOTE && !this.closing(),
  );

  protected readonly columns = computed<AdminColumn[]>(() => [
    { key: 'referenceNo', label: this.i18n.t('complaints.reference'), width: '1.2fr' },
    { key: 'subject', label: this.i18n.t('complaints.subject'), width: '2fr' },
    { key: 'category', label: this.i18n.t('complaints.category'), width: '1.4fr' },
    { key: 'status', label: this.i18n.t('admin.status'), width: '1.2fr' },
    // Not sortable, and that is the point: the server orders this queue by
    // who has waited longest, which is the question the screen answers.
    { key: 'slaDueAt', label: this.i18n.t('complaints.slaDue'), width: '1.3fr' },
  ]);

  protected readonly selects = computed(() => [
    {
      key: 'status',
      label: this.i18n.t('admin.status'),
      options: [
        { value: '', label: this.i18n.t('admin.allStatuses') },
        ...Object.values(ComplaintStatus).map((status) => ({
          value: status,
          label: statusText(COMPLAINT_STATUS_ADMIN_DISPLAY[status], this.i18n.language()),
        })),
      ],
    },
    {
      key: 'category',
      label: this.i18n.t('complaints.category'),
      options: [
        { value: '', label: this.i18n.t('admin.allStatuses') },
        ...Object.values(ComplaintCategory).map((category) => ({
          value: category,
          label: statusText(COMPLAINT_CATEGORY_DISPLAY[category], this.i18n.language()),
        })),
      ],
    },
    {
      key: 'overdue',
      label: this.i18n.t('complaints.overdue'),
      options: [
        { value: '', label: this.i18n.t('admin.allStatuses') },
        { value: 'true', label: this.i18n.t('complaints.overdue') },
      ],
    },
  ]);

  constructor() {
    this.fetch();
  }

  protected fetch(): void {
    this.list.begin();
    const filters = this.list.filters();

    this.complaints
      .list({
        status: (filters['status'] as ComplaintStatus) || undefined,
        category: (filters['category'] as ComplaintCategory) || undefined,
        overdue: filters['overdue'] === 'true',
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

  protected openRow(row: Complaint): void {
    this.resetPanel();
    this.complaints.byId(row.id).subscribe({
      next: (detail) => this.detail.set(detail),
      error: () => this.notifications.error(this.i18n.t('complaints.error')),
    });
  }

  protected closePanel(): void {
    this.detail.set(null);
    this.resetPanel();
  }

  // ── Messages ────────────────────────────────────────────────────────────

  protected onFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.files.set(Array.from(input.files ?? []).slice(0, MAX_COMPLAINT_ATTACHMENTS));
  }

  protected sendMessage(): void {
    const id = this.detail()?.id;
    if (!id || !this.canSendMessage()) return;

    this.submitting.set(true);
    this.complaints
      .reply(id, {
        body: this.messageBody(),
        attachments: this.files(),
        isInternal: this.isInternal(),
      })
      .subscribe({
        next: (detail) => {
          this.submitting.set(false);
          this.messageBody.set('');
          this.files.set([]);
          this.detail.set(detail);
          // Only a real reply moves the status and stops the clock, so the
          // queue is only worth re-reading when one was sent.
          if (!this.isInternal()) this.fetch();
        },
        error: () => {
          this.submitting.set(false);
          this.notifications.error(this.i18n.t('admin.actionFailed'));
        },
      });
  }

  // ── Resolution ──────────────────────────────────────────────────────────

  protected pickResolution(value: string): void {
    this.resolution.set(value as ComplaintResolution);
    this.resolveError.set('');
  }

  protected pickRefundMethod(value: string): void {
    this.refundMethod.set(value as RefundMethod);
  }

  protected resolve(): void {
    const id = this.detail()?.id;
    if (!id || !this.canResolve()) return;

    this.submitting.set(true);
    this.resolveError.set('');

    const refunding = this.needsRefundFields();

    this.complaints
      .resolve(id, {
        resolution: this.resolution() as ComplaintResolution,
        note: this.note().trim(),
        ...(refunding
          ? {
              refundAmountHalalas: sarToHalalas(Number(this.refundSar())),
              refundMethod: this.refundMethod(),
              ...(this.needsReference() ? { refundReference: this.refundReference().trim() } : {}),
            }
          : {}),
      })
      .subscribe({
        next: (detail) => {
          this.submitting.set(false);
          this.detail.set(detail);
          this.notifications.success(this.i18n.t('complaints.resolved'));
          this.queues.refresh();
          this.fetch();
        },
        error: (failure: unknown) => {
          this.submitting.set(false);
          if (!(failure instanceof ApiError)) {
            this.notifications.error(this.i18n.t('admin.actionFailed'));
            return;
          }
          this.handleResolveError(failure);
        },
      });
  }

  /**
   * Every refund failure leaves the complaint open and no money moved, so all
   * of them end in a form the operator can correct and send again — never in a
   * message that reads like it worked.
   */
  private handleResolveError(failure: ApiError): void {
    if (failure.code === 'REFUND_EXCEEDS_PAYMENT') {
      // The server knows the real ceiling; putting it on screen turns a
      // rejection into an instruction.
      const remaining = failure.metaNumber('remaining');
      if (remaining !== undefined) this.refundableHalalas.set(remaining);
      this.resolveError.set(failure.message);
      return;
    }

    if (failure.code === 'REFUND_GATEWAY_FAILED') {
      this.resolveError.set(this.i18n.t('complaints.gatewayFailed'));
      return;
    }

    // Already settled — a second attempt is a 409. Re-read so the form goes.
    if (failure.code === 'COMPLAINT_ALREADY_RESOLVED') {
      this.resolveError.set(this.i18n.t('complaints.settledAlready'));
      this.openRow({ id: this.detail()!.id } as Complaint);
      return;
    }

    this.resolveError.set(failure.details[0]?.message || failure.message);
  }

  protected close(): void {
    const id = this.detail()?.id;
    if (!id || !this.canClose()) return;

    this.closing.set(true);
    this.complaints.close(id, this.closeNote().trim()).subscribe({
      next: (detail) => {
        this.closing.set(false);
        this.detail.set(detail);
        this.queues.refresh();
        this.fetch();
      },
      error: () => {
        this.closing.set(false);
        this.notifications.error(this.i18n.t('admin.actionFailed'));
      },
    });
  }

  // ── Labels ──────────────────────────────────────────────────────────────

  protected statusLabel(status: ComplaintStatus): string {
    return statusText(COMPLAINT_STATUS_ADMIN_DISPLAY[status], this.i18n.language());
  }

  protected statusTone(status: ComplaintStatus) {
    return COMPLAINT_STATUS_ADMIN_DISPLAY[status].tone;
  }

  protected categoryLabel(category: ComplaintCategory): string {
    return statusText(COMPLAINT_CATEGORY_DISPLAY[category], this.i18n.language());
  }

  protected resolutionLabel(resolution: ComplaintResolution): string {
    return statusText(COMPLAINT_RESOLUTION_DISPLAY[resolution], this.i18n.language());
  }

  protected remainingLabel(): string {
    const remaining = this.refundableHalalas();
    return remaining === null
      ? ''
      : this.i18n.t('complaints.refundRemaining', { amount: halalasToSar(remaining) });
  }

  private resetPanel(): void {
    this.messageBody.set('');
    this.isInternal.set(false);
    this.files.set([]);
    this.resolution.set('');
    this.note.set('');
    this.refundSar.set('');
    this.refundMethod.set(RefundMethod.Gateway);
    this.refundReference.set('');
    this.refundableHalalas.set(null);
    this.resolveError.set('');
    this.closeNote.set('');
  }
}
