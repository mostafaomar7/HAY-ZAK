import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  COMPLAINT_CATEGORY_DISPLAY,
  COMPLAINT_STATUS_DISPLAY,
  statusText,
} from '@core/constants/status-display';
import { ComplaintStatus, SETTLED_COMPLAINT_STATUSES } from '@core/enums/complaint.enum';
import { LanguageService } from '@core/i18n/language.service';
import type { Complaint } from '@core/models/complaint';
import { ComplaintsService } from '@core/services/complaints.service';
import { UiBadge } from '@shared/components/ui-badge/ui-badge';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiPager } from '@shared/components/ui-pager/ui-pager';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';

/**
 * "شكاويّ" — every complaint this account is a party to.
 *
 * Both the ones raised and the ones raised *against* them: a lessor sees a
 * complaint about their own space here, because they are expected to answer
 * it. The list does not say which is which, and does not need to — the subject
 * and the booking do.
 *
 * Split into live and settled the same way "حجوزاتي" splits, and for the same
 * reason: what needs an answer is a different question from what happened.
 */
@Component({
  selector: 'app-my-complaints-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiBadge, UiButton, UiEmptyState, UiPager, UiSkeleton],
  templateUrl: './my-complaints-page.html',
  styleUrl: './my-complaints-page.scss',
})
export class MyComplaintsPage {
  private readonly complaints = inject(ComplaintsService);

  protected readonly i18n = inject(LanguageService);

  protected readonly items = signal<Complaint[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly failed = signal(false);
  protected readonly page = signal(1);
  protected readonly total = signal(0);
  protected readonly pageSize = signal(20);

  protected readonly live = computed(() =>
    this.items().filter((c) => !SETTLED_COMPLAINT_STATUSES.includes(c.status)),
  );

  protected readonly settled = computed(() =>
    this.items().filter((c) => SETTLED_COMPLAINT_STATUSES.includes(c.status)),
  );

  constructor() {
    this.fetch();
  }

  protected fetch(): void {
    this.isLoading.set(true);
    this.failed.set(false);

    this.complaints.list({ page: this.page() }).subscribe({
      next: (result) => {
        this.items.set(result.items);
        this.total.set(result.pagination.total);
        this.pageSize.set(result.pagination.pageSize || 20);
        this.isLoading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.isLoading.set(false);
      },
    });
  }

  protected onPage(page: number): void {
    this.page.set(page);
    this.fetch();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** True while the team is waiting on this person, which is worth surfacing. */
  protected needsReply(complaint: Complaint): boolean {
    return complaint.status === ComplaintStatus.AwaitingUser;
  }

  protected statusLabel(complaint: Complaint): string {
    return statusText(COMPLAINT_STATUS_DISPLAY[complaint.status], this.i18n.language());
  }

  protected statusTone(complaint: Complaint) {
    return COMPLAINT_STATUS_DISPLAY[complaint.status].tone;
  }

  protected categoryLabel(complaint: Complaint): string {
    return statusText(COMPLAINT_CATEGORY_DISPLAY[complaint.category], this.i18n.language());
  }
}
