import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import type { TranslationKey } from '@core/i18n/translations';
import type { StaticPage, StaticPageSlug } from '@core/models/content.model';
import { STATIC_PAGE_SLUGS } from '@core/models/content.model';
import type { ReferenceItem } from '@core/models/unit.model';
import { AuthService } from '@core/services/auth.service';
import { ReferenceDataService } from '@core/services/reference-data.service';
import type { AccordionItem } from '@shared/components/ui-accordion/ui-accordion';
import { UiAccordion } from '@shared/components/ui-accordion/ui-accordion';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiProhibitedList } from '@shared/components/ui-prohibited-list/ui-prohibited-list';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';
import { ContactForm } from '../../components/contact-form/contact-form';
import { ContentService } from '../../services/content.service';

/**
 * All seven static pages (PUB-12, FR-CMS-01) through one template.
 *
 * The design gives them one layout — title, optional version block, side index,
 * body — with four optional blocks that only some pages carry: an FAQ accordion,
 * the refund table, the two journeys, and the contact form. Seven components
 * would have meant seven copies of that shared frame, and a change to the frame
 * landing in six of them.
 *
 * Which blocks appear is decided by the data, not by the slug: a page renders
 * `faqGroups` if the API sends `faqGroups`. Adding an eighth page is then a CMS
 * task, not a release.
 */
@Component({
  selector: 'app-static-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ContactForm,
    UiAccordion,
    UiButton,
    UiEmptyState,
    UiProhibitedList,
    UiSkeleton,
  ],
  templateUrl: './static-page.html',
  styleUrl: './static-page.scss',
})
export class StaticPageComponent {
  private readonly content = inject(ContentService);
  private readonly auth = inject(AuthService);
  private readonly reference = inject(ReferenceDataService);

  protected readonly i18n = inject(LanguageService);

  /** Bound from the `:slug` route parameter. */
  readonly slug = input.required<string>();

  protected readonly page = signal<StaticPage | null>(null);
  protected readonly isLoading = signal(true);
  /**
   * The fetch failed. Distinct from a slug this application has never heard
   * of, and the difference is what the visitor is told: one is "there is no
   * such page", the other is "we could not fetch a page that exists". These
   * were one flag, so every footer link led to "قد تكون أُزيلت أو تغيّر
   * رابطها" whenever the CMS was unreachable — which is a lie about a link
   * the application itself had just drawn.
   */
  protected readonly loadFailed = signal(false);
  protected readonly unknownSlug = signal(false);

  protected readonly isAuthenticated = this.auth.isAuthenticated;

  protected readonly isKnownSlug = computed(() =>
    STATIC_PAGE_SLUGS.includes(this.slug() as StaticPageSlug),
  );

  /** The side index: the numbered sections on a legal page, the groups on the FAQ. */
  protected readonly index = computed(() => {
    const page = this.page();
    if (!page) return [];

    if (page.faqGroups?.length) {
      return page.faqGroups.map((group) => ({ id: group.id, label: group.title }));
    }
    // Untitled sections are skipped rather than listed blank: the terms come
    // from `/auth/terms` as prose with no headings, and an index of empty
    // links is worse than no index — which the template already handles.
    return page.sections
      .filter((section) => !!section.title)
      .map((section) => ({ id: section.id, label: section.title }));
  });

  /** FR-ADM-05 — the prohibited list is reference data, never template text. */
  private readonly prohibited = signal<ReferenceItem[]>([]);

  protected readonly prohibitedLabels = computed(() =>
    this.prohibited().map((item) => this.i18n.pick(item)),
  );

  protected readonly related = computed(() =>
    STATIC_PAGE_SLUGS.filter((slug) => slug !== this.slug()).slice(0, 5),
  );

  constructor() {
    this.reference.prohibitedItems().subscribe({
      next: (items) => this.prohibited.set(items),
      error: () => this.prohibited.set([]),
    });

    // Re-fetches when the slug changes, which happens on every footer link —
    // the router reuses this component rather than recreating it.
    effect(() => {
      const slug = this.slug();
      if (!STATIC_PAGE_SLUGS.includes(slug as StaticPageSlug)) {
        this.unknownSlug.set(true);
        this.isLoading.set(false);
        return;
      }
      this.load(slug as StaticPageSlug);
    });
  }

  protected faqItems(groupId: string): AccordionItem[] {
    const group = this.page()?.faqGroups?.find((item) => item.id === groupId);
    return (group?.items ?? []).map((item) => ({
      id: item.id,
      question: item.question,
      answer: item.answer,
    }));
  }

  protected relatedLabel(slug: StaticPageSlug): string {
    return this.i18n.t(RELATED_LABELS[slug]);
  }

  /** Re-runs the fetch after a failure — the retry button on the error state. */
  protected reload(): void {
    if (this.unknownSlug()) return;
    this.load(this.slug() as StaticPageSlug);
  }

  private load(slug: StaticPageSlug): void {
    this.isLoading.set(true);
    this.loadFailed.set(false);
    this.unknownSlug.set(false);

    this.content.page(slug).subscribe({
      next: (page) => {
        this.page.set(page);
        this.isLoading.set(false);
      },
      error: () => {
        this.loadFailed.set(true);
        this.isLoading.set(false);
      },
    });
  }
}

/**
 * Link titles for the "related pages" rail and the footer.
 *
 * From the dictionary rather than from the CMS: the rail links to pages that
 * have not been loaded, and fetching seven documents to render seven link
 * labels would be an absurd trade. Each page still owns its own heading.
 */
const RELATED_LABELS: Record<StaticPageSlug, TranslationKey> = {
  about: 'pages.about',
  'how-it-works': 'pages.howItWorks',
  faq: 'pages.faq',
  terms: 'pages.terms',
  privacy: 'pages.privacy',
  'refund-policy': 'pages.refundPolicy',
  contact: 'pages.contact',
};
