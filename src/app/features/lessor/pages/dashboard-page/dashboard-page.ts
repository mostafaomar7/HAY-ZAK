import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { LessorDashboard } from '@core/models/operations.model';
import { BookingStatus } from '@core/enums/booking-status.enum';
import { UnitStatus } from '@core/enums/unit-status.enum';
import { RELEASE_RULE_TEXT, statusText } from '@core/constants/status-display';
import { LanguageService } from '@core/i18n/language.service';
import { AuthService } from '@core/services/auth.service';
import { NotificationInboxService } from '@core/services/notification-inbox.service';
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
  private readonly inbox = inject(NotificationInboxService);

  protected readonly i18n = inject(LanguageService);

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

  /**
   * The four figures the lessor opens this screen for.
   *
   * Read straight off the status maps rather than through `?? 0`: the server
   * sends every status key, zero included, so a missing one means its
   * vocabulary changed — and rendering nought would hide that behind a number
   * that looks like an answer.
   *
   * "Archived" is deliberately not among them. It is the largest count on a
   * mature account and the least actionable, and a tile is for something the
   * lessor might do next.
   */
  protected readonly tiles = computed(() => {
    const d = this.data();
    if (!d) return [];

    return [
      { label: 'منشورة', value: d.units[UnitStatus.Published] },
      { label: 'قيد المراجعة', value: d.units[UnitStatus.PendingReview] },
      { label: 'مسودات', value: d.units[UnitStatus.Draft] },
      { label: 'حجوزات مؤكّدة', value: d.bookings[BookingStatus.Confirmed] },
    ];
  });

  /** The three buckets, so the dashboard and the earnings screen agree. */
  protected readonly earnings = computed(() => this.data()?.earnings ?? null);

  /**
   * Why money sits in the pending bucket, in a sentence.
   *
   * Nothing is shown for a rule this build has not heard of: inventing an
   * explanation for a policy the server changed would be worse than leaving
   * the question unanswered, because it would answer it wrongly.
   */
  protected readonly releaseRule = computed(() => {
    const rule = this.data()?.earnings.releaseRule;
    const text = rule ? RELEASE_RULE_TEXT[rule] : undefined;
    return text ? statusText(text, this.i18n.language()) : '';
  });

  /**
   * The inbox's own list, not the dashboard's.
   *
   * `/lessor/dashboard` sends `unreadNotifications` — a number — and the shell
   * has already loaded the rows for the bell. Reading them here means the panel
   * and the dropdown cannot disagree, and costs no second request.
   */
  protected readonly recentNotifications = computed(() => this.inbox.notifications().slice(0, 5));

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
