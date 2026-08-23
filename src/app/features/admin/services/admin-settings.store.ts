import { Injectable, computed, inject, signal } from '@angular/core';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { FINANCIAL_DEFAULTS } from '@core/constants/app.constants';
import type { PlatformSettings } from '@core/models/operations.model';
import { ApiService } from '@core/services/api.service';

/**
 * The platform configuration, loaded once for the whole console.
 *
 * Five screens need a piece of it — the SLA hours that decide whether a queue
 * row is late, the commission and VAT rates on the reports, the payout cycle on
 * the transfers header, the refund tiers on the settings page. Each fetching its
 * own copy would mean the dashboard could call a booking late while the queue
 * beside it called the same booking on time.
 *
 * Until the first response lands, the compiled-in defaults stand in. They are
 * the same numbers the pricing utilities use, so nothing shows a figure that
 * contradicts one computed elsewhere in the same second.
 */
@Injectable()
export class AdminSettingsStore {
  private readonly api = inject(ApiService);

  private readonly current = signal<PlatformSettings | null>(null);

  readonly settings = this.current.asReadonly();

  readonly commissionRate = computed(
    () => this.current()?.commissionRate ?? FINANCIAL_DEFAULTS.commissionRate,
  );
  readonly vatRate = computed(() => this.current()?.vatRate ?? FINANCIAL_DEFAULTS.vatRate);
  readonly approvalSlaHours = computed(() => this.current()?.approvalSlaHours ?? 24);
  readonly payoutCycleHours = computed(() => this.current()?.payoutCycleHours ?? 168);
  readonly autoApproveBookings = computed(() => this.current()?.autoApproveBookings ?? false);

  /** As a whole percentage, which is how every label prints it. */
  readonly commissionPercent = computed(() => round(this.commissionRate() * 100));
  readonly vatPercent = computed(() => round(this.vatRate() * 100));

  load(): void {
    this.api.get<PlatformSettings>(API_ENDPOINTS.admin.settings).subscribe({
      next: (settings) => this.current.set(settings),
      // Silent: the defaults are already in place, and a toast on every screen
      // load would be noise the operator can do nothing about.
      error: () => undefined,
    });
  }

  /** Called by the settings page after a save, so every screen agrees at once. */
  set(settings: PlatformSettings): void {
    this.current.set(settings);
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
