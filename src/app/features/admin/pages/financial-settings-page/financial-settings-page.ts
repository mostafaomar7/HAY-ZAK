import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LanguageService } from '@core/i18n/language.service';
import { ApiError } from '@core/models/api-error.model';
import type { PlatformSetting, SettingGroup } from '@core/models/platform-setting';
import { settingWritePermission } from '@core/models/platform-setting';
import { NotificationService } from '@core/services/notification.service';
import { PermissionService } from '@core/services/permission.service';
import { UiBadge } from '@shared/components/ui-badge/ui-badge';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';
import type { TabItem } from '@shared/components/ui-tabs/ui-tabs';
import { UiTabs } from '@shared/components/ui-tabs/ui-tabs';
import { AdminSettingsService } from '../../services/admin-settings.service';
import { AdminSettingsStore } from '../../services/admin-settings.store';

const GROUPS: readonly SettingGroup[] = [
  'general',
  'financial',
  'booking',
  'operations',
  'content',
];

/**
 * ADM-10 — the platform settings (FR-ADM-06).
 *
 * **Reading is open to any administrator; writing depends on the row.** A
 * `financial` setting needs `settings:financial`, which the finance officer
 * holds; everything else needs `settings:manage`, which only the system
 * administrator holds. Neither contains the other, so the finance officer sees
 * the whole screen and can change exactly one tab of it — and the system
 * administrator sees the same screen and can change the other four.
 *
 * The rule is read off each row rather than from the tab, because the group is
 * a property of the setting: a new group arriving from the server must not
 * quietly become editable by whoever happens to be looking.
 *
 * **The value is a string in both directions.** `dataType` decides which input
 * to draw; the text goes back untouched and the server does the parsing and
 * the refusing. Converting here would mean converting back on the way in — two
 * conversions to end up where the field started, and one more place for a
 * boolean to become the string "false" and then be truthy.
 */
@Component({
  selector: 'app-admin-financial-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiBadge, UiButton, UiEmptyState, UiNotice, UiSkeleton, UiTabs],
  templateUrl: './financial-settings-page.html',
  styleUrl: './financial-settings-page.scss',
})
export class AdminFinancialSettingsPage {
  private readonly settingsApi = inject(AdminSettingsService);
  private readonly store = inject(AdminSettingsStore);
  private readonly permissions = inject(PermissionService);
  private readonly notifications = inject(NotificationService);

  protected readonly i18n = inject(LanguageService);

  protected readonly rows = signal<PlatformSetting[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly failed = signal(false);
  protected readonly savingKey = signal('');
  protected readonly group = signal<SettingGroup>('financial');

  /** What is currently typed, by key. Empty until a field is touched. */
  protected readonly drafts = signal<Record<string, string>>({});

  protected readonly tabs = computed<TabItem<SettingGroup>[]>(() =>
    GROUPS.map((group) => ({ value: group, label: this.groupLabel(group) })),
  );

  protected readonly visible = computed(() =>
    this.rows().filter((row) => row.group === this.group()),
  );

  /** True when this administrator may write to the group currently shown. */
  protected readonly canWriteGroup = computed(() => {
    const first = this.visible()[0];
    return first ? this.permissions.can(settingWritePermission(first)) : false;
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.failed.set(false);

    // Every group in one call: the tabs are a way of arranging what is already
    // here, and refetching per tab would let two of them disagree.
    this.settingsApi.list().subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.isLoading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.isLoading.set(false);
      },
    });
  }

  protected setGroup(group: SettingGroup): void {
    this.group.set(group);
  }

  protected valueOf(row: PlatformSetting): string {
    return this.drafts()[row.key] ?? row.value;
  }

  protected setValue(row: PlatformSetting, value: string): void {
    this.drafts.update((current) => ({ ...current, [row.key]: value }));
  }

  protected isDirty(row: PlatformSetting): boolean {
    const draft = this.drafts()[row.key];
    return draft !== undefined && draft !== row.value;
  }

  /**
   * Whether this particular row may be edited.
   *
   * Two independent reasons it may not: the server marked it read-only, or
   * this administrator does not hold the permission its group requires.
   */
  protected canEdit(row: PlatformSetting): boolean {
    return row.isEditable && this.permissions.can(settingWritePermission(row));
  }

  protected save(row: PlatformSetting): void {
    if (!this.canEdit(row) || !this.isDirty(row)) return;

    this.savingKey.set(row.key);
    // The text as typed. The server owns the parsing and answers 422 if it
    // will not convert to the row's dataType.
    this.settingsApi.update(row.key, this.valueOf(row)).subscribe({
      next: (saved) => {
        this.savingKey.set('');
        this.rows.update((rows) => rows.map((r) => (r.key === saved.key ? saved : r)));
        this.drafts.update((current) => {
          const { [saved.key]: _dropped, ...rest } = current;
          return rest;
        });
        // So the reports and the queue headers agree with this screen at once.
        this.store.apply(saved);
        this.notifications.success(this.i18n.t('settings.savedOne'));
      },
      error: (failure: unknown) => {
        this.savingKey.set('');
        this.notifications.error(
          failure instanceof ApiError
            ? failure.details[0]?.message || failure.message
            : this.i18n.t('admin.actionFailed'),
        );
      },
    });
  }

  protected label(row: PlatformSetting): string {
    return this.i18n.language() === 'en' ? row.labelEn : row.labelAr;
  }

  /** Written for the administrator, so it is shown rather than summarised. */
  protected hint(row: PlatformSetting): string {
    return (this.i18n.language() === 'en' ? row.hintEn : row.hintAr) ?? '';
  }

  protected groupLabel(group: SettingGroup): string {
    switch (group) {
      case 'financial':
        return this.i18n.t('settings.groupFinancial');
      case 'booking':
        return this.i18n.t('settings.groupBooking');
      case 'operations':
        return this.i18n.t('settings.groupOperations');
      case 'content':
        return this.i18n.t('settings.groupContent');
      default:
        return this.i18n.t('settings.groupGeneral');
    }
  }
}
