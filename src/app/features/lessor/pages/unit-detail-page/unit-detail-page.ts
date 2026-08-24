import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { APP } from '@core/constants/app.constants';
import { UNIT_STATUS_DISPLAY } from '@core/constants/status-display';
import { AvailabilityBlockReason, UnitStatus } from '@core/enums/unit-status.enum';
import type { Unit, UnitAvailabilityBlock } from '@core/models/unit.model';
import { NotificationService } from '@core/services/notification.service';
import { indicativeMonthlyPrice } from '@core/utils/money.utils';
import { summariseSchedule } from '@core/utils/schedule.utils';
import { LessorUnitsService } from '../../services/lessor-units.service';
import { UiBadge } from '@shared/components/ui-badge/ui-badge';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiMoney } from '@shared/components/ui-money/ui-money';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { UiThumbnail } from '@shared/components/ui-thumbnail/ui-thumbnail';

/**
 * The lessor's view of one of their own units, with its availability calendar.
 *
 * Editing is gated on status: FR-UNT-10 forbids a price change while a live
 * booking exists, and an archived unit is read-only. Those rules are computed
 * here so the template never re-derives them.
 */
@Component({
  selector: 'app-unit-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [LessorUnitsService],
  imports: [DatePipe, RouterLink, UiBadge, UiButton, UiEmptyState, UiMoney, UiNotice, UiThumbnail],
  templateUrl: './unit-detail-page.html',
  styleUrl: './unit-detail-page.scss',
})
export class UnitDetailPage {
  /** FR-UNT-06 — the same grouping the renter sees, on one line. */
  protected visitSummary(unit: Unit): string {
    return summariseSchedule(unit.visitSchedule, 'ar-SA');
  }

  readonly id = input.required<string>();

  private readonly service = inject(LessorUnitsService);
  private readonly notifications = inject(NotificationService);

  protected readonly unit = signal<Unit | null>(null);
  protected readonly blocks = signal<UnitAvailabilityBlock[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly failed = signal(false);

  protected readonly dateFormat = APP.dateDisplayFormat;

  protected readonly status = computed(() => {
    const u = this.unit();
    return u ? UNIT_STATUS_DISPLAY[u.status] : null;
  });

  protected readonly monthlyPrice = computed(() => {
    const u = this.unit();
    return u ? indicativeMonthlyPrice(u.dailyPriceHalalas, APP.monthlyPriceMultiplier) : 0;
  });

  protected readonly canEdit = computed(() => this.unit()?.status !== UnitStatus.Archived);

  /** FR-UNT-10 — the price is frozen while a booking is live against the unit. */
  protected readonly priceLocked = computed(() => this.unit()?.status === UnitStatus.FullyBooked);

  protected readonly canSuspend = computed(() => this.unit()?.status === UnitStatus.Published);

  protected readonly isRejected = computed(() => this.unit()?.status === UnitStatus.Rejected);

  /** Only future or current blocks are worth showing. */
  protected readonly upcomingBlocks = computed(() => {
    const today = new Date().setHours(0, 0, 0, 0);
    return this.blocks()
      .filter((b) => new Date(b.endDate).getTime() >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  });

  /** Partial, so the template's fallback to the raw key is type-meaningful. */
  protected readonly blockReasons: Partial<Record<AvailabilityBlockReason, string>> = {
    [AvailabilityBlockReason.Booking]: 'حجز',
    [AvailabilityBlockReason.ManualBlock]: 'إيقاف يدوي',
    [AvailabilityBlockReason.Suspension]: 'إيقاف من الإدارة',
  };

  constructor() {
    // See request-detail-page: a required input is not readable in the
    // constructor, and the id can change without the component being recreated.
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  protected requestSuspension(): void {
    const u = this.unit();
    if (!u) return;

    this.service.requestSuspension(u.id, 'طلب إيقاف مؤقت من المؤجر').subscribe({
      next: () => this.notifications.success('تم إرسال طلب الإيقاف إلى الإدارة.'),
    });
  }

  protected fetch(): void {
    this.load(this.id());
  }

  private load(id: string): void {
    this.failed.set(false);
    this.isLoading.set(true);

    this.service.byId(id).subscribe({
      next: (unit) => {
        this.unit.set(unit);
        this.isLoading.set(false);
        this.service.availability(unit.id).subscribe({
          next: (blocks) => this.blocks.set(blocks),
          // A missing calendar must not blank the whole page.
          error: () => this.blocks.set([]),
        });
      },
      error: () => {
        this.failed.set(true);
        this.isLoading.set(false);
      },
    });
  }
}
