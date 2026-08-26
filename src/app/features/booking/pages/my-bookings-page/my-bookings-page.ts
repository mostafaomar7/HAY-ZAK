import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { ApiError } from '@core/models/api-error.model';
import { AuthService } from '@core/services/auth.service';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';
import type { TabItem } from '@shared/components/ui-tabs/ui-tabs';
import { UiTabs } from '@shared/components/ui-tabs/ui-tabs';
import { BookingCard } from '../../components/booking-card/booking-card';
import type { BookingTab } from '../../services/renter-bookings.service';
import { RenterBookingsService } from '../../services/renter-bookings.service';

/**
 * "حجوزاتي" (RNT-01).
 *
 * Two tabs, split by whether the booking still has a future. The split is
 * derived from the SRS's own list of terminal states rather than asked of the
 * server — see RenterBookingsService.
 */
@Component({
  selector: 'app-my-bookings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [RenterBookingsService],
  imports: [RouterLink, BookingCard, UiButton, UiEmptyState, UiSkeleton, UiTabs],
  templateUrl: './my-bookings-page.html',
  styleUrl: './my-bookings-page.scss',
})
export class MyBookingsPage {
  private readonly service = inject(RenterBookingsService);
  private readonly auth = inject(AuthService);

  protected readonly i18n = inject(LanguageService);

  protected readonly tab = signal<BookingTab>('current');
  protected readonly failed = signal(false);
  /**
   * The endpoint is not built yet, as opposed to a request that went wrong.
   *
   * `/bookings/mine` answers 404 because FR-BKG is not shipped. Showing
   * "تعذّر تحميل الحجوزات" with a retry button invites somebody to press it
   * forever against something that was never going to answer — and reads as a
   * fault in their connection rather than in ours.
   */
  protected readonly notConnected = signal(false);

  protected readonly isLoading = this.service.isLoading;
  protected readonly current = this.service.current;
  protected readonly previous = this.service.previous;

  protected readonly userName = computed(() => this.auth.user()?.fullName ?? '');

  protected readonly tabs = computed<TabItem<BookingTab>[]>(() => [
    { value: 'current', label: this.i18n.t('bookings.tabCurrent'), count: this.current().length },
    {
      value: 'previous',
      label: this.i18n.t('bookings.tabPrevious'),
      count: this.previous().length,
    },
  ]);

  protected readonly visible = computed(() =>
    this.tab() === 'current' ? this.current() : this.previous(),
  );

  constructor() {
    this.fetch();
  }

  protected setTab(tab: BookingTab): void {
    this.tab.set(tab);
  }

  protected fetch(): void {
    this.failed.set(false);
    this.notConnected.set(false);

    this.service.load().subscribe({
      error: (error: unknown) => {
        if (error instanceof ApiError && error.status === 404) {
          this.notConnected.set(true);
          return;
        }
        this.failed.set(true);
      },
    });
  }
}
