import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  COMPLAINT_CATEGORY_DISPLAY,
  COMPLAINT_RESOLUTION_DISPLAY,
  COMPLAINT_STATUS_DISPLAY,
  REFUND_METHOD_DISPLAY,
  statusText,
} from '@core/constants/status-display';
import { ComplaintStatus, SETTLED_COMPLAINT_STATUSES } from '@core/enums/complaint.enum';
import { LanguageService } from '@core/i18n/language.service';
import { ApiError } from '@core/models/api-error.model';
import type { ComplaintDetail, ComplaintRefund } from '@core/models/complaint';
import { MAX_COMPLAINT_ATTACHMENTS } from '@core/models/complaint';
import { ComplaintsService } from '@core/services/complaints.service';
import { NotificationService } from '@core/services/notification.service';
import { UiBadge } from '@shared/components/ui-badge/ui-badge';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiComplaintThread } from '@shared/components/ui-complaint-thread/ui-complaint-thread';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiMoney } from '@shared/components/ui-money/ui-money';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';

/**
 * One complaint, as a conversation.
 *
 * Read by whichever party opens it — the person who raised it and the person
 * it is about see the same thread. Internal notes are not in it: the server
 * does not send them to `/me`, and the thread component marks one as a defect
 * rather than filtering it, so a leak would be visible instead of silent.
 *
 * Once the complaint is settled the reply box is gone rather than disabled.
 * A greyed-out box invites a click that answers with a 409; an explanation of
 * what was decided does not.
 */
@Component({
  selector: 'app-complaint-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    UiBadge,
    UiButton,
    UiComplaintThread,
    UiEmptyState,
    UiMoney,
    UiNotice,
    UiSkeleton,
  ],
  templateUrl: './complaint-detail-page.html',
  styleUrl: './complaint-detail-page.scss',
})
export class ComplaintDetailPage {
  readonly complaintId = input.required<string>();

  private readonly complaints = inject(ComplaintsService);
  private readonly notifications = inject(NotificationService);

  protected readonly i18n = inject(LanguageService);
  protected readonly maxFiles = MAX_COMPLAINT_ATTACHMENTS;

  protected readonly complaint = signal<ComplaintDetail | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly failed = signal(false);
  protected readonly sending = signal(false);
  protected readonly errorText = signal('');

  protected readonly body = signal('');
  protected readonly files = signal<readonly File[]>([]);

  protected readonly isSettled = computed(() => {
    const status = this.complaint()?.status;
    return !!status && SETTLED_COMPLAINT_STATUSES.includes(status);
  });

  protected readonly isYourTurn = computed(
    () => this.complaint()?.status === ComplaintStatus.AwaitingUser,
  );

  /**
   * Text or a file — but not neither. An empty reply with nothing attached is
   * a 422 `COMPLAINT_MESSAGE_EMPTY`, so the button says so by being off.
   */
  protected readonly canSend = computed(
    () => (!!this.body().trim() || this.files().length > 0) && !this.sending(),
  );

  /** Nobody has answered yet — worth saying plainly rather than showing nothing. */
  protected readonly awaitingFirstReply = computed(
    () => !!this.complaint() && this.complaint()!.firstResponseAt === null && !this.isSettled(),
  );

  constructor() {
    queueMicrotask(() => this.load());
  }

  protected load(): void {
    this.isLoading.set(true);
    this.failed.set(false);

    this.complaints.byId(this.complaintId()).subscribe({
      next: (complaint) => {
        this.complaint.set(complaint);
        this.isLoading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.isLoading.set(false);
      },
    });
  }

  protected onBody(event: Event): void {
    this.body.set((event.target as HTMLTextAreaElement).value);
  }

  protected onFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.files.set(Array.from(input.files ?? []).slice(0, MAX_COMPLAINT_ATTACHMENTS));
  }

  protected removeFile(index: number): void {
    this.files.update((list) => list.filter((_, i) => i !== index));
  }

  protected send(): void {
    if (!this.canSend()) return;

    this.sending.set(true);
    this.errorText.set('');

    this.complaints
      .reply(this.complaintId(), { body: this.body(), attachments: this.files() })
      .subscribe({
        next: (complaint) => {
          this.sending.set(false);
          this.body.set('');
          this.files.set([]);
          // The whole complaint comes back, including the status the server
          // moved on its own — replying while AWAITING_USER makes it
          // IN_PROGRESS, and this is how the badge learns that.
          this.complaint.set(complaint);
          this.notifications.success(this.i18n.t('complaint.replySent'));
        },
        error: (failure: unknown) => {
          this.sending.set(false);
          this.errorText.set(
            failure instanceof ApiError ? failure.message : this.i18n.t('results.errorHint'),
          );
          // It was settled while this was being typed. Re-read so the box goes
          // rather than staying open over a conversation that is finished.
          if (failure instanceof ApiError && failure.code === 'COMPLAINT_ALREADY_RESOLVED') {
            this.load();
          }
        },
      });
  }

  protected statusLabel(complaint: ComplaintDetail): string {
    return statusText(COMPLAINT_STATUS_DISPLAY[complaint.status], this.i18n.language());
  }

  protected statusTone(complaint: ComplaintDetail) {
    return COMPLAINT_STATUS_DISPLAY[complaint.status].tone;
  }

  protected categoryLabel(complaint: ComplaintDetail): string {
    return statusText(COMPLAINT_CATEGORY_DISPLAY[complaint.category], this.i18n.language());
  }

  protected resolutionLabel(complaint: ComplaintDetail): string {
    return complaint.resolution
      ? statusText(COMPLAINT_RESOLUTION_DISPLAY[complaint.resolution], this.i18n.language())
      : '';
  }

  protected refundMethodLabel(refund: ComplaintRefund): string {
    return statusText(REFUND_METHOD_DISPLAY[refund.method], this.i18n.language());
  }
}
