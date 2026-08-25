import { computed, signal } from '@angular/core';
import type { AdminSort, TableState } from '../components/admin-table/admin-table';
import type { AdminFilterValues } from '../components/admin-filter-bar/admin-filter-bar';

const PAGE_SIZE = 20;

/**
 * The state every table screen in the console keeps: filters, sort, page,
 * selection and which of the four table states to render.
 *
 * A plain class rather than an injectable — each page owns one instance and
 * none of them share it, so DI would only add ceremony. It holds no data of its
 * own: the rows stay on the page, because their type differs on every screen and
 * the moment this class knew about them it would need a generic parameter
 * threaded through six call sites for nothing.
 *
 * `params()` is what the service is called with, so a page never assembles a
 * query object by hand and the six screens cannot drift apart in how they page
 * or sort.
 */
export class AdminListState {
  readonly pageSize = PAGE_SIZE;

  readonly filters = signal<AdminFilterValues>({});
  readonly sort = signal<AdminSort | null>(null);
  readonly page = signal(1);
  readonly selected = signal<readonly string[]>([]);
  readonly total = signal(0);

  private readonly loading = signal(true);
  private readonly failed = signal(false);
  private readonly empty = signal(false);

  /**
   * Loading wins over failure and failure over emptiness: a table that has just
   * been asked to reload must not flash "no results" from the previous attempt.
   */
  readonly state = computed<TableState>(() => {
    if (this.loading()) return 'loading';
    if (this.failed()) return 'error';
    if (this.empty()) return 'empty';
    return 'data';
  });

  params(): Record<string, string> {
    const sort = this.sort();
    return {
      ...this.filters(),
      page: String(this.page()),
      pageSize: String(PAGE_SIZE),
      ...(sort ? { sortBy: sort.key, sortDirection: sort.direction } : {}),
    };
  }

  /** A new filter set always returns to page one — page 4 of a new query is a
   * blank screen the operator did not ask for. */
  applyFilters(values: AdminFilterValues): void {
    this.filters.set(values);
    this.page.set(1);
    this.selected.set([]);
  }

  resetFilters(): void {
    this.applyFilters({});
  }

  setSort(sort: AdminSort): void {
    this.sort.set(sort);
    this.page.set(1);
  }

  /** Selection is per page: it is cleared whenever the visible rows change. */
  setPage(page: number): void {
    this.page.set(page);
    this.selected.set([]);
  }

  setSelection(ids: readonly string[]): void {
    this.selected.set(ids);
  }

  clearSelection(): void {
    this.selected.set([]);
  }

  begin(): void {
    this.loading.set(true);
    this.failed.set(false);
  }

  succeed(count: number, total: number): void {
    this.loading.set(false);
    this.failed.set(false);
    this.empty.set(count === 0);
    this.total.set(total);
  }

  fail(): void {
    this.loading.set(false);
    this.failed.set(true);
  }
}
