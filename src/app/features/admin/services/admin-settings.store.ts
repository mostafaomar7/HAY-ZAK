import { Injectable, computed, inject, signal } from '@angular/core';
import { FINANCIAL_DEFAULTS } from '@core/constants/app.constants';
import type { PlatformSetting } from '@core/models/platform-setting';
import { bpsToPercent } from '@core/utils/money.utils';
import { AdminSettingsService } from './admin-settings.service';

/**
 * The handful of settings the rest of the console reads, loaded once.
 *
 * Five screens need a piece of the configuration — the SLA hours that decide
 * whether a queue row is late, the commission and VAT rates on the reports,
 * the payout cycle on the transfers header. Each fetching its own copy would
 * mean the dashboard could call a booking late while the queue beside it
 * called the same booking on time.
 *
 * The endpoint answers with **rows whose values are strings**, so this reads
 * them by key and converts. A row that is missing, or that will not parse,
 * falls back to the compiled-in default rather than to zero: a commission of
 * 0% quietly applied to a report is worse than a stale 5%.
 *
 * Reading the settings needs no particular permission — writing them does, and
 * that lives on `AdminSettingsService` and the settings screen.
 */
@Injectable()
export class AdminSettingsStore {
  private readonly settingsApi = inject(AdminSettingsService);

  private readonly rows = signal<PlatformSetting[]>([]);

  readonly settings = this.rows.asReadonly();

  // The keys as the server actually spells them — read off `/admin/settings`
  // rather than guessed, because a key that does not match falls silently back
  // to the compiled-in default and the screen looks right while being stale.
  readonly commissionRateBps = computed(() =>
    this.number('commission.default_rate_bps', FINANCIAL_DEFAULTS.commissionRateBps),
  );
  readonly vatRateBps = computed(() => this.number('vat.rate_bps', FINANCIAL_DEFAULTS.vatRateBps));
  /** The complaint reply deadline. */
  readonly complaintSlaHours = computed(() => this.number('complaint.sla_hours', 48));
  readonly bookingHoldMinutes = computed(() => this.number('booking.hold_minutes', 15));

  /**
   * The listing-review deadline and the payout cycle.
   *
   * **The server has no key for either yet**, so these are the compiled-in
   * defaults every time — which is why they are named here rather than read
   * inline: three screens flag a row as late on the first, and when a setting
   * does arrive they start honouring it without any of them changing.
   */
  readonly approvalSlaHours = computed(() => this.number('operations.approval_sla_hours', 24));
  readonly payoutCycleHours = computed(() => this.number('payout.cycle_hours', 168));

  /** As a whole percentage, which is how every label prints it. */
  readonly commissionPercent = computed(() => bpsToPercent(this.commissionRateBps()));
  readonly vatPercent = computed(() => bpsToPercent(this.vatRateBps()));

  load(): void {
    this.settingsApi.list().subscribe({
      next: (rows) => this.rows.set(rows),
      // Silent: the defaults are already in place, and a toast on every console
      // screen would be noise the operator can do nothing about.
      error: () => undefined,
    });
  }

  /** Called by the settings page after a save, so every screen agrees at once. */
  apply(updated: PlatformSetting): void {
    this.rows.update((rows) =>
      rows.some((row) => row.key === updated.key)
        ? rows.map((row) => (row.key === updated.key ? updated : row))
        : [...rows, updated],
    );
  }

  /**
   * A number out of the string-valued rows, or the default.
   *
   * Never NaN and never zero-by-accident: an unparseable value means the
   * server sent something this build does not understand, and the compiled-in
   * figure is a better answer than a rate of nothing.
   */
  private number(key: string, fallback: number): number {
    const raw = this.rows().find((row) => row.key === key)?.value;
    const parsed = Number(raw);
    return raw !== undefined && raw !== '' && Number.isFinite(parsed) ? parsed : fallback;
  }
}
