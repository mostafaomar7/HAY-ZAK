import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UnitStatus } from '@core/enums/unit-status.enum';
import { UNIT_STATUS_DISPLAY } from '@core/constants/status-display';
import { NotificationService } from '@core/services/notification.service';
import { LessorUnitsService, UNIT_SEARCH_MAX_LENGTH } from '../../services/lessor-units.service';
import { UnitCard } from '../../components/unit-card/unit-card';
import type { FilterChip } from '@shared/components/ui-filter-chips/ui-filter-chips';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiFilterChips } from '@shared/components/ui-filter-chips/ui-filter-chips';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiSearchField } from '@shared/components/ui-search-field/ui-search-field';
import { UiPager } from '@shared/components/ui-pager/ui-pager';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';

type UnitFilter = UnitStatus | 'all';

/** LSR-02 — "المساحات المسجّلة". */
@Component({
  selector: 'app-units-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [LessorUnitsService],
  imports: [
    RouterLink,
    UnitCard,
    UiButton,
    UiEmptyState,
    UiFilterChips,
    UiPager,
    UiSearchField,
    UiSkeleton,
  ],
  templateUrl: './units-page.html',
  styleUrl: './units-page.scss',
})
export class UnitsPage {
  private readonly service = inject(LessorUnitsService);
  private readonly notifications = inject(NotificationService);

  protected readonly isLoading = this.service.isLoading;
  protected readonly total = this.service.total;

  protected readonly filter = signal<UnitFilter>('all');
  protected readonly query = signal('');
  protected readonly failed = signal(false);
  protected readonly page = signal(1);
  protected readonly pageSize = this.service.pageSize;

  /** Order matches the design's chip row. */
  protected readonly chips: readonly FilterChip<UnitFilter>[] = [
    { value: 'all', label: 'الكل' },
    { value: UnitStatus.Published, label: UNIT_STATUS_DISPLAY[UnitStatus.Published].ar },
    { value: UnitStatus.PendingReview, label: UNIT_STATUS_DISPLAY[UnitStatus.PendingReview].ar },
    { value: UnitStatus.Draft, label: UNIT_STATUS_DISPLAY[UnitStatus.Draft].ar },
    { value: UnitStatus.Rejected, label: UNIT_STATUS_DISPLAY[UnitStatus.Rejected].ar },
  ];

  /**
   * Whatever the last request came back with.
   *
   * The search is the server's now — `/lessor/units?search=` matches the title
   * and the short description across every page. It used to filter the loaded
   * page here, which searched the twelve rows on screen and not the other
   * hundred and sixty-two, and the pager went on counting all of them.
   */
  protected readonly visibleUnits = this.service.units;

  /** The server's ceiling, so it cannot be typed past. */
  protected readonly searchMaxLength = UNIT_SEARCH_MAX_LENGTH;

  protected readonly isFiltered = computed(() => !!this.query() || this.filter() !== 'all');

  constructor() {
    this.fetch();
  }

  protected onFilter(value: UnitFilter): void {
    this.filter.set(value);
    // Back to the first page: page four of "الكل" is rarely page four of
    // "مرفوضة", and staying there lands the lessor on an empty grid.
    this.page.set(1);
    this.fetch();
  }

  protected onPage(page: number): void {
    this.page.set(page);
    this.fetch();
    // The grid is below the fold once it is full; paging without this leaves
    // the lessor looking at the bottom of a page they have not seen the top of.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected onSearch(term: string): void {
    if (term === this.query()) return;
    this.query.set(term);
    // Page four of "مستودع" is not page four of everything, and staying there
    // lands the lessor on an empty grid.
    this.page.set(1);
    this.fetch();
  }

  protected clearFilters(): void {
    this.query.set('');
    this.filter.set('all');
    this.page.set(1);
    this.fetch();
  }

  protected onSuspend(unitId: string): void {
    this.service.requestSuspension(unitId, 'طلب إيقاف مؤقت من المؤجر').subscribe({
      next: () => {
        this.notifications.success('تم إرسال طلب الإيقاف إلى الإدارة.');
        this.fetch();
      },
    });
  }

  protected fetch(): void {
    this.failed.set(false);
    const status = this.filter() === 'all' ? undefined : (this.filter() as UnitStatus);
    this.service
      .load(status, this.page(), this.query())
      .subscribe({ error: () => this.failed.set(true) });
  }
}
