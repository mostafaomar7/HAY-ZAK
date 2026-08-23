import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LanguageService } from '@core/i18n/language.service';
import type { CommissionException } from '@core/models/admin.model';
import type { PlatformSettings } from '@core/models/operations.model';
import { NotificationService } from '@core/services/notification.service';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiModal } from '@shared/components/ui-modal/ui-modal';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';
import { UiToggle } from '@shared/components/ui-toggle/ui-toggle';
import { AdminFinanceService } from '../../services/admin-finance.service';
import { AdminSettingsStore } from '../../services/admin-settings.store';

/** Which setting the confirmation dialog is holding. */
type Field = 'commission' | 'vat' | 'cycle' | 'autoApprove' | 'exception' | null;

/**
 * ADM-08 — the financial configuration (FR-ADM-06, FR-ADM-12).
 *
 * Every change on this screen goes through the same confirmation showing the old
 * value beside the new one, and nothing is written until it is confirmed. That is
 * the design's rule and it is the right one: a mistyped commission rate silently
 * saved would mis-price every booking taken until somebody noticed.
 *
 * The auto-approval switch is included from day one (SRS §2.1) and is the only
 * control here that changes an operational flow rather than a number — turning it
 * on stops the booking queue receiving work at all, so its confirmation says so.
 */
@Component({
  selector: 'app-admin-financial-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminFinanceService],
  imports: [UiButton, UiEmptyState, UiModal, UiNotice, UiSkeleton, UiToggle],
  templateUrl: './financial-settings-page.html',
  styleUrl: './financial-settings-page.scss',
})
export class AdminFinancialSettingsPage {
  private readonly finance = inject(AdminFinanceService);
  private readonly notifications = inject(NotificationService);

  protected readonly i18n = inject(LanguageService);
  protected readonly store = inject(AdminSettingsStore);

  protected readonly settings = signal<PlatformSettings | null>(null);
  protected readonly exceptions = signal<CommissionException[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly failed = signal(false);
  protected readonly submitting = signal(false);

  protected readonly editing = signal<Field>(null);
  protected readonly draft = signal('');

  /** Only for the new-exception dialog. */
  protected readonly exceptionScope = signal<'unit' | 'lessor'>('unit');
  protected readonly exceptionTarget = signal('');

  protected readonly oldValue = computed(() => {
    const settings = this.settings();
    if (!settings) return '';

    switch (this.editing()) {
      case 'commission':
        return `${percent(settings.commissionRate)} ${this.i18n.t('admin.percent')}`;
      case 'vat':
        return `${percent(settings.vatRate)} ${this.i18n.t('admin.percent')}`;
      case 'cycle':
        return this.i18n.t('finset.cycleValue', { hours: settings.payoutCycleHours });
      case 'autoApprove':
        return settings.autoApproveBookings
          ? this.i18n.t('finset.autoApproveOn')
          : this.i18n.t('finset.autoApproveOff');
      default:
        return '';
    }
  });

  protected readonly newValue = computed(() => {
    switch (this.editing()) {
      case 'commission':
      case 'vat':
        return `${this.draft()} ${this.i18n.t('admin.percent')}`;
      case 'cycle':
        return this.i18n.t('finset.cycleValue', { hours: this.draft() });
      case 'autoApprove':
        return this.settings()?.autoApproveBookings
          ? this.i18n.t('finset.autoApproveOff')
          : this.i18n.t('finset.autoApproveOn');
      default:
        return this.draft();
    }
  });

  /** The switch is a yes/no, so it has no field to fill in — only a confirmation. */
  protected readonly isSwitch = computed(() => this.editing() === 'autoApprove');

  protected readonly canSave = computed(() => {
    if (this.isSwitch()) return true;
    const value = Number(this.draft());
    return Number.isFinite(value) && value >= 0;
  });

  constructor() {
    this.fetch();
  }

  protected fetch(): void {
    this.failed.set(false);
    this.isLoading.set(true);

    this.finance.settings().subscribe({
      next: (settings) => {
        this.settings.set(settings);
        this.store.set(settings);
        this.isLoading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.isLoading.set(false);
      },
    });

    this.finance.exceptions().subscribe({
      next: (rows) => this.exceptions.set(rows),
      error: () => this.exceptions.set([]),
    });
  }

  // ── Opening the confirmation ───────────────────────────────────────────
  protected edit(field: Exclude<Field, null>): void {
    const settings = this.settings();
    if (!settings) return;

    this.editing.set(field);
    switch (field) {
      case 'commission':
        this.draft.set(String(percent(settings.commissionRate)));
        break;
      case 'vat':
        this.draft.set(String(percent(settings.vatRate)));
        break;
      case 'cycle':
        this.draft.set(String(settings.payoutCycleHours));
        break;
      default:
        this.draft.set('');
    }
  }

  protected addException(): void {
    this.editing.set('exception');
    this.draft.set('');
    this.exceptionScope.set('unit');
    this.exceptionTarget.set('');
  }

  protected close(): void {
    this.editing.set(null);
    this.draft.set('');
  }

  // ── Saving ─────────────────────────────────────────────────────────────
  protected save(): void {
    const settings = this.settings();
    const field = this.editing();
    if (!settings || !field) return;

    if (field === 'exception') {
      this.saveException();
      return;
    }

    const value = Number(this.draft());
    const patch: Partial<PlatformSettings> =
      field === 'commission'
        ? { commissionRate: value / 100 }
        : field === 'vat'
          ? { vatRate: value / 100 }
          : field === 'cycle'
            ? { payoutCycleHours: value }
            : { autoApproveBookings: !settings.autoApproveBookings };

    this.submitting.set(true);
    this.finance.saveSettings(patch).subscribe({
      next: (saved) => {
        this.settings.set(saved);
        this.store.set(saved);
        this.done();
      },
      error: () => this.fail(),
    });
  }

  protected removeException(row: CommissionException): void {
    this.finance.removeException(row.id).subscribe({
      next: () => {
        this.exceptions.update((rows) => rows.filter((item) => item.id !== row.id));
        this.notifications.success(this.i18n.t('admin.saved'));
      },
      error: () => this.notifications.error(this.i18n.t('admin.actionFailed')),
    });
  }

  protected percentOf(rate: number): number {
    return percent(rate);
  }

  private saveException(): void {
    const rate = Number(this.draft());
    if (!Number.isFinite(rate)) return;

    this.submitting.set(true);
    this.finance
      .addException({
        scope: this.exceptionScope(),
        targetId: this.exceptionTarget(),
        rate: rate / 100,
      })
      .subscribe({
        next: (row) => {
          this.exceptions.update((rows) => [...rows, row]);
          this.done();
        },
        error: () => this.fail(),
      });
  }

  private done(): void {
    this.submitting.set(false);
    this.close();
    this.notifications.success(this.i18n.t('admin.saved'));
  }

  private fail(): void {
    this.submitting.set(false);
    this.notifications.error(this.i18n.t('admin.actionFailed'));
  }
}

/** Rates are stored as fractions and shown as whole percentages. */
function percent(rate: number): number {
  return Math.round(rate * 10_000) / 100;
}
