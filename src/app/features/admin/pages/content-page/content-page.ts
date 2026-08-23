import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LanguageService } from '@core/i18n/language.service';
import type { CmsPageDetail } from '@core/models/admin.model';
import { NotificationService } from '@core/services/notification.service';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';
import { AdminContentService } from '../../services/admin-content.service';

const SEO_TITLE_LIMIT = 60;
const SEO_DESCRIPTION_LIMIT = 160;

/**
 * ADM-11 — the static pages (FR-CMS-01).
 *
 * The seven pages the marketplace publishes, edited as plain text with their SEO
 * fields beside them. Deliberately not a rich-text editor: the public pages
 * render from a known set of blocks, and letting an operator paste arbitrary
 * markup here is how a stored-XSS ends up on the home page.
 *
 * "معاينة الصفحة" opens the live page in a new tab rather than rendering a
 * preview here — the only honest preview is the real template.
 */
@Component({
  selector: 'app-admin-content-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminContentService],
  imports: [UiButton, UiEmptyState, UiSkeleton],
  templateUrl: './content-page.html',
  styleUrl: './content-page.scss',
})
export class AdminContentPage {
  private readonly content = inject(AdminContentService);
  private readonly notifications = inject(NotificationService);

  protected readonly i18n = inject(LanguageService);

  protected readonly pages = signal<CmsPageDetail[]>([]);
  protected readonly slug = signal('');
  protected readonly isLoading = signal(true);
  protected readonly failed = signal(false);
  protected readonly saving = signal(false);

  protected readonly titleAr = signal('');
  protected readonly body = signal('');
  protected readonly seoTitle = signal('');
  protected readonly seoDescription = signal('');

  protected readonly seoTitleLimit = SEO_TITLE_LIMIT;
  protected readonly seoDescriptionLimit = SEO_DESCRIPTION_LIMIT;

  protected readonly current = computed(() =>
    this.pages().find((page) => page.slug === this.slug()),
  );

  protected readonly titleTooLong = computed(() => this.seoTitle().length > SEO_TITLE_LIMIT);
  protected readonly descriptionTooLong = computed(
    () => this.seoDescription().length > SEO_DESCRIPTION_LIMIT,
  );

  constructor() {
    this.fetch();
  }

  protected fetch(): void {
    this.failed.set(false);
    this.isLoading.set(true);

    this.content.cmsPages().subscribe({
      next: (pages) => {
        this.pages.set(pages);
        this.isLoading.set(false);
        if (pages.length > 0) this.select(pages[0].slug);
      },
      error: () => {
        this.failed.set(true);
        this.isLoading.set(false);
      },
    });
  }

  protected select(slug: string): void {
    this.slug.set(slug);
    const page = this.current();
    if (!page) return;

    this.titleAr.set(page.titleAr);
    this.body.set(page.bodyAr);
    this.seoTitle.set(page.seoTitle);
    this.seoDescription.set(page.seoDescription);
  }

  protected save(): void {
    const page = this.current();
    if (!page) return;

    this.saving.set(true);
    this.content
      .saveCmsPage(page.slug, {
        titleAr: this.titleAr().trim(),
        bodyAr: this.body(),
        seoTitle: this.seoTitle().trim(),
        seoDescription: this.seoDescription().trim(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.notifications.success(this.i18n.t('cms.saved'));
        },
        error: () => {
          this.saving.set(false);
          this.notifications.error(this.i18n.t('admin.actionFailed'));
        },
      });
  }

  /** The public route the page is published at. */
  protected previewUrl(): string {
    return `/pages/${this.slug()}`;
  }
}
