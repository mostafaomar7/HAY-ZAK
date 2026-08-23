import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LanguageService } from '@core/i18n/language.service';
import type { ReferenceListKind, ReferenceListRow } from '@core/models/admin.model';
import { NotificationService } from '@core/services/notification.service';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiModal } from '@shared/components/ui-modal/ui-modal';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';
import { UiTabs } from '@shared/components/ui-tabs/ui-tabs';
import type { TabItem } from '@shared/components/ui-tabs/ui-tabs';
import { AdminContentService } from '../../services/admin-content.service';

/**
 * ADM-10 — the reference lists (FR-ADM-05).
 *
 * These four lists are what every picker in the platform is built from, so the
 * screen is deliberately conservative: an entry can be renamed, reordered or
 * removed, and the `linkedCount` beside each one says how much would break.
 *
 * Reordering is done with move buttons rather than the design's drag handle.
 * Drag-and-drop is unreachable by keyboard and unusable with a screen reader; the
 * buttons do the same job, are announced, and let one keystroke be undone by the
 * opposite one. The whole order is then sent in a single call, so a reorder can
 * never land half-applied.
 */
@Component({
  selector: 'app-admin-reference-lists-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminContentService],
  imports: [UiButton, UiEmptyState, UiModal, UiSkeleton, UiTabs],
  templateUrl: './reference-lists-page.html',
  styleUrl: './reference-lists-page.scss',
})
export class AdminReferenceListsPage {
  private readonly content = inject(AdminContentService);
  private readonly notifications = inject(NotificationService);

  protected readonly i18n = inject(LanguageService);

  protected readonly kind = signal<ReferenceListKind>('categories');
  protected readonly rows = signal<ReferenceListRow[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly failed = signal(false);
  protected readonly submitting = signal(false);

  /** The row being edited; null while adding a new one. */
  protected readonly editing = signal<ReferenceListRow | null>(null);
  protected readonly formOpen = signal(false);
  protected readonly deleting = signal<ReferenceListRow | null>(null);

  protected readonly draftAr = signal('');
  protected readonly draftEn = signal('');

  protected readonly tabs = computed<TabItem<ReferenceListKind>[]>(() => [
    { value: 'categories', label: this.i18n.t('ref.categories') },
    { value: 'cities', label: this.i18n.t('ref.cities') },
    { value: 'districts', label: this.i18n.t('ref.districts') },
    { value: 'prohibitedItems', label: this.i18n.t('ref.prohibitedItems') },
  ]);

  protected readonly listTitle = computed(
    () => this.tabs().find((tab) => tab.value === this.kind())?.label ?? '',
  );

  protected readonly canSave = computed(
    () => this.draftAr().trim().length > 0 && this.draftEn().trim().length > 0,
  );

  /** FR-ADM-05 — an entry other records point at cannot be removed. */
  protected readonly deleteBlocked = computed(() => (this.deleting()?.linkedCount ?? 0) > 0);

  constructor() {
    this.fetch();
  }

  protected setKind(kind: ReferenceListKind): void {
    this.kind.set(kind);
    this.fetch();
  }

  protected fetch(): void {
    this.failed.set(false);
    this.isLoading.set(true);

    this.content.referenceList(this.kind()).subscribe({
      next: (rows) => {
        this.rows.set([...rows].sort((a, b) => a.sortOrder - b.sortOrder));
        this.isLoading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.isLoading.set(false);
      },
    });
  }

  // ── Add and edit ───────────────────────────────────────────────────────
  protected add(): void {
    this.editing.set(null);
    this.draftAr.set('');
    this.draftEn.set('');
    this.formOpen.set(true);
  }

  protected edit(row: ReferenceListRow): void {
    this.editing.set(row);
    this.draftAr.set(row.nameAr);
    this.draftEn.set(row.nameEn);
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.editing.set(null);
  }

  protected save(): void {
    if (!this.canSave()) return;

    const request = { nameAr: this.draftAr().trim(), nameEn: this.draftEn().trim() };
    const row = this.editing();
    const work = row
      ? this.content.updateReferenceItem(this.kind(), row.id, request)
      : this.content.addReferenceItem(this.kind(), request);

    this.submitting.set(true);
    work.subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeForm();
        this.notifications.success(this.i18n.t('ref.saved'));
        this.fetch();
      },
      error: () => {
        this.submitting.set(false);
        this.notifications.error(this.i18n.t('admin.actionFailed'));
      },
    });
  }

  // ── Delete ─────────────────────────────────────────────────────────────
  protected askDelete(row: ReferenceListRow): void {
    this.deleting.set(row);
  }

  protected confirmDelete(): void {
    const row = this.deleting();
    if (!row || this.deleteBlocked()) return;

    this.deleting.set(null);
    this.content.deleteReferenceItem(this.kind(), row.id).subscribe({
      next: () => {
        this.notifications.success(this.i18n.t('ref.saved'));
        this.fetch();
      },
      error: () => this.notifications.error(this.i18n.t('admin.actionFailed')),
    });
  }

  // ── Ordering ───────────────────────────────────────────────────────────
  protected move(index: number, delta: -1 | 1): void {
    const rows = [...this.rows()];
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;

    [rows[index], rows[target]] = [rows[target], rows[index]];
    // Optimistic: the list reorders under the operator's finger, and a failed
    // save refetches the server's order rather than leaving a lie on screen.
    this.rows.set(rows.map((row, position) => ({ ...row, sortOrder: position + 1 })));

    this.content
      .reorderReferenceList(
        this.kind(),
        rows.map((row) => row.id),
      )
      .subscribe({
        next: () => this.notifications.success(this.i18n.t('ref.reordered')),
        error: () => {
          this.notifications.error(this.i18n.t('admin.actionFailed'));
          this.fetch();
        },
      });
  }
}
