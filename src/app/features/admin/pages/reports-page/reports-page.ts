import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BookingStatus } from '@core/enums/booking-status.enum';
import { ComplaintStatus } from '@core/enums/complaint.enum';
import { UnitStatus } from '@core/enums/unit-status.enum';
import { AccountStatus, UserRole } from '@core/enums/user-role.enum';
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

  protected readonly unitRows = computed(() => toRows(this.overview()?.units, UNIT_STATUSES));
  protected readonly bookingRows = computed(() =>
    toRows(this.overview()?.bookings, BOOKING_STATUSES),
  );
  protected readonly usersByRole = computed(() =>
    toRows(this.overview()?.users.byRole, ACCOUNT_ROLES),
  );
  protected readonly usersByStatus = computed(() =>
    toRows(this.overview()?.users.byStatus, ACCOUNT_STATUSES),
  );

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
    return toRows(statuses, COMPLAINT_STATUSES);
  });

  protected readonly overdueComplaints = computed(() => this.overview()?.complaints.overdue ?? 0);

  protected readonly payoutBuckets = computed(() => {
    const payouts = this.overview()?.payouts;
    if (!payouts) return [];
    // Spreading a bucket the server omitted used to produce a row with no
    // `count` at all, which rendered as an empty cell rather than as nothing.
    return (['APPROVED', 'PAID', 'FAILED'] as const).map((key) => ({
      key,
      ...(payouts[key] ?? EMPTY_PAYOUT_BUCKET),
    }));
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

const EMPTY_PAYOUT_BUCKET = { count: 0, totalHalalas: 0 };

/**
 * The vocabularies, in the order an operator reads them — lifecycle order, not
 * by value: "الحجوزات" is a sequence, and sorting it by this week's numbers
 * would reshuffle the column every refresh.
 *
 * `GUEST` is left out of the roles because it is not an account — the enum
 * says so itself, it is the client's word for nobody being signed in — and
 * `LOCKED` is left out of the statuses because a lockout is a 423, not a
 * stored state. Neither can ever be counted, and a permanent `0` beside a real
 * figure is a row an operator has to learn to ignore.
 */
const UNIT_STATUSES = Object.values(UnitStatus) as string[];
const BOOKING_STATUSES = Object.values(BookingStatus) as string[];
const COMPLAINT_STATUSES = Object.values(ComplaintStatus) as string[];
const ACCOUNT_ROLES = [UserRole.Renter, UserRole.Lessor, UserRole.Admin] as string[];
const ACCOUNT_STATUSES = [
  AccountStatus.PendingVerification,
  AccountStatus.Active,
  AccountStatus.Suspended,
] as string[];

/**
 * A record of counts as rows: every status in the vocabulary, then anything
 * the server sent that this build does not know about.
 *
 * **The zeros matter.** The aggregate returns only the groups that have rows,
 * so a status nobody is in simply does not come back — and a column that
 * silently drops "٠ شكاوى مفتوحة" reads as a screen that failed to load rather
 * than as a queue that is empty.
 *
 * The unknown keys are appended rather than dropped for the opposite reason:
 * `DELETED` is a real account status this build has no enum for, and hiding
 * a real count is worse than showing an untranslated key.
 */
function toRows(counts: Record<string, number> | undefined, vocabulary: string[]): CountRow[] {
  if (!counts) return [];

  const known = vocabulary.map((key) => ({ key, label: key, value: counts[key] ?? 0 }));
  const extra = Object.entries(counts)
    .filter(([key]) => !vocabulary.includes(key))
    .map(([key, value]) => ({ key, label: key, value }));

  return [...known, ...extra];
}
