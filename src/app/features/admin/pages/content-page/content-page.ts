import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LanguageService } from '@core/i18n/language.service';
import { ApiError } from '@core/models/api-error.model';
import type { CmsPage } from '@core/models/cms-page';
import { CMS_SLUG_PATTERN } from '@core/models/cms-page';
import { NotificationService } from '@core/services/notification.service';
import { UiBadge } from '@shared/components/ui-badge/ui-badge';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';
import { AdminCmsService } from '../../services/admin-cms.service';

const SEO_TITLE_LIMIT = 60;
const SEO_DESCRIPTION_LIMIT = 160;

/**
 * ADM-12 — the editable pages (FR-CMS-01), `cms:manage`.
 *
 * These are the links in the header and the footer of every screen, so this is
 * where "الشروط والأحكام" and "كيف تعمل المنصة" are actually written. Until a
 * page is published here the application serves its bundled copy, and the
 * published version takes over the moment one exists.
 *
 * **Publishing is separate from saving**, because the endpoint makes it
 * separate: `{ isPublished: true }` is the whole request. Two people with the
 * editor open would otherwise have one of them publish a stale draft over the
 * other's correction — resending the body to flip a flag is how that happens.
 *
 * "معاينة الصفحة" opens the live route in a new tab rather than rendering a
 * preview here: the only honest preview is the real template.
 */
@Component({
  selector: 'app-admin-content-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminCmsService],
  imports: [UiBadge, UiButton, UiEmptyState, UiSkeleton],
  templateUrl: './content-page.html',
  styleUrl: './content-page.scss',
})
export class AdminContentPage {
  private readonly cms = inject(AdminCmsService);
  private readonly notifications = inject(NotificationService);

  protected readonly i18n = inject(LanguageService);

  protected readonly pages = signal<CmsPage[]>([]);
  protected readonly selectedId = signal('');
  protected readonly isLoading = signal(true);
  protected readonly failed = signal(false);
  protected readonly saving = signal(false);

  protected readonly titleAr = signal('');
  protected readonly titleEn = signal('');
  protected readonly bodyAr = signal('');
  protected readonly bodyEn = signal('');
  protected readonly metaTitleAr = signal('');
  protected readonly metaDescriptionAr = signal('');

  protected readonly seoTitleLimit = SEO_TITLE_LIMIT;
  protected readonly seoDescriptionLimit = SEO_DESCRIPTION_LIMIT;

  protected readonly current = computed(() =>
    this.pages().find((page) => page.id === this.selectedId()),
  );

  protected readonly titleTooLong = computed(() => this.metaTitleAr().length > SEO_TITLE_LIMIT);
  protected readonly descriptionTooLong = computed(
    () => this.metaDescriptionAr().length > SEO_DESCRIPTION_LIMIT,
  );

  constructor() {
    this.fetch();
  }

  protected fetch(): void {
    this.failed.set(false);
    this.isLoading.set(true);

    this.cms.list().subscribe({
      next: (pages) => {
        this.pages.set(pages);
        this.isLoading.set(false);
        if (pages.length > 0) this.select(pages[0].id);
      },
      error: () => {
        this.failed.set(true);
        this.isLoading.set(false);
      },
    });
  }

  protected select(id: string): void {
    this.selectedId.set(id);
    const page = this.current();
    if (!page) return;

    this.titleAr.set(page.titleAr);
    this.titleEn.set(page.titleEn);
    this.bodyAr.set(page.bodyAr);
    this.bodyEn.set(page.bodyEn);
    this.metaTitleAr.set(page.metaTitleAr ?? '');
    this.metaDescriptionAr.set(page.metaDescriptionAr ?? '');
  }

  protected save(): void {
    const page = this.current();
    if (!page) return;

    this.saving.set(true);
    this.cms
      .update(page.id, {
        titleAr: this.titleAr().trim(),
        titleEn: this.titleEn().trim(),
        bodyAr: this.bodyAr(),
        bodyEn: this.bodyEn(),
        metaTitleAr: this.metaTitleAr().trim(),
        metaDescriptionAr: this.metaDescriptionAr().trim(),
      })
      .subscribe({
        next: (saved) => this.afterSave(saved, this.i18n.t('cms.pageSaved')),
        error: (failure: unknown) => this.failedSave(failure),
      });
  }

  /**
   * Publishes or unpublishes, and sends nothing else.
   *
   * Deliberately not "save and publish": the body in this editor may be older
   * than the one on the server, and a flag change must not carry it.
   */
  protected togglePublished(): void {
    const page = this.current();
    if (!page) return;

    this.saving.set(true);
    this.cms.setPublished(page.id, !page.isPublished).subscribe({
      next: (saved) => this.afterSave(saved, this.i18n.t('cms.pageSaved')),
      error: (failure: unknown) => this.failedSave(failure),
    });
  }

  /** The public route the page is published at. */
  protected previewUrl(): string {
    return `/pages/${this.current()?.slug ?? ''}`;
  }

  protected isValidSlug(slug: string): boolean {
    return CMS_SLUG_PATTERN.test(slug);
  }

  private afterSave(saved: CmsPage, message: string): void {
    this.saving.set(false);
    this.pages.update((pages) => pages.map((page) => (page.id === saved.id ? saved : page)));
    this.notifications.success(message);
  }

  private failedSave(failure: unknown): void {
    this.saving.set(false);

    if (failure instanceof ApiError && failure.code === 'CMS_SLUG_TAKEN') {
      this.notifications.error(this.i18n.t('cms.slugTaken'));
      return;
    }
    this.notifications.error(
      failure instanceof ApiError ? failure.message : this.i18n.t('admin.actionFailed'),
    );
  }
}
