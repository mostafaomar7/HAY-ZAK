import { Injectable, computed, inject, signal } from '@angular/core';
import { ComplaintStatus, SETTLED_COMPLAINT_STATUSES } from '@core/enums/complaint.enum';
import { UnitStatus } from '@core/enums/unit-status.enum';
import { AdminReportsService } from './admin-reports.service';

/**
 * How much work is waiting, for the sidebar badges.
 *
 * Fetched once by the shell rather than by each queue page. Two places counting
 * the same queue is how a badge ends up saying 12 while the table under it shows
 * 8 — and the badge is the number an operator plans their day around.
 *
 * **One request, not two.** This used to call `/admin/dashboard` for the
 * listings and page through `/admin/complaints` for the rest; the first has
 * never existed and answered 404, so the listings badge was permanently zero
 * and an operator was never told a review was waiting. Both counts are in
 * `/admin/reports/overview`, which is shipped — and taking them from one
 * response means the two numbers cannot be read from different moments.
 *
 * Counting complaints by paging the queue was also wrong beyond the extra
 * request: it counted the rows on the first page, so a badge for a queue of
 * eighty said twenty.
 */
@Injectable()
export class AdminQueueCountsService {
  private readonly reports = inject(AdminReportsService);

  private readonly listings = signal(0);
  private readonly complaints = signal(0);

  readonly counts = computed(() => ({
    listings: this.listings(),
    complaints: this.complaints(),
  }));

  refresh(): void {
    this.reports.overview().subscribe({
      next: (overview) => {
        this.listings.set(overview.units[UnitStatus.PendingReview] ?? 0);
        // Settled complaints are not work; only the live ones belong on a
        // badge. Both terminal states count as settled — a duplicate that was
        // closed without a decision is no more outstanding than a resolved one.
        this.complaints.set(
          Object.values(ComplaintStatus)
            .filter((status) => !SETTLED_COMPLAINT_STATUSES.includes(status))
            .reduce((total, status) => total + (overview.complaints[status] ?? 0), 0),
        );
      },
      // A failed count is not worth an error toast on every screen; the badges
      // simply stay at zero and the queue pages report their own failure.
      error: () => undefined,
    });
  }
}
