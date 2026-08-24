import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BookingStatus } from '@core/enums/booking-status.enum';
import { LessorRequestsService } from '../../services/lessor-requests.service';
import { RequestCard } from '../../components/request-card/request-card';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';
import type { TabItem } from '@shared/components/ui-tabs/ui-tabs';
import { UiTabs } from '@shared/components/ui-tabs/ui-tabs';

type RequestTab = 'new' | 'active' | 'past';

/**
 * LSR-05 — "الطلبات الواردة (عرض فقط)".
 *
 * The three tabs group booking states rather than mapping one-to-one, which is
 * why the grouping lives here as data: "الطلبات الجديدة" covers everything still
 * awaiting money or a decision, "النشطة" what is running, "المنتهية" the
 * terminal states.
 */
@Component({
  selector: 'app-requests-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [LessorRequestsService],
  imports: [RequestCard, UiButton, UiEmptyState, UiNotice, UiSkeleton, UiTabs],
  templateUrl: './requests-page.html',
  styleUrl: './requests-page.scss',
})
export class RequestsPage {
  private readonly service = inject(LessorRequestsService);

  protected readonly isLoading = this.service.isLoading;
  protected readonly tab = signal<RequestTab>('new');
  protected readonly failed = signal(false);

  private static readonly TAB_STATUSES: Record<RequestTab, readonly BookingStatus[]> = {
    new: [
      BookingStatus.Draft,
      BookingStatus.AwaitingPayment,
      BookingStatus.Confirmed,
      BookingStatus.Confirmed,
    ],
    active: [BookingStatus.Active],
    past: [
      BookingStatus.Completed,
      BookingStatus.Cancelled,
      BookingStatus.Cancelled,
      BookingStatus.Expired,
    ],
  };

  protected readonly tabs = computed<readonly TabItem<RequestTab>[]>(() => [
    { value: 'new', label: 'الطلبات الجديدة', count: this.countFor('new') },
    { value: 'active', label: 'النشطة', count: this.countFor('active') },
    { value: 'past', label: 'المنتهية', count: this.countFor('past') },
  ]);

  protected readonly visibleRequests = computed(() => {
    const allowed = RequestsPage.TAB_STATUSES[this.tab()];
    return this.service.requests().filter((b) => allowed.includes(b.status));
  });

  protected readonly emptyMessage = computed(() => {
    switch (this.tab()) {
      case 'active':
        return 'لا توجد حجوزات سارية على مساحاتك حاليًا.';
      case 'past':
        return 'لا توجد حجوزات منتهية بعد.';
      default:
        return 'لم تصل أي طلبات حجز جديدة بعد.';
    }
  });

  constructor() {
    this.fetch();
  }

  protected onTab(tab: RequestTab): void {
    this.tab.set(tab);
  }

  protected fetch(): void {
    this.failed.set(false);
    this.service.load().subscribe({ error: () => this.failed.set(true) });
  }

  private countFor(tab: RequestTab): number {
    const allowed = RequestsPage.TAB_STATUSES[tab];
    return this.service.requests().filter((b) => allowed.includes(b.status)).length;
  }
}
