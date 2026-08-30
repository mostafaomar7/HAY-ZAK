import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LanguageService } from '@core/i18n/language.service';
import type {
  AdminOverview,
  BookingsReport,
  LessorReportRow,
  RevenueReport,
} from '@core/models/admin-reports';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiMoney } from '@shared/components/ui-money/ui-money';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';
import { AdminReportsService } from '../../services/admin-reports.service';

/** One count under a label, which is what most of this screen is. */
interface CountRow {
  key: string;
  label: string;
  value: number;
}

/**
 * ADM-07 — the reports (FR-RPT), `reports:view`.
 *
 * **The one thing this screen exists to get right is which number is revenue.**
 *
 * `grossHalalas` is what renters paid. The platform does not keep it: most is
 * owed to lessors, some is VAT owed to ZATCA, and only the commission is
 * income. Putting "الإيرادات" above the gross overstates revenue by the value
 * of every booking on the platform — the classic marketplace accounting error,
 * and one that survives all the way into a board pack because the number looks
 * impressive and nobody re-derives it. So the two live in separate sections,
 * each labelled with what it is, and the liabilities are named as liabilities
 * rather than listed beside the income as though they were more of it.
 *
 * The overview has **no date filter**, and there is no control for one. These
 * are counts of what exists now; "42 listings published in March" is not a
 * sentence that means anything, and offering the picker would invite the
 * question.
 *
 * There is no export. The old `?format=xlsx` route is gone rather than left
 * pointing at a 404.
 */
@Component({
  selector: 'app-admin-reports-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminReportsService],
  imports: [UiButton, UiEmptyState, UiMoney, UiSkeleton],
  templateUrl: './reports-page.html',
  styleUrl: './reports-page.scss',
})
export class AdminReportsPage {
  private readonly reports = inject(AdminReportsService);

  protected readonly i18n = inject(LanguageService);

  protected readonly overview = signal<AdminOverview | null>(null);
  protected readonly bookings = signal<BookingsReport | null>(null);
  protected readonly revenue = signal<RevenueReport | null>(null);
  protected readonly lessors = signal<LessorReportRow[]>([]);

  protected readonly isLoading = signal(true);
  protected readonly failed = signal(false);

  /** Both ends optional and independent; a malformed date is a 422, not a shrug. */
  protected readonly from = signal('');
  protected readonly to = signal('');

  protected readonly unitRows = computed(() => toRows(this.overview()?.units));
  protected readonly bookingRows = computed(() => toRows(this.overview()?.bookings));
  protected readonly usersByRole = computed(() => toRows(this.overview()?.users.byRole));
  protected readonly usersByStatus = computed(() => toRows(this.overview()?.users.byStatus));

  /**
   * The complaint counts, with `overdue` pulled out.
   *
   * It sits in the same object as the five statuses and is not one of them —
   * an overdue complaint is also `OPEN` or `IN_PROGRESS` — so listing it in the
   * row would double-count and make the column not add up.
   */
  protected readonly complaintRows = computed(() => {
    const complaints = this.overview()?.complaints;
    if (!complaints) return [];
    const { overdue: _overdue, ...statuses } = complaints;
    return toRows(statuses);
  });

  protected readonly overdueComplaints = computed(() => this.overview()?.complaints.overdue ?? 0);

  protected readonly payoutBuckets = computed(() => {
    const payouts = this.overview()?.payouts;
    if (!payouts) return [];
    return [
      { key: 'APPROVED', ...payouts.APPROVED },
      { key: 'PAID', ...payouts.PAID },
      { key: 'FAILED', ...payouts.FAILED },
    ];
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.failed.set(false);

    // The overview is the screen; the dated half is refreshed on its own.
    this.reports.overview().subscribe({
      next: (overview) => {
        this.overview.set(overview);
        this.isLoading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.isLoading.set(false);
      },
    });

    this.loadRange();
    this.reports.lessors().subscribe({
      next: (page) => this.lessors.set(page.items),
      error: () => this.lessors.set([]),
    });
  }

  protected loadRange(): void {
    const range = { from: this.from() || undefined, to: this.to() || undefined };

    this.reports.bookings(range).subscribe({
      next: (report) => this.bookings.set(report),
      error: () => this.bookings.set(null),
    });

    this.reports.revenue(range).subscribe({
      next: (report) => this.revenue.set(report),
      error: () => this.revenue.set(null),
    });
  }

  protected clearRange(): void {
    this.from.set('');
    this.to.set('');
    this.loadRange();
  }
}

/**
 * A record of counts as rows, in the order the server sent them.
 *
 * Not sorted by value: these are status vocabularies, and an operator reading
 * "الحجوزات" expects them in lifecycle order rather than in whatever order
 * this week's numbers happen to fall.
 */
function toRows(counts: Record<string, number> | undefined): CountRow[] {
  if (!counts) return [];
  return Object.entries(counts).map(([key, value]) => ({ key, label: key, value }));
}
