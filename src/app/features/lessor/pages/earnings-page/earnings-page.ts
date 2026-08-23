import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { APP } from '@core/constants/app.constants';
import { PAYOUT_STATUS_DISPLAY, statusText } from '@core/constants/status-display';
import { LanguageService } from '@core/i18n/language.service';
import type { TranslationKey } from '@core/i18n/translations';
import { PayoutStatus } from '@core/enums/payment.enum';
import { NotificationService } from '@core/services/notification.service';
import { LessorAccountService } from '../../services/lessor-account.service';
import type { EarningsRow } from '@core/models/earnings.model';
import { UiBadge } from '@shared/components/ui-badge/ui-badge';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiMoney } from '@shared/components/ui-money/ui-money';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';
import { UiStatTile } from '@shared/components/ui-stat-tile/ui-stat-tile';

/** Period options in the design's first filter. */
type Period = 'last3' | 'month' | 'year';

/**
 * LSR-07 — "المستحقات".
 *
 * The table is a CSS grid rather than a `<table>` element so the same markup can
 * reflow into stacked cards on a phone, which a real table cannot do. It keeps
 * table semantics via explicit ARIA roles, so it still reads as a table.
 */
@Component({
  selector: 'app-earnings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, UiBadge, UiButton, UiEmptyState, UiMoney, UiSkeleton, UiStatTile],
  templateUrl: './earnings-page.html',
  styleUrl: './earnings-page.scss',
})
export class EarningsPage {
  private readonly account = inject(LessorAccountService);
  private readonly notifications = inject(NotificationService);

  protected readonly i18n = inject(LanguageService);

  protected readonly rows = signal<EarningsRow[]>([]);
  protected readonly totalEarnings = signal(0);
  protected readonly isLoading = signal(true);
  protected readonly failed = signal(false);

  protected readonly period = signal<Period>('last3');
  protected readonly unitFilter = signal('');

  protected readonly dateFormat = APP.dateDisplayFormat;

  protected readonly periods: readonly { value: Period; labelKey: TranslationKey }[] = [
    { value: 'last3', labelKey: 'earnings.last3' },
    { value: 'month', labelKey: 'earnings.thisMonth' },
    { value: 'year', labelKey: 'earnings.thisYear' },
  ];

  /** Distinct unit titles from the loaded rows — no extra request needed. */
  protected readonly unitOptions = computed(() => [
    ...new Set(this.rows().map((r) => r.unitTitle)),
  ]);

  protected readonly visibleRows = computed(() => {
    const unit = this.unitFilter();
    return unit ? this.rows().filter((r) => r.unitTitle === unit) : this.rows();
  });

  constructor() {
    this.fetch();
  }

  protected statusOf(row: EarningsRow) {
    return PAYOUT_STATUS_DISPLAY[row.payoutStatus];
  }

  protected statusLabel(row: EarningsRow): string {
    return statusText(PAYOUT_STATUS_DISPLAY[row.payoutStatus], this.i18n.language());
  }

  /** UC-04 — a frozen payout must explain itself and offer the way out. */
  protected isOnHold(row: EarningsRow): boolean {
    return row.payoutStatus === PayoutStatus.OnHold;
  }

  protected isProcessing(row: EarningsRow): boolean {
    return row.payoutStatus === PayoutStatus.Processing;
  }

  protected onPeriod(value: string): void {
    this.period.set(value as Period);
    this.fetch();
  }

  protected onUnit(value: string): void {
    this.unitFilter.set(value);
  }

  protected downloadStatement(): void {
    const { from, to } = periodRange(this.period());
    this.account.downloadStatement(from, to).subscribe({
      next: (blob) => this.account.saveStatement(blob, from, to),
      error: () => this.notifications.error(this.i18n.t('earnings.exportFailed')),
    });
  }

  protected fetch(): void {
    this.failed.set(false);
    this.isLoading.set(true);

    const { from, to } = periodRange(this.period());
    this.account.earningsTable(from, to).subscribe({
      next: (response) => {
        this.rows.set(response.rows);
        this.totalEarnings.set(response.summary.totalEarnings);
        this.isLoading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.isLoading.set(false);
      },
    });
  }
}

/** Local, so the page owns its own date maths rather than the service. */
function periodRange(period: Period): { from: string; to: string } {
  const now = new Date();
  const to = iso(now);

  switch (period) {
    case 'month':
      return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to };
    case 'year':
      return { from: iso(new Date(now.getFullYear(), 0, 1)), to };
    default:
      return { from: iso(new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())), to };
  }
}

function iso(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}
