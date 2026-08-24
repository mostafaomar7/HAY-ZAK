import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import type { AdminDashboardKpis } from '@core/models/operations.model';
import type { ComplaintRow } from '@core/models/admin.model';
import { DisputeStatus } from '@core/enums/operations.enum';
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
      disputes: this.api.list<ComplaintRow>(API_ENDPOINTS.admin.disputes),
    }).subscribe({
      next: ({ kpis, disputes }) => {
        this.listings.set(kpis.pendingListings);
        // Closed complaints are not work; only the open ones belong on a badge.
        this.complaints.set(
          disputes.items.filter((item) => item.status !== DisputeStatus.Closed).length,
        );
      },
      // A failed count is not worth an error toast on every screen; the badges
      // simply stay at zero and the queue pages report their own failure.
      error: () => undefined,
    });
  }
}
