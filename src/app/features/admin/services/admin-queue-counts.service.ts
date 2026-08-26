import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import type { AdminDashboardKpis } from '@core/models/operations.model';
import type { WireComplaint } from '@core/models/complaint';
import { SETTLED_COMPLAINT_STATUSES } from '@core/enums/complaint.enum';
import { ApiService } from '@core/services/api.service';

/**
 * How much work is waiting, for the sidebar badges.
 *
 * Fetched once by the shell rather than by each queue page. Two places counting
 * the same queue is how a badge ends up saying 12 while the table under it shows
 * 8 — and the badge is the number an operator plans their day around.
 */
@Injectable()
export class AdminQueueCountsService {
  private readonly api = inject(ApiService);

  private readonly listings = signal(0);
  private readonly complaints = signal(0);

  readonly counts = computed(() => ({
    listings: this.listings(),
    complaints: this.complaints(),
  }));

  refresh(): void {
    forkJoin({
      kpis: this.api.get<AdminDashboardKpis>(API_ENDPOINTS.admin.dashboard),
      complaints: this.api.list<WireComplaint>(API_ENDPOINTS.admin.complaints),
    }).subscribe({
      next: ({ kpis, complaints }) => {
        this.listings.set(kpis.pendingListings);
        // Settled complaints are not work; only the live ones belong on a
        // badge. Both terminal states count as settled — a duplicate that was
        // closed without a decision is no more outstanding than a resolved one.
        this.complaints.set(
          complaints.items.filter((item) => !SETTLED_COMPLAINT_STATUSES.includes(item.status))
            .length,
        );
      },
      // A failed count is not worth an error toast on every screen; the badges
      // simply stay at zero and the queue pages report their own failure.
      error: () => undefined,
    });
  }
}
