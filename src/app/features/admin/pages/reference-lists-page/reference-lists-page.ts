import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LanguageService } from '@core/i18n/language.service';
import { ApiError } from '@core/models/api-error.model';
import type {
  ReferenceCategory,
  ReferenceCity,
  ReferenceData,
  ReferenceDistrict,
  ReferenceEntry,
  ReferenceKind,
  ProhibitedItem,
} from '@core/models/reference-admin';
import { isValidSlug } from '@core/models/reference-admin';
import { NotificationService } from '@core/services/notification.service';
import { UiBadge } from '@shared/components/ui-badge/ui-badge';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';
import type { TabItem } from '@shared/components/ui-tabs/ui-tabs';
import { UiTabs } from '@shared/components/ui-tabs/ui-tabs';
import {
  AdminReferenceService,
  listingsBlockingDeactivation,
} from '../../services/admin-reference.service';

/**
 * ADM-11 — the reference lists (FR-ADM-05), `reference:manage`.
 *
 * **There is no delete on this screen, and there is no delete endpoint.**
 * Entries are turned off. A city, a category or a prohibited item is pointed at
 * by listings and bookings written years ago, and those still have to read
 * correctly — so the strongest thing that can happen to an entry is that it
 * stops being offered.
 *
 * A category with published listings under it will not even do that. The server
 * answers 409 with the count, and the count is what goes on screen: "٣١ إعلان
 * منشور تحت هذا التصنيف" tells an operator what to do next, where "تعذّر
 * التعطيل" tells them only that something went wrong.
 *
 * All four lists arrive in one call, active and inactive together, so the
 * districts on screen always belong to the city list beside them.
 */
@Component({
  selector: 'app-admin-reference-lists-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminReferenceService],
  imports: [UiBadge, UiButton, UiEmptyState, UiNotice, UiSkeleton, UiTabs],
  templateUrl: './reference-lists-page.html',
  styleUrl: './reference-lists-page.scss',
})
export class AdminReferenceListsPage {
  private readonly reference = inject(AdminReferenceService);
  private readonly notifications = inject(NotificationService);

  protected readonly i18n = inject(LanguageService);

  protected readonly data = signal<ReferenceData | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly failed = signal(false);
  protected readonly saving = signal(false);
  protected readonly kind = signal<ReferenceKind>('categories');

  /** The 409's count, kept beside the row it refers to. */
  protected readonly blockedBy = signal<{ id: string; count: number } | null>(null);

  // ── The add form ────────────────────────────────────────────────────────
  protected readonly slug = signal('');
  protected readonly nameAr = signal('');
  protected readonly nameEn = signal('');
  protected readonly cityId = signal('');

  protected readonly tabs = computed<TabItem<ReferenceKind>[]>(() => [
    { value: 'categories', label: this.i18n.t('reference.categories') },
    { value: 'cities', label: this.i18n.t('reference.cities') },
    { value: 'districts', label: this.i18n.t('reference.districts') },
    { value: 'prohibited-items', label: this.i18n.t('reference.prohibitedItems') },
  ]);

  protected readonly rows = computed<ReferenceEntry[]>(() => {
    const data = this.data();
    if (!data) return [];

    switch (this.kind()) {
      case 'categories':
        return data.categories;
      case 'cities':
        return data.cities;
      case 'districts':
        // Flattened out of the cities by the adapter; the wire has no
        // top-level districts key and is not going to have one.
        return data.districts;
      default:
        return data.prohibitedItems;
    }
  });

  protected readonly cities = computed(() => this.data()?.cities ?? []);

  protected readonly needsSlug = computed(() => this.kind() === 'categories');
  protected readonly needsCity = computed(() => this.kind() === 'districts');

  protected readonly slugError = computed(() =>
    this.needsSlug() && this.slug() && !isValidSlug(this.slug())
      ? this.i18n.t('reference.slugInvalid')
      : '',
  );

  protected readonly canAdd = computed(() => {
    if (!this.nameAr().trim() || !this.nameEn().trim() || this.saving()) return false;
    if (this.needsSlug() && !isValidSlug(this.slug())) return false;
    if (this.needsCity() && !this.cityId()) return false;
    return true;
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.failed.set(false);

    this.reference.all().subscribe({
      next: (data) => {
        this.data.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.isLoading.set(false);
      },
    });
  }

  protected setKind(kind: ReferenceKind): void {
    this.kind.set(kind);
    this.blockedBy.set(null);
    this.clearForm();
  }

  protected add(): void {
    if (!this.canAdd()) return;

    this.saving.set(true);
    const base = { nameAr: this.nameAr().trim(), nameEn: this.nameEn().trim() };
    const payload =
      this.kind() === 'categories'
        ? { ...base, slug: this.slug().trim() }
        : this.kind() === 'districts'
          ? { ...base, cityId: this.cityId() }
          : base;

    this.reference.create(this.kind(), payload as never).subscribe({
      next: () => {
        this.saving.set(false);
        this.clearForm();
        this.notifications.success(this.i18n.t('reference.savedEntry'));
        this.load();
      },
      error: (failure: unknown) => {
        this.saving.set(false);
        this.notifications.error(
          failure instanceof ApiError ? failure.message : this.i18n.t('admin.actionFailed'),
        );
      },
    });
  }

  /**
   * Turns an entry on or off. There is no third option.
   *
   * A refusal is not a failure to report: the server says how many published
   * listings are in the way, and that number is the answer the operator needs.
   */
  protected toggle(row: ReferenceEntry): void {
    this.blockedBy.set(null);
    this.saving.set(true);

    this.reference.setActive(this.kind(), row.id, !row.isActive).subscribe({
      next: () => {
        this.saving.set(false);
        this.load();
      },
      error: (failure: unknown) => {
        this.saving.set(false);
        if (!(failure instanceof ApiError)) {
          this.notifications.error(this.i18n.t('admin.actionFailed'));
          return;
        }

        const blocking = listingsBlockingDeactivation(failure);
        if (blocking !== null) {
          this.blockedBy.set({ id: row.id, count: blocking });
          return;
        }
        this.notifications.error(failure.message);
      },
    });
  }

  protected blockedCount(row: ReferenceEntry): number | null {
    const blocked = this.blockedBy();
    return blocked?.id === row.id ? blocked.count : null;
  }

  protected cityName(row: ReferenceEntry): string {
    const district = row as ReferenceDistrict;
    const city = this.cities().find((c: ReferenceCity) => c.id === district.cityId);
    return city ? this.i18n.pick({ nameAr: city.nameAr, nameEn: city.nameEn }) : '';
  }

  protected slugOf(row: ReferenceEntry): string {
    return (row as ReferenceCategory).slug ?? '';
  }

  protected noteOf(row: ReferenceEntry): string {
    const item = row as ProhibitedItem;
    return (this.i18n.language() === 'en' ? item.noteEn : item.noteAr) ?? '';
  }

  private clearForm(): void {
    this.slug.set('');
    this.nameAr.set('');
    this.nameEn.set('');
    this.cityId.set('');
  }
}
