import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { numberAttribute } from '@angular/core';
import { LanguageService } from '@core/i18n/language.service';

/**
 * Page controls for any paged list — a table's rows or a grid of cards.
 *
 * Shared rather than owned by the table it started in: a card grid pages the
 * same way a table does, and the second copy of "at most five buttons, centred
 * on the current page" is the one that drifts.
 *
 * It renders nothing when everything fits on one page. A pager that says
 * "1 of 1" is furniture.
 */
@Component({
  selector: 'app-ui-pager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ui-pager.html',
  styleUrl: './ui-pager.scss',
})
export class UiPager {
  protected readonly i18n = inject(LanguageService);

  readonly total = input(0, { transform: numberAttribute });
  readonly page = input(1, { transform: numberAttribute });
  readonly pageSize = input(20, { transform: numberAttribute });
  /**
   * How many rows this page actually rendered.
   *
   * The last page is rarely full, and computing the range from `pageSize` alone
   * would claim rows that are not on screen.
   */
  readonly shown = input(0, { transform: numberAttribute });

  readonly pageChange = output<number>();

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / Math.max(1, this.pageSize()))),
  );

  protected readonly hasPages = computed(() => this.total() > this.pageSize());

  /** At most five page buttons, centred on the current one. */
  protected readonly pages = computed(() => {
    const last = this.totalPages();
    const start = Math.max(1, Math.min(this.page() - 2, last - 4));
    return Array.from({ length: Math.min(5, last) }, (_, index) => start + index);
  });

  protected readonly firstShown = computed(() =>
    this.total() === 0 ? 0 : (this.page() - 1) * this.pageSize() + 1,
  );

  protected readonly lastShown = computed(() =>
    Math.min(this.total(), (this.page() - 1) * this.pageSize() + this.shown()),
  );

  protected go(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.page()) return;
    this.pageChange.emit(page);
  }
}
