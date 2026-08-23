import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { LessorDashboard } from '@core/models/operations.model';
import { AuthService } from '@core/services/auth.service';
import { LessorAccountService } from '../../services/lessor-account.service';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiStatTile } from '@shared/components/ui-stat-tile/ui-stat-tile';

type Blocker = 'mobile' | 'bank' | null;

/**
 * LSR-01 — "لوحة التحكم" (FR-LSR-01).
 *
 * The onboarding panel is the important part. FR-LSR-03 blocks the first listing
 * until the mobile is verified and bank details are complete, and SRS §2.2 warns
 * this user class abandons easily — so the dashboard names the one thing standing
 * in the way instead of showing a disabled button with no explanation.
 */
@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiButton, UiEmptyState, UiStatTile],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage {
  private readonly account = inject(LessorAccountService);
  private readonly auth = inject(AuthService);

  protected readonly data = signal<LessorDashboard | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly failed = signal(false);
  protected readonly hasBankAccount = signal(false);

  protected readonly user = this.auth.user;
  protected readonly mobileVerified = this.auth.isMobileVerified;

  /** The single next action, or null once the lessor is fully set up. */
  protected readonly blocker = computed<Blocker>(() => {
    if (!this.mobileVerified()) return 'mobile';
    if (!this.hasBankAccount()) return 'bank';
    return null;
  });

  protected readonly tiles = computed(() => {
    const d = this.data();
    if (!d) return [];
    return [
      { label: 'إجمالي وحداتي', value: d.totalUnits },
      { label: 'الوحدات المتاحة', value: d.availableUnits },
      { label: 'الوحدات المحجوزة', value: d.bookedUnits },
      { label: 'الحجوزات النشطة', value: d.activeBookings },
    ];
  });

  constructor() {
    this.fetch();
  }

  protected fetch(): void {
    this.failed.set(false);
    this.isLoading.set(true);

    this.account.dashboard().subscribe({
      next: (data) => {
        this.data.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.isLoading.set(false);
      },
    });

    // A missing bank account is an expected state, not an error, so its failure
    // must not blank the dashboard.
    this.account.bankAccounts().subscribe({
      next: (accounts) => this.hasBankAccount.set(accounts.length > 0),
      error: () => this.hasBankAccount.set(false),
    });
  }
}
